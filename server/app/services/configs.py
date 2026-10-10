"""Configured actions: list, draft, validate against protected limits, test in the simulator,
activate (new version), pause. Watch conditions are checked at each block's end."""

from datetime import datetime
from typing import Any

import numpy as np
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.portfolio import ActionConfig, Asset, Site
from app.models.run import Action, AssetBlock, Cycle, Run
from app.optimize.dispatch import Inputs, discharge_history, plan
from app.optimize.robust import scenarios
from app.optimize.validator import check
from app.services import policy
from app.sim.world import AssetSpec

KINDS_FOR = {
    "bess": ("battery_charge", "battery_discharge"),
    "solar": ("curtail",), "wind": ("curtail",),
    "consumer": ("demand_response", "load_shift"),
    "interconnection": ("grid_import", "grid_export"),
}
LIMITS_FOR = {
    "battery_charge": ("max_mw", "auto_max_mw"),
    "battery_discharge": ("max_mw", "auto_max_mw", "reserve_pct", "max_minutes", "max_mwh", "deficit_mw",
                          "deficit_minutes"),
    "curtail": ("auto_max_mw",), "demand_response": ("max_mw", "auto_max_mw"), "load_shift": ("max_mw",),
    "grid_import": ("max_mw", "auto_max_mw"), "grid_export": ("max_mw", "auto_max_mw", "min_price_inr_mwh"),
}
WATCH_METRICS = {
    "bess": ("soc_below_pct", "State of charge below (%)"),
    "solar": ("output_below_forecast_mw", "Output below forecast by (MW)"),
    "wind": ("output_below_forecast_mw", "Output below forecast by (MW)"),
    "consumer": ("demand_above_mw", "Demand above (MW)"),
}
TESTS = {"expected": "Current conditions", "bess_out": "Largest battery unavailable",
         "demand_high": "Demand at P90"}


class ProtectedLimit(ValueError):
    """A setting would loosen an organisation limit; carries the allowed range."""


def validate(asset: Asset, kind: str, limits: dict[str, Any], protected: dict[str, Any]) -> None:
    if kind not in KINDS_FOR.get(asset.kind, ()):
        raise ValueError(f"{asset.name} does not support {kind.replace('_', ' ')}")
    if unknown := set(limits) - set(LIMITS_FOR[kind]):
        raise ValueError(f"{', '.join(sorted(unknown))} does not apply to {kind.replace('_', ' ')}")
    floor = protected.get("battery_soc_floor_pct")
    if "reserve_pct" in limits and floor is not None and limits["reserve_pct"] < floor:
        raise ProtectedLimit(f"Battery reserve must stay at or above the organisation floor of {floor} % "
                             f"(allowed {floor}–80 %).")
    ceiling = protected.get("approval_above_mw")
    if "auto_max_mw" in limits and ceiling is not None and limits["auto_max_mw"] > ceiling:
        raise ProtectedLimit(f"Automatic actions above {ceiling:g} MW always need approval "
                             f"(allowed 0–{ceiling:g} MW).")
    if limits.get("max_mw", 0) > asset.capacity_mw:
        raise ValueError(f"Maximum above {asset.name}'s {asset.capacity_mw:g} MW rating")
    if "max_mw" in limits and limits.get("auto_max_mw", 0) > limits["max_mw"]:
        raise ValueError("The automatic limit cannot exceed the maximum")
    if not 15 <= limits.get("max_minutes", 15) <= 240:
        raise ValueError("A discharge can be limited to between 15 and 240 minutes")
    if "max_mwh" in limits and ("max_minutes" not in limits or not 0 < limits["max_mwh"] <= asset.params["energy_mwh"]):
        raise ValueError(f"An energy cap needs a duration cap and must be within {asset.name}'s "
                         f"{asset.params['energy_mwh']:g} MWh")
    if limits.get("deficit_mw", 0) < 0 or not 0 <= limits.get("deficit_minutes", 0) <= 60:
        raise ValueError("The deficit trigger needs a deficit of 0 MW or more lasting 0–60 minutes")
    if "deficit_minutes" in limits and "deficit_mw" not in limits:
        raise ValueError("A deficit duration needs a deficit threshold")


def site_configs(db: Session, site: Site, run: Run | None) -> list[dict]:
    """Each asset/kind's latest version (draft or current), with today's executed action count."""
    rows = db.scalars(
        select(ActionConfig).where(ActionConfig.site_id == site.id)
        .order_by(ActionConfig.asset_id, ActionConfig.kind, ActionConfig.version.desc())
    ).all()
    latest, seen = [], set()
    for c in rows:
        if (c.asset_id, c.kind) not in seen:
            seen.add((c.asset_id, c.kind))
            latest.append(c)
    counts = {}
    if run is not None:
        day = run.current_block - run.current_block % 96 if run.current_block >= 0 else 0
        counts = dict(db.execute(
            select(Action.asset_id, func.count()).where(
                Action.run_id == run.id, Action.policy == "bob", Action.block >= day,
                Action.status.in_(("acked", "verified")))
            .group_by(Action.asset_id)).all())
    assets = {a.id: a for a in site.assets}
    return [dict(config=c, asset=assets[c.asset_id], actions_today=counts.get(c.asset_id, 0)) for c in latest]


def market_asset(db: Session, portfolio_id: int, kind: str) -> Asset | None:
    """The asset that holds the portfolio's market trades of this kind: they are one decision, configured once."""
    return db.scalar(select(Asset).join(ActionConfig, ActionConfig.asset_id == Asset.id)
                     .where(Asset.portfolio_id == portfolio_id, ActionConfig.kind == kind).limit(1))


def save_draft(db: Session, site: Site, asset: Asset, kind: str, values: dict[str, Any], protected: dict) -> ActionConfig:
    validate(asset, kind, values["limits"], protected)
    holder = market_asset(db, asset.portfolio_id, kind) if kind in policy.MARKET else None
    if holder is not None and holder.id != asset.id:
        raise ValueError(f"Market trades are configured once for the portfolio, on {holder.name}")
    draft = db.scalar(select(ActionConfig).where(
        ActionConfig.asset_id == asset.id, ActionConfig.kind == kind, ActionConfig.status == "draft",
        ~ActionConfig.current))
    version = db.scalar(select(func.max(ActionConfig.version)).where(
        ActionConfig.asset_id == asset.id, ActionConfig.kind == kind)) or 0
    if draft is None:
        draft = ActionConfig(site_id=site.id, asset_id=asset.id, kind=kind, current=False, version=version + 1)
        db.add(draft)
    draft.status, draft.tests = "draft", {}
    draft.name, draft.autonomy = values["name"], values["autonomy"]
    draft.limits, draft.approval, draft.watch = values["limits"], values["approval"], values["watch"]
    draft.preferences = values["preferences"]
    db.flush()
    return draft


ACTION_OF = {"battery_charge": "bess_charge", "battery_discharge": "bess_discharge", "curtail": "curtail",
             "demand_response": "dr_call", "load_shift": "load_shift", "grid_import": "rtm_buy",
             "grid_export": "rtm_sell"}


def test(draft: ActionConfig, asset: AssetSpec, inputs: Inputs, forecasts: dict) -> dict[str, dict]:
    """Plan the block in progress with the draft in force under each test scenario: the plan must
    serve all load, and the draft's asset must pass the safety validator."""
    key = policy.key(ACTION_OF[draft.kind], asset.code)
    inputs.allowed = {**inputs.allowed, key: {**draft.limits, "autonomy": draft.autonomy}}
    horizon = len(inputs.price)
    cases = scenarios(
        inputs,
        {c: np.array(forecasts[("re_avail", c)].p10[:horizon]) for c in inputs.available if ("re_avail", c) in forecasts},
        {c: np.array(forecasts[("load", c)].p90[:horizon]) for c in inputs.available if ("load", c) in forecasts},
        None, False,
    )
    results = {}
    for name, label in TESTS.items():
        case = cases.get(name)
        if case is None:
            results[name] = {"label": label, "passed": True, "detail": "Not applicable: no battery available"}
            continue
        p = plan(case)
        problems = []
        if not p.battery:
            problems.append("no feasible plan")
        elif p.kpis["unserved_mwh"] > 1e-3:
            problems.append(f"{p.kpis['unserved_mwh']:.2f} MWh of load unserved")
        elif asset.kind == "bess":
            mw = float(p.battery[asset.code][0])
            kind = "bess_discharge" if mw > 0 else "bess_charge"
            reason = check(kind, abs(mw), asset, soc_mwh=inputs.soc_mwh[asset.code],
                           available=bool(case.bess_available[asset.code][0]), **discharge_history(case, asset.code))
            if abs(mw) > 0.05 and reason:
                problems.append(reason)
        results[name] = {"label": label, "passed": not problems,
                         "detail": "; ".join(problems) or "Load served; actions within limits"}
    draft.tests = results
    draft.status = "testing"
    return results


def activate(db: Session, draft: ActionConfig, user: str, now: datetime) -> ActionConfig:
    if not draft.tests or not all(r["passed"] for r in draft.tests.values()):
        raise ValueError("Run the tests and pass all of them before activating")
    db.execute(update(ActionConfig).where(
        ActionConfig.asset_id == draft.asset_id, ActionConfig.kind == draft.kind, ActionConfig.current,
    ).values(current=False))
    db.flush()
    draft.current, draft.status, draft.activated_by, draft.activated_at = True, "active", user, now
    return draft


def watch_hits(db: Session, run: Run, block: int, forecast_p50: dict[str, float]) -> list[str]:
    """Watch conditions newly crossed in the block just settled; BOB re-plans with them as the trigger."""
    configs = db.execute(
        select(ActionConfig, Asset).join(Asset, Asset.id == ActionConfig.asset_id)
        .where(Asset.portfolio_id == run.portfolio_id, ActionConfig.current, ActionConfig.status == "active",
               func.jsonb_array_length(ActionConfig.watch) > 0)
    ).all()
    if not configs:
        return []
    rows = {r.asset_id: r for r in db.scalars(select(AssetBlock).where(
        AssetBlock.run_id == run.id, AssetBlock.policy == "bob", AssetBlock.block == block))}
    hits = []
    for config, asset in configs:
        for w in config.watch:
            value = watch_value(w["metric"], asset, rows.get(asset.id), forecast_p50)
            if value is not None and crossed(w["metric"], value, w["value"]):
                hits.append(f"{asset.name}: {watch_label(w)}")
    # Once per crossing: a condition already reported for the previous block is not news.
    reported = " ".join(db.scalars(select(Cycle.trigger_detail).where(
        Cycle.run_id == run.id, Cycle.block == block, Cycle.trigger == "watch")))
    return [h for h in hits if h not in reported]


def crossed(metric: str, value: float, threshold: float) -> bool:
    return value < threshold if metric == "soc_below_pct" else value > threshold


def watch_value(metric: str, asset: Asset, row: AssetBlock | None, forecast_p50: dict[str, float]) -> float | None:
    if row is None:
        return None
    if metric == "soc_below_pct":
        return row.soc_mwh / asset.params["energy_mwh"] * 100
    if metric == "output_below_forecast_mw":
        expected = forecast_p50.get(asset.code)
        return None if expected is None else expected - row.actual_mw
    if metric == "demand_above_mw":
        return row.actual_mw
    return None


def watch_label(w: dict) -> str:
    return {"soc_below_pct": f"state of charge below {w['value']:g} %",
            "output_below_forecast_mw": f"output {w['value']:g} MW below forecast",
            "demand_above_mw": f"demand above {w['value']:g} MW"}[w["metric"]]
