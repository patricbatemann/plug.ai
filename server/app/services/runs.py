import copy
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models.portfolio import Asset, Line, Node, Portfolio
from app.models.run import POLICIES, Forecast, Run, WorldEvent
from app.sim import forecast
from app.services import policy
from app.services.dispatch import latest_forecasts, plan_block, plan_bob, settle_block
from app.sim.plant import LineSpec
from app.sim.presets import PRESETS
from app.sim.world import BLOCK_MIN, BLOCKS_PER_DAY, AssetSpec, EventSpec, World

IST = ZoneInfo("Asia/Kolkata")
BLOCK = timedelta(minutes=BLOCK_MIN)


def _at(config: dict[str, Any], hhmm: str) -> datetime:
    return datetime.fromisoformat(f"{config['date']}T{hhmm}").replace(tzinfo=IST)


def create_run(db: Session, portfolio: Portfolio, preset: str, now: datetime) -> Run:
    """Start a run from a preset; the demo drives one run at a time, so others are ended."""
    db.execute(update(Run).where(Run.status != "done").values(status="done"))
    config = copy.deepcopy(PRESETS[preset])
    start = _at(config, config["start"])
    run = Run(
        portfolio_id=portfolio.id, preset=preset, config=config, status="running", speed=config["speed"],
        sim_start_at=start, total_blocks=config["days"] * BLOCKS_PER_DAY,
        live_from_block=(_at(config, config["live_from"]) - start) // BLOCK,
        current_block=-1, block_started_at=now, next_due_at=now, dam_schedule=[],
    )
    db.add(run)
    db.flush()
    db.add_all(
        WorldEvent(run_id=run.id, sim_at=_at(config, e["at"]), kind=e["kind"], payload=e["payload"], source="scenario")
        for e in config["events"]
    )
    db.flush()
    ctx = RunContext.load(db, run)
    # The day-ahead position comes from forecasts made before the run starts.
    issues = _store_forecasts(db, ctx, -1, horizon=run.total_blocks)
    p50 = {(i.series, i.asset_code): np.array(i.p50) for i in issues}
    net = (sum(p50[("load", a.code)] for a in ctx.assets if a.kind == "consumer")
           - sum(p50[("re_avail", a.code)] for a in ctx.assets if a.kind in ("solar", "wind")))
    ics = [a.params for a in ctx.assets if a.kind == "interconnection"]
    run.dam_schedule = np.clip(net, -sum(p["export_max_mw"] for p in ics),
                               sum(p["import_max_mw"] for p in ics)).round(2).tolist()
    db.flush()
    plan_block(db, ctx, ctx.world(), run, 0)
    db.commit()
    return run


def is_live(run: Run) -> bool:
    return run.current_block + 1 >= run.live_from_block


def sim_now(run: Run, now: datetime) -> datetime:
    """Sim time: the start of the block in progress plus wall time elapsed at the run's speed."""
    block_start = run.sim_start_at + (run.current_block + 1) * BLOCK
    if run.status == "done" or not is_live(run):
        return block_start
    elapsed = ((run.paused_at or now) - run.block_started_at) * run.speed
    return block_start + min(elapsed, BLOCK)


def fire_events(db: Session, run: Run, until: datetime, now: datetime) -> list[WorldEvent]:
    """Mark events before `until` as fired and apply their reveal rules; returns those just fired."""
    due = db.scalars(
        select(WorldEvent).where(WorldEvent.run_id == run.id, WorldEvent.fired_at.is_(None), WorldEvent.sim_at < until)
    ).all()
    for event in due:
        event.fired_at = now
        if event.payload.get("reveal"):
            event.revealed = True
        if event.kind == "forecast_update":
            horizon = event.sim_at + timedelta(hours=event.payload.get("lookahead_h", 0))
            db.execute(
                update(WorldEvent)
                .where(WorldEvent.run_id == run.id, WorldEvent.sim_at <= horizon)
                .values(revealed=True)
            )
    return list(due)


# Events BOB can see the moment they happen (telemetry, grid-operator instructions, market
# announcements, new forecasts). Cloud banks and demand surges show up in telemetry at block end.
VISIBLE = {
    "bess_trip": lambda p: f"{p['asset']} tripped for {p['minutes']} min",
    "line_derate": lambda p: f"{p['line']} derated to {p['limit_mw']:g} MW",
    "price_spike": lambda p: f"Price spike announced, ×{p['mult']} {p['from_hh']:02d}:00–{p['to_hh']:02d}:00",
    "forecast_update": lambda p: "Forecasts updated",
    "storm": lambda p: f"Storm over {p['node']}",
    "frequency_dip": lambda p: f"Frequency at {p['hz']} Hz",
}


def replan_for_events(db: Session, run: Run, fired: list[WorldEvent], now: datetime) -> None:
    """Re-plan the block in progress when BOB learns of a material event. Caller holds the run lock."""
    visible = [e for e in fired if e.kind in VISIBLE and (e.kind != "storm" or e.revealed)]
    t0 = run.current_block + 1
    if not visible or not is_live(run) or t0 >= run.total_blocks:
        return
    db.flush()
    ctx = RunContext.load(db, run)
    if any(e.kind == "forecast_update" for e in visible):
        db.execute(delete(Forecast).where(Forecast.run_id == run.id, Forecast.issued_block == run.current_block))
        _store_forecasts(db, ctx, run.current_block)
    plan_bob(db, ctx, ctx.world(), run, t0, latest_forecasts(db, ctx, run, t0), sim_now(run, now),
             trigger="event", detail="; ".join(VISIBLE[e.kind](e.payload) for e in visible))


@dataclass
class RunContext:
    """Everything needed to rebuild the run's world from the database."""

    run: Run
    assets: list[AssetSpec]
    asset_ids: dict[str, int]
    lines: list[LineSpec]
    line_limits: dict[str, float]
    line_ids: dict[str, int]
    events: list[WorldEvent]
    market: dict[str, Any]
    default_mode: str  # the operator's mode when no signal calls for another
    protected: dict[str, Any]

    @classmethod
    def load(cls, db: Session, run: Run) -> "RunContext":
        nodes = dict(db.execute(select(Node.id, Node.code).where(Node.portfolio_id == run.portfolio_id)).all())
        assets = db.scalars(select(Asset).where(Asset.portfolio_id == run.portfolio_id, Asset.active)).all()
        lines = db.scalars(select(Line).where(Line.portfolio_id == run.portfolio_id)).all()
        events = db.scalars(select(WorldEvent).where(WorldEvent.run_id == run.id)).all()
        portfolio = db.get(Portfolio, run.portfolio_id)
        return cls(
            run=run,
            assets=[AssetSpec(a.code, a.kind, nodes[a.node_id], a.capacity_mw, a.params) for a in assets],
            asset_ids={a.code: a.id for a in assets},
            lines=[LineSpec(l.code, nodes[l.from_node_id], nodes[l.to_node_id]) for l in lines],
            line_limits={l.code: l.limit_mw for l in lines},
            line_ids={l.code: l.id for l in lines},
            events=list(events),
            market=portfolio.market,
            default_mode=portfolio.mode_code,
            protected=portfolio.protected,
        )

    def world(self, revealed_only: bool = False) -> World:
        start = self.run.sim_start_at.astimezone(IST)
        specs = [
            EventSpec(e.kind, (e.sim_at - self.run.sim_start_at).total_seconds() / 60, e.payload)
            for e in self.events if e.revealed or not revealed_only
        ]
        return World(self.run.config, self.assets, self.line_limits, start.hour * 60 + start.minute,
                     self.run.total_blocks + forecast.HORIZON + 1, specs)


def _store_forecasts(db: Session, ctx: "RunContext", block: int, horizon: int = forecast.HORIZON) -> list[forecast.Issue]:
    issues = forecast.issue(ctx.world(revealed_only=True), block, ctx.assets, ctx.run.config, horizon)
    db.add_all(
        Forecast(run_id=ctx.run.id, issued_block=block, series=i.series,
                 asset_id=ctx.asset_ids[i.asset_code] if i.asset_code else None, p10=i.p10, p50=i.p50, p90=i.p90)
        for i in issues
    )
    db.flush()
    return issues


def advance(db: Session, run: Run, now: datetime) -> None:
    """Settle the next block for both policies, issue forecasts after it, plan the block that
    follows, and move the clock. Caller holds the run lock."""
    b = run.current_block + 1
    if b >= run.total_blocks:
        run.status = "done"
        return
    fire_events(db, run, run.sim_start_at + (b + 1) * BLOCK, now)
    policy.expire(db, run, run.sim_start_at + (b + 1) * BLOCK)
    db.flush()
    ctx = RunContext.load(db, run)
    truth = ctx.world()
    for name in POLICIES:
        settle_block(db, ctx, truth, run, b, name)
    db.flush()
    _store_forecasts(db, ctx, b)
    if b + 1 < run.total_blocks:
        plan_block(db, ctx, truth, run, b + 1)
    run.current_block = b
    run.block_started_at = now
    if run.paused_at:
        run.paused_at = now
    # Blocks before `live_from` run back to back so a demo opens mid-morning.
    run.next_due_at = now + BLOCK / run.speed if is_live(run) else now


def claim_due_run(db: Session, now: datetime) -> Run | None:
    return db.scalar(
        select(Run)
        .where(Run.status == "running", Run.next_due_at <= now)
        .order_by(Run.next_due_at)
        .with_for_update(skip_locked=True)
        .limit(1)
    )


def tick(db: Session, now: datetime) -> bool:
    """One worker iteration: for each running run, expire late approvals and fire mid-block events
    (re-planning on visible ones); then advance one due run."""
    for run_id in db.scalars(select(Run.id).where(Run.status == "running")).all():
        run = db.scalar(select(Run).where(Run.id == run_id).with_for_update(skip_locked=True))
        if run is None:
            continue  # another worker has it
        sim = sim_now(run, now)
        policy.expire(db, run, sim)
        replan_for_events(db, run, fire_events(db, run, sim, now), now)
        db.commit()
    run = claim_due_run(db, now)
    if run is None:
        return False
    advance(db, run, now)
    db.commit()
    return True


def lock_run(db: Session, run_id: int) -> Run | None:
    return db.scalar(select(Run).where(Run.id == run_id).with_for_update())


def pause(run: Run, now: datetime) -> None:
    if run.status == "running":
        run.status, run.paused_at = "paused", now


def play(run: Run, now: datetime) -> None:
    if run.status == "paused" and run.paused_at:
        shift = now - run.paused_at
        run.block_started_at += shift
        run.next_due_at += shift
        run.status, run.paused_at = "running", None


def set_speed(run: Run, speed: float) -> None:
    run.speed = speed
    if is_live(run):
        run.next_due_at = run.block_started_at + BLOCK / speed


def inject(db: Session, run: Run, kind: str, payload: dict[str, Any], now: datetime) -> WorldEvent:
    event = WorldEvent(run_id=run.id, sim_at=sim_now(run, now), kind=kind, payload=payload, source="operator")
    db.add(event)
    db.flush()
    replan_for_events(db, run, fire_events(db, run, event.sim_at + timedelta(microseconds=1), now), now)
    return event


def check_references(db: Session, run: Run, payload: dict[str, Any]) -> None:
    """Reject injected events that name nodes, assets or lines the portfolio does not have."""
    nodes = set(db.scalars(select(Node.code).where(Node.portfolio_id == run.portfolio_id)))
    lines = set(db.scalars(select(Line.code).where(Line.portfolio_id == run.portfolio_id)))
    kinds = dict(db.execute(select(Asset.code, Asset.kind).where(Asset.portfolio_id == run.portfolio_id)).all())
    if "node" in payload and payload["node"] not in nodes:
        raise ValueError(f"Unknown node {payload['node']}")
    if "line" in payload and payload["line"] not in lines:
        raise ValueError(f"Unknown line {payload['line']}")
    if "asset" in payload and kinds.get(payload["asset"]) != "bess":
        raise ValueError(f"{payload['asset']} is not a battery")
    for code in payload.get("assets", []):
        if kinds.get(code) != "consumer":
            raise ValueError(f"{code} is not an industrial consumer")
