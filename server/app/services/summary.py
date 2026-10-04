"""Run totals for BOB and today's practice, and BOB's recent actions."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.portfolio import Asset, Site
from app.models.run import Action, Run, SystemBlock
from app.schemas.runs import ActionOut, PolicyTotals, RunSummary
from app.services.runs import BLOCK

SUMMED = ("cost_inr", "market_inr", "dsm_inr", "dr_inr", "wear_inr", "curtail_inr", "curtailed_mwh", "carbon_t",
          "unserved_mwh")


def summary(db: Session, run: Run) -> RunSummary:
    totals = {}
    for policy in ("bob", "baseline"):
        row = db.execute(
            select(*(func.coalesce(func.sum(getattr(SystemBlock, c)), 0.0) for c in SUMMED),
                   func.coalesce(func.sum(func.abs(SystemBlock.deviation_mw)), 0.0) * BLOCK.total_seconds() / 3600)
            .where(SystemBlock.run_id == run.id, SystemBlock.policy == policy)
        ).one()
        totals[policy] = PolicyTotals(**dict(zip(SUMMED, row[:-1])), deviation_mwh=row[-1])
    return RunSummary(block=run.current_block, bob=totals["bob"], baseline=totals["baseline"],
                      saving_inr=totals["baseline"].cost_inr - totals["bob"].cost_inr)


def recent_actions(db: Session, run: Run, limit: int, status: list[str] | None = None, site: str | None = None,
                   block: int | None = None) -> list[ActionOut]:
    query = (
        select(Action, Asset.name, Site.name)
        .outerjoin(Asset, Asset.id == Action.asset_id).outerjoin(Site, Site.id == Asset.site_id)
        .where(Action.run_id == run.id, Action.policy == "bob")
    )
    if status:
        query = query.where(Action.status.in_(status))
    else:  # history leaves out decisions that were replaced before they took effect
        query = query.where(Action.status != "superseded")
    if site:
        query = query.where(Site.code == site)
    if block is not None:
        query = query.where(Action.block == block)
    rows = db.execute(query.order_by(Action.block.desc(), Action.id.desc()).limit(limit)).all()
    return [
        ActionOut(id=a.id, block=a.block, time=run.sim_start_at + a.block * BLOCK, cycle_id=a.cycle_id, tier=a.tier,
                  deadline_at=a.deadline_at, decided_by=a.decided_by, kind=a.kind, site=site_name, asset=asset,
                  mw=a.mw, delivered_mw=a.delivered_mw, actual_mw=a.actual_mw, status=a.status, reason=a.reason)
        for a, asset, site_name in rows
    ]
