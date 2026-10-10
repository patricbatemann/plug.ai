"""BOB's turn in a decision cycle: it reads the situation, may change the mode
(guard floors still apply), may add stress scenarios, and picks an option within 10 % of the
least worst-case regret. Whatever it leaves undecided, the rules decide."""

from dataclasses import asdict
from typing import Literal

import numpy as np
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agent.llm import Tool, Unavailable, turn
from app.core.config import settings
from app.optimize.dispatch import here_and_now
from app.optimize.profiles import PROFILES, VARIANT_LABELS, VARIANTS
from app.optimize.robust import SCENARIO_LABELS
from app.services.deliberation import BLOCK, IST, Deliberation, describe

SYSTEM = """You are BOB, the supervisory orchestrator of an Indian renewable portfolio (solar, wind, \
batteries, industrial loads, one market connection) dispatched in 15-minute blocks under CERC rules.

A deterministic optimiser computes every number. You decide only:
1. The operating mode. balanced: the operator's everyday trade-off. economic: lower reserve, chase \
price spreads. clean: avoid curtailment and imported carbon. resilience: deep reserve and high battery \
floor ahead of storms or outages. grid_support: hold reserve and keep to schedule when the grid is \
stressed (frequency excursion, corridor derate). Guard floors are applied whatever you choose.
2. Extra stress scenarios to test, from the library, when the situation warrants them.
3. Which option to run. Options are judged by worst-case regret across the stress scenarios. You may \
choose any option whose worst-case regret is within the allowed limit; prefer the rule's choice unless \
the situation gives a concrete reason.

Work in this order: get_situation, then set_profile only if the current mode does not fit, then \
add_scenarios only if needed, then generate_plans, then select_plan. The rationale (at most 600 \
characters, plain English, for a control-room operator) must state the criterion that decided and what \
it cost in ₹ or MWh compared with the alternative. Name options by their label, never by plan_id, and \
do not mention "the rule". Worst-case regret is the ₹ an option loses, in its worst stress scenario, \
against the best plan for that scenario. A negative net cost is net earnings; say "earns". Use only \
numbers from tool outputs. Never claim an action has been executed: execution, approvals and safety \
checks happen after you."""


class GetSituation(BaseModel):
    """Signals, the mode in force and why, battery state, the next two hours and the stress scenarios."""


class SetProfile(BaseModel):
    """Change the operating mode for this cycle. Guard floors still apply."""
    code: Literal[tuple(PROFILES)]
    reason: str


class AddScenarios(BaseModel):
    """Add stress scenarios from the library to the test set."""
    ids: list[Literal[tuple(SCENARIO_LABELS)]]
    reason: str


class GeneratePlans(BaseModel):
    """Solve the options for the current mode and test each against the stress scenarios."""


class SelectPlan(BaseModel):
    """Choose the option to run, with the rationale shown to the operator."""
    plan_id: Literal[tuple(VARIANTS)]
    rationale: str


def decide(db: Session, ctx, run, t0: int, cycle_id: int, d: Deliberation, trigger: str, detail: str) -> str:
    """Run BOB's turn on `d`; returns how it ended ("ok" or the reason rules took over)."""
    start = run.sim_start_at + t0 * BLOCK
    notice = {a.code: a.params.get("dr_notice_blocks", 0) for a in ctx.assets if a.kind == "consumer"}
    batteries = [a for a in ctx.assets if a.kind == "bess"]

    def situation(_: GetSituation) -> dict:
        near = slice(0, 8)
        total = lambda kinds: sum(d.inputs.available[a.code][near] for a in ctx.assets if a.kind in kinds)  # noqa: E731
        return {
            "time": start.astimezone(IST).strftime("%H:%M IST"), "trigger": trigger, "detail": detail,
            "mode": d.mode, "mode_set_by": d.mode_by, "mode_reason": d.mode_reason,
            "operator_default_mode": ctx.default_mode, "guard_floors": d.floors,
            "signals": [{"label": s.label, "value": s.value, "threshold": s.threshold, "material": s.material,
                         "calls_for": s.mode} for s in d.signals],
            "batteries": [{"name": ctx.names[a.code], "power_mw": a.capacity,
                           "charge_pct": round(d.inputs.soc_mwh[a.code] / a.params["energy_mwh"] * 100),
                           "available": bool(d.inputs.bess_available[a.code][0])} for a in batteries],
            "next_2h_by_block": {
                "renewables_mw": np.round(total(("solar", "wind"))).tolist(),
                "demand_mw": np.round(total(("consumer",))).tolist(),
                "real_time_price_inr_mwh": np.round(d.inputs.price[near]).tolist(),
            },
            "stress_scenarios": {k: SCENARIO_LABELS[k] for k in d.cases()},
            "library": {k: v for k, v in SCENARIO_LABELS.items() if k not in d.cases()},
        }

    def set_profile(a: SetProfile) -> dict:
        d.set_mode(a.code, "bob", a.reason[:300])
        return {"mode": a.code, "guard_floors": d.floors}

    def add_scenarios(a: AddScenarios) -> dict:
        if "storm" in a.ids and d.storm is None:
            raise ValueError("No storm is known, so there is no storm scenario to test")
        d.added |= set(a.ids)
        d.options, d.robust = {}, None
        return {"stress_scenarios": list(d.cases())}

    def generate(_: GeneratePlans) -> dict:
        d.generate()
        if not d.options:
            return {"error": "No feasible plan: the rules will hold safe."}
        return {
            "options": [{
                "plan_id": name, "label": VARIANT_LABELS[name],
                "actions": describe(asdict(here_and_now(p, d.inputs)), ctx.names, notice, ctx.market["gate_blocks"], start),
                "net_cost_inr": round(p.kpis["cost_inr"]), "carbon_t": round(p.kpis["carbon_t"], 1),
                "curtailed_mwh": round(p.kpis["curtailed_mwh"], 1),
                "worst_regret_inr": d.worst(name),
                "load_served_in": f"{sum(s['holds'] for s in d.robust[name].values())} of {len(d.robust[name])}",
                "regret_by_scenario": {s: r["regret_inr"] for s, r in d.robust[name].items()},
            } for name, p in d.options.items()],
            "rule_choice": d.rule_choice(),
            "allowed_worst_regret_inr": round(d.allowed_regret()),
        }

    def select(a: SelectPlan) -> dict:
        if len(a.rationale) > 600:
            raise ValueError("Rationale is longer than 600 characters")
        d.select(a.plan_id, "bob", a.rationale)
        return {"accepted": True}

    tools = {"get_situation": Tool(GetSituation, situation), "set_profile": Tool(SetProfile, set_profile),
             "add_scenarios": Tool(AddScenarios, add_scenarios), "generate_plans": Tool(GeneratePlans, generate),
             "select_plan": Tool(SelectPlan, select)}
    messages = [{"role": "system", "content": SYSTEM},
                {"role": "user", "content": f"Plan the block starting {start.astimezone(IST):%H:%M}. "
                                            f"Trigger: {trigger}{f' ({detail})' if detail else ''}."}]
    try:
        for _ in turn(db, "cycle", messages, tools, run_id=run.id, cycle_id=cycle_id,
                      budget_s=settings.bob_timeout_s, done=lambda: d.selected_by == "bob"):
            pass  # nobody watches a cycle turn live
    except Unavailable as error:
        return f"fallback: {error}"
    return "ok" if d.selected_by == "bob" else "fallback: no option selected"

