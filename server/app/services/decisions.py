"""Decision records: what BOB saw, the mode it used, the options it compared and why it chose one."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.portfolio import Asset, Portfolio
from app.models.run import Cycle, Plan, Run
from app.optimize.profiles import VARIANT_LABELS
from app.optimize.robust import SCENARIO_LABELS
from app.schemas.runs import DecisionDetail, DecisionSummary, OptionOut, SignalOut, StressResult
from app.services.runs import BLOCK, IST


def _actions(here_and_now: dict, names: dict[str, str], notice: dict[str, int], gate: int, start) -> list[str]:
    at = lambda blocks: (start + blocks * BLOCK).astimezone(IST).strftime("%H:%M")  # noqa: E731
    out = []
    for code, mw in here_and_now["battery"].items():
        out.append(f"{names[code]}: {'discharge' if mw > 0 else 'charge'} {abs(mw):.1f} MW")
    for code, cap in here_and_now["output_cap"].items():
        out.append(f"{names[code]}: limit output to {cap:.1f} MW")
    for code, mw in here_and_now["demand_response"].items():
        out.append(f"{names[code]}: demand response {mw:.1f} MW at {at(notice[code])}")
    for code, mw in here_and_now["shift"].items():
        out.append(f"{names[code]}: move {abs(mw):.1f} MW of load {'out of' if mw > 0 else 'into'} this block")
    if here_and_now["rtm"]:
        side = "buy" if here_and_now["rtm"] > 0 else "sell"
        out.append(f"Market: {side} {abs(here_and_now['rtm']):.1f} MW for {at(gate)}")
    return out or ["Hold: no change this block"]


def _summary(run: Run, cycle: Cycle, plans: list[Plan]) -> dict:
    chosen = next((p for p in plans if p.role == "selected"), None)
    stress = (chosen.robust or {}) if chosen else {}
    return dict(
        id=cycle.id, time=run.sim_start_at + cycle.block * BLOCK, mode=cycle.mode, mode_by=cycle.mode_by,
        mode_reason=cycle.mode_reason, chosen=VARIANT_LABELS[chosen.variant] if chosen else None,
        rationale=cycle.rationale, holds=sum(s["holds"] for s in stress.values()), tests=len(stress),
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
            actions=_actions(p.schedule["here_and_now"], names, notice, gate, start),
            cost_inr=round(p.kpis["cost_inr"]), carbon_t=round(p.kpis["carbon_t"], 1),
            curtailed_mwh=round(p.kpis["curtailed_mwh"], 1), deviation_mwh=round(p.kpis["deviation_mwh"], 1),
            worst_regret_inr=max(regrets) if regrets else None, stress=stress,
        ))
    return DecisionDetail(
        **_summary(run, cycle, plans), trigger=cycle.trigger, floors=cycle.floors,
        situation=[SignalOut(**s) for s in cycle.situation],
        scenarios={s: SCENARIO_LABELS[s] for s in cycle.scenarios}, options=options,
    )
