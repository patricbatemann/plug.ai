"""Decision records: what BOB saw, the mode it used, the options it compared and why it chose one."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.portfolio import Asset, Portfolio
from app.models.run import Cycle, Plan, Run
from app.optimize.profiles import VARIANT_LABELS
from app.optimize.robust import SCENARIO_LABELS
from app.schemas.runs import DecisionDetail, DecisionSummary, OptionOut, SignalOut, StressResult
from app.services.deliberation import describe
from app.services.runs import BLOCK


def _summary(run: Run, cycle: Cycle, plans: list[Plan]) -> dict:
    chosen = next((p for p in plans if p.role == "selected"), None)
    stress = (chosen.robust or {}) if chosen else {}
    return dict(
        id=cycle.id, time=run.sim_start_at + cycle.block * BLOCK, mode=cycle.mode, mode_by=cycle.mode_by,
        mode_reason=cycle.mode_reason, chosen=VARIANT_LABELS[chosen.variant] if chosen else None,
        selected_by=cycle.selected_by, agent=cycle.timings.get("agent"), rationale=cycle.rationale,
        holds=sum(s["holds"] for s in stress.values()), tests=len(stress),
    )


def latest(db: Session, run: Run) -> DecisionSummary | None:
    cycle = db.scalar(select(Cycle).where(Cycle.run_id == run.id).order_by(Cycle.block.desc(), Cycle.seq.desc()).limit(1))
    if cycle is None:
        return None
    return DecisionSummary(**_summary(run, cycle, list(db.scalars(select(Plan).where(Plan.cycle_id == cycle.id)))))


def detail(db: Session, cycle: Cycle) -> DecisionDetail:
    run = db.get(Run, cycle.run_id)
    plans = list(db.scalars(select(Plan).where(Plan.cycle_id == cycle.id).order_by(Plan.id)))
    assets = db.scalars(select(Asset).where(Asset.portfolio_id == run.portfolio_id)).all()
    names = {a.code: a.name for a in assets}
    notice = {a.code: a.params.get("dr_notice_blocks", 0) for a in assets if a.kind == "consumer"}
    start = run.sim_start_at + cycle.block * BLOCK
    gate = db.get(Portfolio, run.portfolio_id).market["gate_blocks"]
    options = []
    for p in plans:
        stress = {s: StressResult(**r) for s, r in (p.robust or {}).items()}
        regrets = [r.regret_inr for r in stress.values() if r.regret_inr is not None]
        options.append(OptionOut(
            variant=p.variant, label=VARIANT_LABELS[p.variant], chosen=p.role == "selected",
            actions=describe(p.schedule["here_and_now"], names, notice, gate, start),
            cost_inr=round(p.kpis["cost_inr"]), carbon_t=round(p.kpis["carbon_t"], 1),
            curtailed_mwh=round(p.kpis["curtailed_mwh"], 1), deviation_mwh=round(p.kpis["deviation_mwh"], 1),
            worst_regret_inr=max(regrets) if regrets else None, stress=stress,
        ))
    return DecisionDetail(
        **_summary(run, cycle, plans), trigger=cycle.trigger, trigger_detail=cycle.trigger_detail, floors=cycle.floors,
        situation=[SignalOut(**s) for s in cycle.situation],
        scenarios={s: SCENARIO_LABELS[s] for s in cycle.scenarios}, options=options,
    )
