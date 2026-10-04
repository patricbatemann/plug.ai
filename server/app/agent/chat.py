"""Ask BOB: answers operator questions with read-only, what-if and configuration-draft tools.
It never executes an action and never activates a configuration. The conversation is kept per
run and user in chat_message, so any replica can continue it."""

from collections.abc import Iterator
from datetime import datetime, time, timedelta, timezone
from typing import Literal

import numpy as np
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agent.llm import Tool, Unavailable, turn
from app.core.config import settings
from app.models.portfolio import ActionConfig, Asset, Portfolio, Site
from app.models.run import Action, AssetBlock, ChatMessage, Constraint, Cycle, Forecast, Run
from app.services import configs, decisions, documents, policy, runs
from app.services.deliberation import IST
from app.services.summary import recent_actions, summary
from app.services.whatif import WhatIf, what_if

HISTORY_ROWS = 40
WORKING_ON = {"get_situation": "Reading the live situation", "get_cycle": "Reading the decision record",
              "get_asset": "Checking the asset", "explain_action": "Looking up the action",
              "what_if": "Planning the what-if", "draft_action_config": "Drafting the setup",
              "test_action_config": "Testing the draft"}
SYSTEM = """You are BOB, the AI orchestrator of an Indian renewable portfolio, answering a control-room \
operator in PlugAI. Times are IST; money is ₹ (write lakh for 1,00,000); power in MW, energy in MWh.

Answer from tool outputs only, briefly, in plain sentences: no headings, lists or tables. When \
explaining a decision, cite the cycle time, the mode and why, the option chosen and the criterion that \
decided it. You cannot execute actions, approve them or activate configurations: say what the \
operator can do instead.

Setting up an action: use draft_action_config with only the fields the operator asked to change, then \
test_action_config on the draft, then tell the operator to review and activate it in the setup wizard. \
If a setting is blocked by a protected limit, say so, quote the allowed range, and do not try to work \
around it."""


class GetSituation(BaseModel):
    """Sim time, the mode and latest decision, material signals, pending approvals, today's results
    against today's practice, and the asset list with codes."""


class GetCycle(BaseModel):
    """The decision records for one 15-minute block: trigger, mode, options, stress tests, choice,
    rationale and resulting actions."""
    at: str  # "HH:MM" in IST, or "latest"


class GetAsset(BaseModel):
    """One asset: latest output or charge, the next hour's forecast, its configured actions."""
    code: str


class ExplainAction(BaseModel):
    """One action: what, when, its policy tier and why, status, and the decision behind it."""
    action_id: int


class DraftActionConfig(BaseModel):
    """Create or update the draft configuration of one action on one asset. Null leaves a field as
    it is. A draft never takes effect until the operator activates it in the setup wizard."""
    asset: str
    kind: Literal[tuple(configs.LIMITS_FOR)]
    name: str | None
    autonomy: Literal["auto", "approval", "recommend"] | None = Field(description=(
        "auto: BOB acts alone up to auto_max_mw and asks approval above it; approval: every action needs "
        "approval; recommend: BOB only recommends"))
    max_mw: float | None = Field(description="Hard ceiling: BOB never plans above this")
    auto_max_mw: float | None = Field(description="With autonomy auto, actions above this need approval")
    reserve_pct: float | None = Field(description="Battery charge kept in reserve, %")
    min_price_inr_mwh: float | None = Field(description="Sell only above this price")
    response_min: int | None = Field(description="Minutes an approver has to respond")
    watch_threshold: float | None = Field(description="Re-plan and flag when the asset's watch metric crosses this")
    remove_watch: bool


class TestActionConfig(BaseModel):
    """Run the setup tests for a draft against live conditions; nothing is sent to any asset."""
    config_id: int


def history(db: Session, run: Run, user_id: int) -> list[ChatMessage]:
    rows = list(db.scalars(select(ChatMessage).where(ChatMessage.run_id == run.id, ChatMessage.user_id == user_id)
                           .order_by(ChatMessage.id.desc()).limit(HISTORY_ROWS)))[::-1]
    while rows and rows[0].role != "user":  # never start mid-turn
        rows.pop(0)
    return rows


def ask(db: Session, run: Run, user_id: int, text: str, context: str | None) -> Iterator[tuple[str, object]]:
    """One operator message and BOB's reply, streamed as ("status", label), ("delta", text) and
    finally ("done", the stored conversation). A failed turn stores only an apology, so the stored
    conversation always replays as a valid sequence."""
    question = {"role": "user", "content": f"{text}\n\n(Operator is viewing: {context})" if context else text}
    messages = [{"role": "system", "content": SYSTEM}, *(r.content["message"] for r in history(db, run, user_id)),
                question]
    cards: list[dict] = []
    try:
        asked = len(messages)
        for kind, value in turn(db, "chat", messages, _tools(db, run, cards), run_id=run.id,
                                budget_s=settings.bob_chat_timeout_s):
            # A new tool means the text so far was a preamble; the UI clears it on each status.
            yield ("status", WORKING_ON.get(value, "Working")) if kind == "tool" else ("delta", value)
        new = messages[asked:]
    except Unavailable as error:
        cards = []
        new = [{"role": "assistant", "content": f"I can't answer right now ({error}). Decisions continue on rules."}]
    except GeneratorExit:  # the operator left: keep the call log and any draft already made, not the exchange
        db.commit()
        raise
    db.add(ChatMessage(run_id=run.id, user_id=user_id, role="user", content={"message": question, "text": text}))
    for i, message in enumerate(new):
        content = {"message": message, **({"cards": cards} if i == len(new) - 1 else {})}
        db.add(ChatMessage(run_id=run.id, user_id=user_id, role=message["role"], content=content))
    db.commit()
    yield "done", display(db, run, history(db, run, user_id))


def display(db: Session, run: Run, rows: list[ChatMessage]) -> list[dict]:
    """What the operator sees: their questions and BOB's answers with any cards. Constraint cards
    are read fresh, so they show whether a person has since applied or rejected them."""
    ref = None

    def fresh(card: dict) -> dict:
        nonlocal ref
        if card["type"] != "constraint":
            return card
        ref = ref or documents.Reference.load(db, run.portfolio_id)
        return documents.card(db, db.get(Constraint, card["id"]), ref)

    out = []
    for r in rows:
        if r.role == "user":
            out.append({"id": r.id, "role": "user", "text": r.content["text"], "cards": []})
        elif r.role == "assistant" and (r.content["message"].get("content") or r.content.get("cards")):
            out.append({"id": r.id, "role": "assistant", "text": r.content["message"].get("content") or "",
                        "cards": [fresh(c) for c in r.content.get("cards", [])]})
    return out


def _tools(db: Session, run: Run, cards: list[dict]) -> dict[str, Tool]:
    assets = {a.code: a for a in db.scalars(select(Asset).where(Asset.portfolio_id == run.portfolio_id))}
    sites = {s.id: s for s in db.scalars(select(Site).where(Site.portfolio_id == run.portfolio_id))}
    now = runs.sim_now(run, datetime.now(timezone.utc))

    def asset(code: str) -> Asset:
        if code not in assets:
            raise ValueError(f"Unknown asset {code}; get_situation lists the codes")
        return assets[code]

    def situation(_: GetSituation) -> dict:
        latest = decisions.latest(db, run)
        cycle = db.get(Cycle, latest.id) if latest else None
        return {
            "sim_time": now.astimezone(IST).strftime("%Y-%m-%d %H:%M"),
            "mode": run.mode_code, "mode_set_by": run.mode_by,
            "latest_decision": latest.model_dump(mode="json") if latest else None,
            "material_signals": [s for s in cycle.situation if s["material"]] if cycle else [],
            "pending_approvals": [a.model_dump(mode="json") for a in recent_actions(
                db, run, 10, status=["awaiting_approval"])],
            "today_vs_todays_practice": summary(db, run).model_dump(),
            "assets": [{"code": a.code, "name": a.name, "kind": a.kind, "site": sites[a.site_id].name}
                       for a in assets.values()],
        }

    def cycle(a: GetCycle) -> dict:
        if a.at == "latest":
            block = run.current_block + 1
        else:
            hh, mm = (int(x) for x in a.at.split(":"))
            local = now.astimezone(IST)
            target = datetime.combine(local.date(), time(hh, mm), IST)
            if target > local:
                target -= timedelta(days=1)
            block = int((target - run.sim_start_at) / runs.BLOCK)
        rows = list(db.scalars(select(Cycle).where(Cycle.run_id == run.id, Cycle.block <= block)
                               .order_by(Cycle.block.desc(), Cycle.seq).limit(4)))
        rows = [c for c in rows if c.block == rows[0].block] if rows else []
        if not rows:
            raise ValueError("No decision at that time")
        return {"cycles": [{**decisions.detail(db, c).model_dump(mode="json"), "actions": [
            x.model_dump(mode="json") for x in recent_actions(db, run, 20, cycle_id=c.id)]} for c in rows]}

    def asset_info(a: GetAsset) -> dict:
        x = asset(a.code)
        row = db.scalar(select(AssetBlock).where(AssetBlock.run_id == run.id, AssetBlock.policy == "bob",
                                                 AssetBlock.asset_id == x.id, AssetBlock.block == run.current_block))
        forecast = db.scalar(select(Forecast).where(Forecast.run_id == run.id, Forecast.asset_id == x.id,
                                                    Forecast.issued_block == run.current_block))
        rules = db.scalars(select(ActionConfig).where(ActionConfig.asset_id == x.id, ActionConfig.current))
        day = run.current_block - run.current_block % 96
        return {
            "code": x.code, "name": x.name, "kind": x.kind, "site": sites[x.site_id].name, "capacity_mw": x.capacity_mw,
            "last_block": {"available_mw": round(row.available_mw, 1), "actual_mw": round(row.actual_mw, 1),
                           "charge_pct": round(row.soc_mwh / x.params["energy_mwh"] * 100) if row.soc_mwh else None,
                           } if row else None,
            "next_hour_forecast_mw": {"p10": np.round(forecast.p10[:4], 1).tolist(),
                                      "p50": np.round(forecast.p50[:4], 1).tolist(),
                                      "p90": np.round(forecast.p90[:4], 1).tolist()} if forecast else None,
            "configured_actions": [{"kind": c.kind, "autonomy": c.autonomy, "limits": c.limits, "status": c.status,
                                    "version": c.version} for c in rules],
            "actions_today": db.scalar(select(func.count()).select_from(Action).where(
                Action.run_id == run.id, Action.policy == "bob", Action.asset_id == x.id, Action.block >= day,
                Action.status.in_(("acked", "verified")))),
        }

    def explain(a: ExplainAction) -> dict:
        found = recent_actions(db, run, 1, action_id=a.action_id)
        if not found:
            raise ValueError(f"No action {a.action_id}")
        action = db.get(Action, a.action_id)
        made_by = db.get(Cycle, action.cycle_id) if action.cycle_id else None
        return {"action": found[0].model_dump(mode="json"),
                "policy_family": policy.FAMILY[action.kind],
                "decision": {"time": (run.sim_start_at + made_by.block * runs.BLOCK).astimezone(IST).strftime("%H:%M"),
                             "mode": made_by.mode, "mode_reason": made_by.mode_reason,
                             "rationale": made_by.rationale} if made_by else None}

    def what_if_card(a: WhatIf) -> dict:
        result = what_if(db, run, a)
        cards.append({"type": "what_if", **result})
        return result

    def draft(a: DraftActionConfig) -> dict:
        x = asset(a.asset)
        site = sites[x.site_id]
        latest = db.scalar(select(ActionConfig).where(ActionConfig.asset_id == x.id, ActionConfig.kind == a.kind)
                           .order_by(ActionConfig.version.desc()).limit(1))
        values = ({"name": latest.name, "autonomy": latest.autonomy, "limits": dict(latest.limits),
                   "approval": dict(latest.approval), "watch": list(latest.watch)} if latest else
                  {"name": f"{a.kind.replace('_', ' ').capitalize()}: {x.name}", "autonomy": "approval",
                   "limits": {}, "approval": {"response_min": 10}, "watch": []})
        given = {k: getattr(a, k) for k in ("max_mw", "auto_max_mw", "reserve_pct", "min_price_inr_mwh")
                 if getattr(a, k) is not None}
        values["limits"].update(given)
        values["name"] = a.name or values["name"]
        values["autonomy"] = a.autonomy or values["autonomy"]
        if a.response_min is not None:
            values["approval"]["response_min"] = a.response_min
        metric = configs.WATCH_METRICS.get(x.kind, (None,))[0]
        if a.remove_watch:
            values["watch"] = []
        elif a.watch_threshold is not None:
            if metric is None:
                raise ValueError(f"{x.name} has no watch condition")
            values["watch"] = [{"metric": metric, "value": a.watch_threshold}]
        portfolio = db.get(Portfolio, site.portfolio_id)
        try:
            saved = configs.save_draft(db, site, x, a.kind, values, portfolio.protected)
        except configs.ProtectedLimit as error:
            cards.append({"type": "blocked", "asset_name": x.name, "kind": a.kind, "text": str(error)})
            return {"blocked": str(error)}
        cards.append({"type": "draft", "config_id": saved.id, "site": site.code, "asset": x.code,
                      "asset_name": x.name, "kind": a.kind, "version": saved.version, "autonomy": saved.autonomy,
                      "limits": saved.limits, "watch": saved.watch})
        return {"draft_id": saved.id, "version": saved.version, "values": values}

    def test(a: TestActionConfig) -> dict:
        config = db.get(ActionConfig, a.config_id)
        if config is None or config.current:
            raise ValueError("Only a draft can be tested")
        results = runs.test_config(db, run, config)
        x = db.get(Asset, config.asset_id)
        cards.append({"type": "tests", "config_id": config.id, "site": sites[x.site_id].code, "asset": x.code,
                      "asset_name": x.name, "kind": config.kind, "tests": results})
        return {"tests": results}

    return {"get_situation": Tool(GetSituation, situation), "get_cycle": Tool(GetCycle, cycle),
            "get_asset": Tool(GetAsset, asset_info), "explain_action": Tool(ExplainAction, explain),
            "what_if": Tool(WhatIf, what_if_card), "draft_action_config": Tool(DraftActionConfig, draft),
            "test_action_config": Tool(TestActionConfig, test)}
