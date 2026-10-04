"""Replays (F3, D2): one preset over several seeds, each a run the worker clock advances block by
block like any other, every block fast-forwarded (rules choose the mode, one plan per block, nobody
answers approvals). Results compare BOB with today's practice on the same worlds, and check that no
hard limit was broken."""

from collections import Counter
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.portfolio import Asset, Portfolio
from app.models.run import Action, AgentCall, AssetBlock, Cycle, LineBlock, Run, Study
from app.services import runs
from app.services.summary import summary
from app.sim.presets import PRESETS

MAX_REPLAYS = 20  # running at once, across studies
TOLERANCE = 0.01  # MW or MWh: rounding, not a violation
METRICS = {"cost_inr": "Net cost (₹)", "carbon_t": "Carbon (t)", "curtailed_mwh": "Curtailed (MWh)",
           "deviation_mwh": "Schedule deviation (MWh)"}


def create(db: Session, portfolio: Portfolio, preset: str, seeds: int, user: str, now: datetime) -> Study:
    running = db.scalar(select(func.count()).select_from(Run).where(Run.study_id.isnot(None), Run.status == "running"))
    if running + seeds > MAX_REPLAYS:
        raise ValueError(f"{running} replays are already running; at most {MAX_REPLAYS} run at once")
    study = Study(portfolio_id=portfolio.id, preset=preset, seeds=seeds, created_by=user)
    db.add(study)
    db.flush()
    base = PRESETS[preset]["seed"]
    for i in range(seeds):
        runs.create_run(db, portfolio, preset, now, study=study, seed=base + i)
    return study


def violations(db: Session, run: Run, policy: str = "bob") -> list[str]:
    """Hard limits the settled plant broke: battery charge or power beyond its limits, line flow
    above its limit."""
    out = []
    rows = db.execute(select(AssetBlock, Asset).join(Asset, Asset.id == AssetBlock.asset_id).where(
        AssetBlock.run_id == run.id, AssetBlock.policy == policy, Asset.kind == "bess"))
    for row, asset in rows:
        p = asset.params
        low, high = p["energy_mwh"] * p["soc_min_pct"] / 100, p["energy_mwh"] * p["soc_max_pct"] / 100
        if not low - TOLERANCE <= row.soc_mwh <= high + TOLERANCE:
            out.append(f"{asset.name} charge {row.soc_mwh:.2f} MWh outside {low:g}–{high:g} in block {row.block}")
        if abs(row.actual_mw) > asset.capacity_mw + TOLERANCE:
            out.append(f"{asset.name} at {row.actual_mw:.2f} MW above its {asset.capacity_mw:g} MW in block {row.block}")
    for row in db.scalars(select(LineBlock).where(LineBlock.run_id == run.id, LineBlock.policy == policy,
                                                  func.abs(LineBlock.flow_mw) > LineBlock.limit_mw + TOLERANCE)):
        out.append(f"Line flow {row.flow_mw:.1f} MW above its {row.limit_mw:g} MW limit in block {row.block}")
    return out


def result(db: Session, study: Study) -> dict:
    replays = list(db.scalars(select(Run).where(Run.study_id == study.id).order_by(Run.id)))
    seeds, done = [], [r for r in replays if r.status == "done"]
    for r in replays:
        row = {"seed": r.config["seed"], "progress": (r.current_block + 1) / r.total_blocks, "done": r.status == "done"}
        if row["done"]:
            totals = summary(db, r)
            row.update(bob=totals.bob.model_dump(), baseline=totals.baseline.model_dump(), saving_inr=totals.saving_inr,
                       violations=violations(db, r))
        seeds.append(row)
    ids = [r.id for r in done]
    finished = [s for s in seeds if s["done"]]
    return {
        "id": study.id, "preset": study.preset, "seeds": seeds, "created_at": study.created_at,
        "created_by": study.created_by, "metrics": METRICS,
        "reliability": {
            "replays_done": len(done),
            "hard_limit_violations": sum(len(s["violations"]) for s in finished),
            "unserved_mwh": {p: round(sum(s[p]["unserved_mwh"] for s in finished), 3) for p in ("bob", "baseline")},
            "safe_holds": db.scalar(select(func.count()).select_from(Cycle).where(
                Cycle.run_id.in_(ids), Cycle.status == "safe_hold")) if ids else 0,
            "approvals_expired": db.scalar(select(func.count()).select_from(Action).where(
                Action.run_id.in_(ids), Action.status == "expired")) if ids else 0,
        },
    }


def bob_calls(db: Session) -> dict:
    """How BOB's model calls ended across live runs, failures counted by cause."""
    rows = db.execute(select(AgentCall.purpose, AgentCall.outcome, AgentCall.error, AgentCall.latency_ms)
                      .join(Run, Run.id == AgentCall.run_id).where(Run.study_id.is_(None))).all()
    latencies = sorted(r.latency_ms for r in rows if r.outcome == "ok")
    return {
        "calls": len(rows),
        "ok": len(latencies),
        "by_purpose": dict(Counter(r.purpose for r in rows)),
        "failures": dict(Counter((r.error or "unknown").split(":")[0] for r in rows if r.outcome != "ok")),
        "median_ms": latencies[len(latencies) // 2] if latencies else None,
    }
