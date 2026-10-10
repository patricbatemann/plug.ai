"""Maintenance. BOB proposes moving its own jobs out of storm windows (crews
cannot work in them) or to hours where the lost output is worth ₹1 lakh less; a person approves.
Today's practice keeps the calendar. Inspections are proposed after storms and battery trips."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import numpy as np
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.run import Action, AssetBlock, MaintenanceTask, Run

IST = ZoneInfo("Asia/Kolkata")
BLOCK = timedelta(minutes=15)
MOVE_SAVING_INR = 100_000
RESPONSE = timedelta(minutes=60)
PR_LIMIT = 0.85  # actual / expected output that calls for an inspection
INSPECT_AFTER = range(2, 9)  # blocks after a storm in which output is checked


def start(task: MaintenanceTask, policy: str) -> datetime:
    return task.scheduled_at if policy == "bob" else task.calendar_at


def tasks(db: Session, run: Run) -> list[MaintenanceTask]:
    return list(db.scalars(select(MaintenanceTask).where(MaintenanceTask.run_id == run.id)
                           .order_by(MaintenanceTask.scheduled_at)))


def down(db: Session, run: Run, policy: str, block: int) -> set[int]:
    """Assets out for maintenance in a block, under that policy's schedule."""
    at = run.sim_start_at + block * BLOCK
    return {t.asset_id for t in tasks(db, run) if start(t, policy) <= at < start(t, policy) + t.duration_blocks * BLOCK}


def _hhmm(at: datetime) -> str:
    return at.astimezone(IST).strftime("%H:%M")


def _propose(db: Session, run: Run, t0: int, kind: str, asset_id: int, reason: str, deadline: datetime,
             params: dict, key: str) -> None:
    db.add(Action(run_id=run.id, policy="bob", block=t0, kind=kind, asset_id=asset_id, mw=0.0,
                  status="awaiting_approval", tier="approval", reason=reason[:200], deadline_at=deadline,
                  params=params, idempotency_key=f"{run.id}:{kind}:{key}"[:80]))


def review(db: Session, ctx, run: Run, t0: int, forecasts: dict, storms: list[tuple[str, int, int]],
           now: datetime) -> None:
    """Propose moving each generator job that has not started, if its start is in a known storm
    window or another start loses ₹1 lakh less output. `storms` are (node, start, end) blocks from t0."""
    code_of = {i: c for c, i in ctx.asset_ids.items()}
    nodes = {a.code: a.node for a in ctx.assets}
    price = np.array(forecasts[("rtm_price", None)].p50)
    for task in tasks(db, run):
        code = code_of[task.asset_id]
        rel = lambda at: int((at - run.sim_start_at) / BLOCK) - t0  # noqa: E731
        current, length = rel(task.scheduled_at), task.duration_blocks
        if current <= 0 or ("re_avail", code) not in forecasts:
            continue  # started, or not a generator
        output = np.array(forecasts[("re_avail", code)].p50)
        horizon = min(len(output), len(price))
        lost = lambda s: float(np.sum(output[s:s + length] * price[s:s + length]) * 0.25)  # noqa: E731
        clash = lambda s: any(node == nodes[code] and s < end and begin < s + length  # noqa: E731
                              for node, begin, end in storms)
        latest = min(rel(task.deadline_at), horizon) - length
        candidates = [s for s in range(max(rel(task.earliest_at), 1), latest + 1)
                      if not clash(s) and (not task.safety_critical or s <= current)]
        if not candidates:
            continue
        best = min(candidates, key=lost)
        in_storm = clash(current)
        known = current + length <= horizon
        if best == current or not (in_storm or (known and lost(current) - lost(best) > MOVE_SAVING_INR)):
            continue
        to = run.sim_start_at + (t0 + best) * BLOCK
        tried = db.scalars(select(Action).where(
            Action.run_id == run.id, Action.kind == "maintenance_schedule",
            Action.params["task_id"].as_integer() == task.id,
            Action.status.in_(("awaiting_approval", "declined", "expired")))).all()
        if any(a.params["start_at"] == to.isoformat() for a in tried):
            continue  # asked already: still open, or a person said no
        db.execute(update(Action).where(Action.id.in_([a.id for a in tried if a.status == "awaiting_approval"]))
                   .values(status="superseded"))
        why = (f"Crews cannot work in the storm window. Move to {_hhmm(to)}: ₹{lost(best):,.0f} of output lost "
               f"there" if in_storm else f"Move to {_hhmm(to)}: ₹{lost(best):,.0f} of output lost instead of "
               f"₹{lost(current):,.0f}")
        _propose(db, run, t0, "maintenance_schedule", task.asset_id,
                 f"{task.kind.capitalize()} job calendared {_hhmm(task.scheduled_at)}. {why}.",
                 min(now + RESPONSE, task.scheduled_at),
                 {"task_id": task.id, "start_at": to.isoformat()}, f"{task.id}:{to:%H%M}:{t0}")


def inspect(db: Session, ctx, run: Run, t0: int, storms: list[tuple[str, int, int]], expected: dict,
            now: datetime) -> None:
    """Propose an inspection once per asset: after a storm, when output stays below 85 % of what the
    weather allows for two blocks; and after a battery trip. `expected` maps block → {code: MW}."""
    asked = set(db.scalars(select(Action.asset_id).where(Action.run_id == run.id,
                                                         Action.kind == "inspection_dispatch")))
    asked |= down(db, run, "bob", t0 - 1) | down(db, run, "bob", t0 - 2)  # low output there is the job
    for node, _, end in storms:
        if -end not in INSPECT_AFTER:
            continue
        for a in (a for a in ctx.assets if a.node == node and a.kind in ("solar", "wind")):
            asset_id = ctx.asset_ids[a.code]
            # What the plant could produce: curtailment by the network is not damage.
            rows = {r.block: r.available_mw for r in db.scalars(select(AssetBlock).where(
                AssetBlock.run_id == run.id, AssetBlock.policy == "bob", AssetBlock.asset_id == asset_id,
                AssetBlock.block.in_((t0 - 1, t0 - 2))))}
            ratios = [rows[b] / expected[b][a.code] for b in (t0 - 1, t0 - 2)
                      if b in rows and expected.get(b, {}).get(a.code, 0) > 1]
            if asset_id not in asked and len(ratios) == 2 and max(ratios) < PR_LIMIT:
                asked.add(asset_id)
                _propose(db, run, t0, "inspection_dispatch", asset_id,
                         f"After the storm, {ctx.names[a.code]} gives {max(ratios):.0%} of expected output: "
                         f"send a crew to inspect for damage.", now + RESPONSE, {}, f"{a.code}:storm")
    for e in ctx.events:
        if e.kind == "bess_trip" and e.fired_at and ctx.asset_ids[e.payload["asset"]] not in asked:
            asset_id = ctx.asset_ids[e.payload["asset"]]
            asked.add(asset_id)
            _propose(db, run, t0, "inspection_dispatch", asset_id,
                     f"{ctx.names[e.payload['asset']]} tripped at {_hhmm(e.sim_at)}: inspect before it returns "
                     f"to service.", now + RESPONSE, {}, f"{e.payload['asset']}:trip:{e.id}")
