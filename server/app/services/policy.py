"""Policy tiers and approvals (docs/spec/01 §10): each action is automatic, needs approval, or is a
recommendation, from its asset's active config and the organisation's protected limits."""

from datetime import datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.portfolio import ActionConfig, Asset
from app.models.run import Action, MaintenanceTask, Run
from app.sim.adapters import deliver

FAMILY = {
    "bess_charge": "battery_charge", "bess_discharge": "battery_discharge", "curtail": "curtail",
    "dr_call": "demand_response", "load_shift": "load_shift", "rtm_buy": "grid_import", "rtm_sell": "grid_export",
}
MARKET = ("grid_import", "grid_export")
WORK_ORDERS = ("maintenance_schedule", "inspection_dispatch")
# Kinds that set the same thing on the same asset: an approved action replaces its stand-in.
SAME_DECISION = {"bess_charge": ("bess_charge", "bess_discharge"), "bess_discharge": ("bess_charge", "bess_discharge"),
                 "rtm_buy": ("rtm_buy", "rtm_sell"), "rtm_sell": ("rtm_buy", "rtm_sell")}


def allowed(db: Session, portfolio_id: int) -> dict[str, dict[str, Any]]:
    """Active configs keyed "family:code" (market families keyed by "portfolio")."""
    rows = db.execute(
        select(ActionConfig, Asset.code).join(Asset, Asset.id == ActionConfig.asset_id)
        .where(Asset.portfolio_id == portfolio_id, ActionConfig.current, ActionConfig.status == "active")
    ).all()
    return {
        f"{c.kind}:{'portfolio' if c.kind in MARKET else code}": {
            **c.limits, "autonomy": c.autonomy, "response_min": c.approval.get("response_min", 10), "config_id": c.id,
        }
        for c, code in rows
    }


def key(kind: str, code: str) -> str:
    family = FAMILY[kind]
    return f"{family}:{'portfolio' if family in MARKET else code}"


def tier(kind: str, code: str, amount_mw: float, configs: dict, protected: dict) -> tuple[str, str | None]:
    """('auto' | 'approval' | 'recommend', why it is not automatic)."""
    config = configs.get(key(kind, code))
    if config is None:
        return "recommend", "No active configuration for this action"
    if config["autonomy"] == "recommend":
        return "recommend", "Configured as recommend only"
    if config["autonomy"] == "approval":
        return "approval", "Configured to need approval"
    ceiling = protected.get("approval_above_mw")
    if ceiling is not None and amount_mw > ceiling:
        return "approval", f"Above the organisation's {ceiling:g} MW approval ceiling"
    if "auto_max_mw" in config and amount_mw > config["auto_max_mw"]:
        return "approval", f"Above the {config['auto_max_mw']:g} MW automatic limit"
    return "auto", None


def expire(db: Session, run: Run, sim_now: datetime) -> None:
    db.execute(update(Action).where(
        Action.run_id == run.id, Action.status == "awaiting_approval", Action.deadline_at < sim_now,
    ).values(status="expired"))


def decide(db: Session, run: Run, action: Action, approve: bool, user: str, sim_now: datetime) -> None:
    """Approve (send it, replacing its stand-in in the fallback plan) or decline a gated action."""
    if action.deadline_at and sim_now > action.deadline_at:
        action.status = "expired"
        raise ValueError("The approval window has passed; BOB kept the fallback plan.")
    action.decided_by, action.decided_at = user, sim_now
    if not approve:
        action.status = "declined"
        return
    if action.kind in WORK_ORDERS:  # a work order to the maintenance system, not a setpoint
        if action.kind == "maintenance_schedule":
            db.get(MaintenanceTask, action.params["task_id"]).scheduled_at = datetime.fromisoformat(
                action.params["start_at"])
        action.status = "acked"
        return
    kinds = SAME_DECISION.get(action.kind, (action.kind,))
    db.execute(update(Action).where(
        Action.run_id == run.id, Action.policy == "bob", Action.block == action.block, Action.kind.in_(kinds),
        Action.asset_id.is_(None) if action.asset_id is None else Action.asset_id == action.asset_id,
        Action.status == "acked", Action.id != action.id,
    ).values(status="superseded"))
    action.delivered_mw = round(deliver(action.kind, action.mw, action.idempotency_key, run.config), 3)
    action.status = "acked"
