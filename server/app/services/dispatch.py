"""Per-block decisions and settlement for both policies: BOB (optimiser) and today's practice."""

import time
from dataclasses import asdict
from datetime import datetime, timedelta
from typing import NamedTuple
from zoneinfo import ZoneInfo

import numpy as np
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.agent import cycle as agent_cycle, llm
from app.models.portfolio import Asset, DataSource
from app.models.run import Action, AssetBlock, Constraint, Cycle, Forecast, LineBlock, Plan, Run, SystemBlock
from app.optimize import baseline
from app.optimize.dispatch import MIN_MW, Inputs, discharge_history, here_and_now, plan
from app.optimize.profiles import BALANCED
from app.optimize.situation import assess, choose_mode, to_json
from app.optimize.validator import check
from app.services import configs, maintenance, policy
from app.services.deliberation import Deliberation
from app.sim.adapters import deliver
from app.sim.market import dsm_inr
from app.sim.plant import Setpoints, settle
from app.sim.world import World

IST = ZoneInfo("Asia/Kolkata")

DT = 0.25
BLOCK_SPAN = timedelta(minutes=15)
STORM_LEAD_BLOCKS = 24  # a storm within six hours is a material signal
RTM_SIGN = {"rtm_buy": 1.0, "rtm_sell": -1.0}


def _previous(db: Session, run: Run, policy: str, block: int) -> dict[int, AssetBlock]:
    rows = db.scalars(select(AssetBlock).where(
        AssetBlock.run_id == run.id, AssetBlock.policy == policy, AssetBlock.block == block))
    return {r.asset_id: r for r in rows}


def _soc(ctx, run: Run, previous: dict[int, AssetBlock], code: str) -> float:
    row = previous.get(ctx.asset_ids[code])
    if row is not None:
        return row.soc_mwh
    asset = next(a for a in ctx.assets if a.code == code)
    return asset.params["energy_mwh"] * run.config["initial_soc_pct"][code] / 100


def connected(db: Session, run: Run) -> set[str]:
    """Codes of the assets at sites with a connected telemetry API."""
    return set(db.scalars(select(Asset.code).join(DataSource, DataSource.site_id == Asset.site_id)
                          .where(Asset.portfolio_id == run.portfolio_id, DataSource.kind == "api")))


def readings(db: Session, ctx, run: Run, block: int) -> dict[str, float]:
    """What connected sites' feeds report for a settled block: each asset's available MW. Assets
    out for maintenance are left out; BOB already knows why they read zero."""
    rows, down, linked = _previous(db, run, "bob", block), maintenance.down(db, run, "bob", block), connected(db, run)
    return {a.code: rows[ctx.asset_ids[a.code]].available_mw for a in ctx.assets
            if a.code in linked and ctx.asset_ids[a.code] in rows and ctx.asset_ids[a.code] not in down}


def surprises(db: Session, ctx, run: Run, block: int, made_for: dict) -> list[str]:
    """Connected plants whose output in a settled block came in well off the forecast made for it."""
    out = []
    capacity = {a.code: a.capacity for a in ctx.assets}
    for code, mw in readings(db, ctx, run, block).items():
        f = made_for.get(("re_avail", code))
        if f is not None and abs(gap := mw - f.p50[0]) > max(2.0, 0.1 * capacity[code]):
            out.append(f"{ctx.names[code]} {abs(gap):.1f} MW {'above' if gap > 0 else 'below'} forecast")
    return out


def _discharged_today(db: Session, ctx, run: Run, t0: int) -> dict[str, float]:
    rows = db.execute(select(AssetBlock.asset_id, AssetBlock.actual_mw).where(
        AssetBlock.run_id == run.id, AssetBlock.policy == "bob", AssetBlock.block >= t0 - t0 % 96,
        AssetBlock.block < t0, AssetBlock.actual_mw > 0,
        AssetBlock.asset_id.in_([ctx.asset_ids[a.code] for a in ctx.assets if a.kind == "bess"])))
    used = {a.code: 0.0 for a in ctx.assets if a.kind == "bess"}
    code_of = {i: c for c, i in ctx.asset_ids.items()}
    for asset_id, mw in rows:
        used[code_of[asset_id]] += mw * DT
    return used


RECENT_BLOCKS = 16  # the longest discharge a configuration may allow: 240 minutes


def _recent(db: Session, ctx, run: Run, t0: int) -> tuple[dict[str, np.ndarray], np.ndarray]:
    """Each battery's measured discharge, and the portfolio's measured load minus renewable
    availability, in the blocks before t0, oldest first."""
    start = max(t0 - RECENT_BLOCKS, 0)
    kind = {a.code: a.kind for a in ctx.assets}
    code_of = {i: c for c, i in ctx.asset_ids.items()}
    discharge = {a.code: np.zeros(t0 - start) for a in ctx.assets if a.kind == "bess"}
    deficit = np.zeros(t0 - start)
    for block, asset_id, available, actual in db.execute(
            select(AssetBlock.block, AssetBlock.asset_id, AssetBlock.available_mw, AssetBlock.actual_mw).where(
                AssetBlock.run_id == run.id, AssetBlock.policy == "bob", AssetBlock.block >= start,
                AssetBlock.block < t0)):
        code, i = code_of[asset_id], block - start
        if kind[code] == "bess":
            discharge[code][i] = max(actual, 0.0)
        elif kind[code] == "consumer":
            deficit[i] += available
        elif kind[code] in ("solar", "wind"):
            deficit[i] -= available
    return discharge, deficit


def _actions(db: Session, run: Run, policy: str, blocks: tuple[int, int], kinds: tuple[str, ...]) -> list[Action]:
    return list(db.scalars(select(Action).where(
        Action.run_id == run.id, Action.policy == policy, Action.block >= blocks[0], Action.block < blocks[1],
        Action.kind.in_(kinds), Action.status.in_(("acked", "verified")))))


def schedule(db: Session, run: Run, policy: str, start: int, length: int) -> np.ndarray:
    """Day-ahead position plus RTM trades already cleared, MW net import per block."""
    out = np.array(run.dam_schedule[start:start + length], dtype=float)
    for a in _actions(db, run, policy, (start, start + length), tuple(RTM_SIGN)):
        out[a.block - start] += RTM_SIGN[a.kind] * a.delivered_mw
    return out


def _send(db: Session, run: Run, policy: str, cycle_id: int | None, block: int, kind: str,
          asset_id: int | None, code: str, mw: float, reason: str | None, tier: str = "auto",
          deadline=None) -> None:
    """Record an action; automatic ones go straight to the downstream system."""
    # A gated action and the fallback's automatic one of the same kind are different instructions.
    key = f"{run.id}:{policy}:{block}:{kind}:{code}:{cycle_id or 0}" + ("" if tier == "auto" else f":{tier}")
    status = {"auto": "acked", "approval": "awaiting_approval", "recommend": "recommended", "prohibited": "rejected"}
    action = Action(run_id=run.id, policy=policy, cycle_id=cycle_id, block=block, kind=kind, asset_id=asset_id,
                    mw=round(mw, 3), idempotency_key=key, status=status[tier], tier=tier, reason=reason,
                    deadline_at=deadline)
    if tier == "auto":
        action.delivered_mw = round(deliver(kind, mw, key, run.config), 3)
    db.add(action)


class Known(NamedTuple):
    """Something BOB knows limits the plan: from telemetry, the grid operator, a document or its own schedule."""

    kind: str  # storm | line_derate | asset_outage | curtailment_order
    targets: list[str]
    value: float | None
    start_at: datetime
    end_at: datetime


def knowledge(db: Session, ctx, run: Run) -> list[Known]:
    """Battery trips and derates are known the moment they happen; storms once revealed (by a
    forecast) or read from a document; BOB's own maintenance as scheduled."""
    out = []
    for e in ctx.events:
        end = e.sim_at + timedelta(minutes=e.payload.get("minutes", 0))
        if e.kind == "bess_trip" and e.fired_at:
            out.append(Known("asset_outage", [e.payload["asset"]], None, e.sim_at, end))
        elif e.kind == "line_derate" and e.fired_at:
            out.append(Known("line_derate", [e.payload["line"]], e.payload["limit_mw"], e.sim_at, end))
        elif e.kind == "storm" and e.revealed:
            out.append(Known("storm", [e.payload["node"]], None, e.sim_at, end))
    out += [Known(c.kind, c.targets, c.value, c.start_at, c.end_at) for c in db.scalars(
        select(Constraint).where(Constraint.run_id == run.id, Constraint.status == "active"))]
    code_of = {i: c for c, i in ctx.asset_ids.items()}
    out += [Known("asset_outage", [code_of[t.asset_id]], None, t.scheduled_at,
                  t.scheduled_at + t.duration_blocks * BLOCK_SPAN) for t in maintenance.tasks(db, run)]
    return out


def _blocks(run: Run, k: Known, t0: int) -> tuple[int, int]:
    """The blocks, relative to t0, that something known covers."""
    return (int((k.start_at - run.sim_start_at) / BLOCK_SPAN) - t0,
            int(np.ceil((k.end_at - run.sim_start_at) / BLOCK_SPAN)) - t0)


def storms(run: Run, known: list[Known], t0: int) -> list[tuple[str, int, int]]:
    return [(node, *_blocks(run, k, t0)) for k in known if k.kind == "storm" for node in k.targets]


def bob_inputs(db: Session, ctx, truth: World, run: Run, t0: int, forecasts: dict) -> Inputs:
    horizon = min(96, run.total_blocks - t0)
    previous = _previous(db, run, "bob", t0 - 1)
    of_kind = lambda *kinds: [a for a in ctx.assets if a.kind in kinds]  # noqa: E731
    p50 = lambda series, code=None: np.array(forecasts[(series, code)].p50[:horizon])  # noqa: E731
    committed = {a.code: np.full(horizon, np.nan) for a in of_kind("consumer")}
    for action in _actions(db, run, "bob", (t0, t0 + horizon), ("dr_call",)):
        code = next(c for c, i in ctx.asset_ids.items() if i == action.asset_id)
        committed[code][action.block - t0] = action.mw
    bess_available = {a.code: np.ones(horizon) for a in of_kind("bess")}
    available = {**{a.code: p50("re_avail", a.code) for a in of_kind("solar", "wind")},
                 **{a.code: p50("load", a.code) for a in of_kind("consumer")}}
    line_limit = dict(ctx.line_limits)
    kind_of = {a.code: a.kind for a in ctx.assets}
    # BOB commands only the assets of sites whose telemetry it receives; market trades are the portfolio's.
    linked = connected(db, run) | {"portfolio"}
    allowed = {k: v for k, v in policy.allowed(db, run.portfolio_id).items() if k.split(":")[1] in linked}
    for k in knowledge(db, ctx, run):
        begin, end = _blocks(run, k, t0)
        now = slice(max(begin, 0), min(end, horizon))
        if now.start >= now.stop:
            continue
        if k.kind == "asset_outage":
            for code in k.targets:
                (bess_available if kind_of[code] == "bess" else available)[code][now] = 0.0
        elif k.kind == "curtailment_order":
            for code in k.targets:
                available[code][now] = np.minimum(available[code][now], k.value)
        elif k.kind == "storm":  # wind turbines cut out; solar keeps a fifth of its output
            for a in (a for a in ctx.assets if a.node in k.targets and a.kind in ("solar", "wind")):
                available[a.code][now] *= 0.0 if a.kind == "wind" else 0.2
        elif k.kind == "line_derate" and begin <= 0:  # one limit per line: the one in force now
            for code in k.targets:
                line_limit[code] = k.value
    recent_discharge, recent_deficit = _recent(db, ctx, run, t0)
    return Inputs(
        assets=ctx.assets, lines=ctx.lines, line_limit=line_limit, available=available,
        bess_available=bess_available,
        soc_mwh={a.code: _soc(ctx, run, previous, a.code) for a in of_kind("bess")},
        price=p50("rtm_price"), emission=truth.emission_factor[t0:t0 + horizon],
        frequency=float(truth.frequency[max(t0 - 1, 0)]), hour=truth.hour[t0:t0 + horizon],
        schedule=schedule(db, run, "bob", t0, horizon), committed_dr=committed,
        blocks_left_today=96 - t0 % 96,
        discharged_today_mwh=_discharged_today(db, ctx, run, t0),
        dr_called_today_mwh={
            a.code: DT * sum(x.mw for x in _actions(db, run, "bob", (t0 - t0 % 96, t0), ("dr_call",))
                             if x.asset_id == ctx.asset_ids[a.code])
            for a in of_kind("consumer")
        },
        recent_discharge_mw=recent_discharge,
        recent_deficit_mw=recent_deficit,
        shifted_today_mwh={
            a.code: DT * sum(x.delivered_mw for x in _actions(db, run, "bob", (t0 - t0 % 96, t0), ("load_shift",))
                             if x.asset_id == ctx.asset_ids[a.code])
            for a in of_kind("consumer")
        },
        market=ctx.market, profile=BALANCED, allowed=allowed, protected=ctx.protected,
    )


def _spike_ahead(ctx, run: Run, t0: int) -> str | None:
    """An announced (revealed) price spike whose window has not passed."""
    now = (run.sim_start_at + t0 * BLOCK_SPAN).astimezone(IST)
    for e in ctx.events:
        p = e.payload
        if (e.kind == "price_spike" and e.revealed and e.sim_at.astimezone(IST).date() == now.date()
                and now.hour < p["to_hh"]):
            return f"×{p['mult']} between {p['from_hh']:02d}:00 and {p['to_hh']:02d}:00"
    return None


def plan_bob(db: Session, ctx, truth: World, run: Run, t0: int, forecasts: dict, decided_at,
             trigger: str = "tick", detail: str = "") -> None:
    started = time.perf_counter()
    inputs = bob_inputs(db, ctx, truth, run, t0, forecasts)
    horizon = len(inputs.price)
    # The nearest storm BOB knows of that has not passed.
    storm = next(((node, max(begin, 0), min(end, horizon))
                  for node, begin, end in storms(run, knowledge(db, ctx, run), t0) if end > 0 and begin < horizon), None)
    # Day-ahead prices are known once the day-ahead market clears.
    signals = assess(inputs, ctx.line_limits, truth.dam[t0:t0 + horizon],
                     storm is not None and storm[1] < STORM_LEAD_BLOCKS, _spike_ahead(ctx, run, t0))
    d = Deliberation(inputs, signals, forecasts, storm, live=t0 >= run.live_from_block)
    previous = db.scalar(select(Cycle).where(Cycle.run_id == run.id).order_by(Cycle.id.desc()).limit(1))
    seen = {s["code"] for s in previous.situation if s["material"]} if previous else None
    if previous and previous.mode_by == "bob" and seen == d.material:
        d.set_mode(previous.mode, "bob", previous.mode_reason)  # BOB's call stands until the situation changes
    else:
        mode, reason = choose_mode(signals, ctx.default_mode)
        d.set_mode(mode, "rule" if mode != ctx.default_mode else "operator", reason)

    seq = db.scalar(select(func.count()).select_from(Cycle).where(Cycle.run_id == run.id, Cycle.block == t0))
    cycle = Cycle(run_id=run.id, block=t0, seq=seq, trigger=trigger, trigger_detail=detail, status="planned",
                  situation=to_json(signals), mode=d.mode, mode_by=d.mode_by, timings={})
    db.add(cycle)
    db.flush()
    timings = {}
    # BOB is asked when something material happens: an event, a watch hit or a changed situation.
    if d.live and (trigger != "tick" or seen != d.material) and llm.ready():
        timings["agent"] = agent_cycle.decide(db, ctx, run, t0, cycle.id, d, trigger, detail)
    d.finish()
    timings["solve_ms"] = round((time.perf_counter() - started) * 1000)
    cycle.status = "planned" if d.chosen else "safe_hold"
    cycle.mode, cycle.mode_by, cycle.mode_reason, cycle.floors = d.mode, d.mode_by, d.mode_reason, d.floors
    cycle.scenarios = list(d.robust[d.chosen]) if d.robust and d.chosen else []
    cycle.rationale, cycle.selected_by, cycle.timings = d.rationale, d.selected_by, timings
    rounded = lambda arrays: {k: np.round(v, 2).tolist() for k, v in arrays.items()}  # noqa: E731
    db.add_all(
        Plan(cycle_id=cycle.id, variant=name, role="selected" if name == d.chosen else "candidate", kpis=p.kpis,
             schedule={"start_block": t0, "generation": rounded(p.generation), "battery": rounded(p.battery),
                       "soc": rounded(p.soc), "demand_response": rounded(p.demand_response),
                       "shift": rounded(p.shift), "rtm": np.round(p.rtm, 2).tolist(),
                       "here_and_now": asdict(here_and_now(p, d.inputs))},
             solver={"status": p.status, "objective": p.objective, "gap": p.gap},
             robust=d.robust[name] if d.robust else None)
        for name, p in d.options.items()
    )
    run.mode_code, run.mode_by = d.mode, d.mode_by
    # A re-plan replaces earlier cycles' decisions for this block that are not commitments yet:
    # setpoints for the block, and anything still awaiting approval or only recommended.
    # Trades and demand-response calls already sent stay; they are commitments.
    earlier = select(Cycle.id).where(Cycle.run_id == run.id, Cycle.block == t0, Cycle.id != cycle.id)
    db.execute(update(Action).where(
        Action.cycle_id.in_(earlier),
        ((Action.block == t0) & Action.kind.in_(("bess_charge", "bess_discharge", "curtail", "load_shift"))
         & (Action.status == "acked")) | Action.status.in_(("awaiting_approval", "recommended")),
    ).values(status="superseded"))
    if d.chosen:
        _dispatch(db, ctx, run, cycle.id, t0, d.options[d.chosen], d.inputs, decided_at)


def _items(h, inputs: Inputs, ctx, t0: int) -> list[dict]:
    """The here-and-now decisions as actions: kind, asset, delivery block, MW, and the size the
    policy limits apply to (for an output limit, the MW curtailed)."""
    assets = {a.code: a for a in ctx.assets}
    out = []
    for code, mw in h.battery.items():
        kind = "bess_discharge" if mw > 0 else "bess_charge"
        out.append(dict(kind=kind, code=code, block=t0, mw=abs(mw), size=abs(mw), safety=check(
            kind, abs(mw), assets[code], soc_mwh=inputs.soc_mwh[code], available=bool(inputs.bess_available[code][0]),
            **discharge_history(inputs, code))))
    for code, cap in h.output_cap.items():
        out.append(dict(kind="curtail", code=code, block=t0, mw=cap, size=float(inputs.available[code][0]) - cap,
                        safety=check("curtail", cap, assets[code])))
    for code, mw in h.demand_response.items():
        notice = assets[code].params["dr_notice_blocks"]
        out.append(dict(kind="dr_call", code=code, block=t0 + notice, mw=mw, size=mw,
                        safety=check("dr_call", mw, assets[code], lead_blocks=notice)))
    for code, mw in h.shift.items():
        out.append(dict(kind="load_shift", code=code, block=t0, mw=mw, size=abs(mw),
                        safety=check("load_shift", abs(mw), assets[code])))
    if h.rtm:
        kind = "rtm_buy" if h.rtm > 0 else "rtm_sell"
        out.append(dict(kind=kind, code="portfolio", block=t0 + ctx.market["gate_blocks"], mw=abs(h.rtm),
                        size=abs(h.rtm), safety=check(kind, abs(h.rtm), None, trade_cap_mw=_trade_cap(ctx))))
    return out


def _dispatch(db: Session, ctx, run: Run, cycle_id: int, t0: int, chosen, inputs: Inputs, decided_at) -> None:
    """Send the chosen plan's automatic actions. Gated ones wait for approval (or are only
    recommended) while a fallback plan runs that does only what BOB may do alone; execution never
    waits for a person. An approval later replaces the fallback's action of the same kind."""
    items = _items(here_and_now(chosen, inputs), inputs, ctx, t0)
    for item in items:
        item["tier"], item["why"] = (("prohibited", item["safety"]) if item["safety"] else
                                     policy.tier(item["kind"], item["code"], item["size"], inputs.allowed,
                                                 inputs.protected))
    gated = [i for i in items if i["tier"] in ("approval", "recommend")]
    if gated:
        fallback = plan(inputs, most={policy.key(i["kind"], i["code"]): policy.authority(
            i["kind"], i["code"], inputs.allowed, inputs.protected) for i in gated})
        runs_now = _items(here_and_now(fallback, inputs), inputs, ctx, t0) if fallback.battery else []
        for i in runs_now:
            i["tier"], i["why"] = (("prohibited", i["safety"]) if i["safety"] else
                                   policy.tier(i["kind"], i["code"], i["size"], inputs.allowed, inputs.protected))
        items = [i for i in items if i["tier"] != "auto"] + [i for i in runs_now if i["tier"] == "auto"]
    block_end = run.sim_start_at + (t0 + 1) * BLOCK_SPAN
    for i in items:
        deadline = None
        if i["tier"] == "approval":
            response = inputs.allowed.get(policy.key(i["kind"], i["code"]), {}).get("response_min", 10)
            deadline = min(block_end, decided_at + timedelta(minutes=response))
        asset_id = ctx.asset_ids.get(i["code"])
        _send(db, run, "bob", cycle_id, i["block"], i["kind"], asset_id, i["code"], i["mw"], i["why"], i["tier"],
              deadline)


def _trade_cap(ctx) -> float:
    return sum(a.params["import_max_mw"] + a.params["export_max_mw"] for a in ctx.assets if a.kind == "interconnection")


def plan_baseline(db: Session, ctx, truth: World, run: Run, t0: int, forecasts: dict) -> None:
    previous = _previous(db, run, "baseline", t0 - 1)
    hour = float(truth.hour[t0])
    for a in (a for a in ctx.assets if a.kind == "bess"):
        available = previous[ctx.asset_ids[a.code]].available_mw > 0 if previous else True
        soc = _soc(ctx, run, previous, a.code)
        mw = baseline.battery_mw(a, soc, hour, available)
        if abs(mw) >= MIN_MW:
            kind = "bess_discharge" if mw > 0 else "bess_charge"
            _send(db, run, "baseline", None, t0, kind, ctx.asset_ids[a.code], a.code, abs(mw), None)
    target = t0 + ctx.market["gate_blocks"]
    if target < run.total_blocks:
        i = ctx.market["gate_blocks"]  # forecast issued at t0-1 covers t0.., so index gate is the target
        net = (sum(forecasts[("load", a.code)].p50[i] for a in ctx.assets if a.kind == "consumer")
               - sum(forecasts[("re_avail", a.code)].p50[i] for a in ctx.assets if a.kind in ("solar", "wind")))
        trade = baseline.rtm_trade(net, float(schedule(db, run, "baseline", target, 1)[0]), ctx.market, _trade_cap(ctx))
        if trade:
            _send(db, run, "baseline", None, target, "rtm_buy" if trade > 0 else "rtm_sell", None, "portfolio",
                  abs(trade), None)


def latest_forecasts(db: Session, ctx, run: Run, t0: int) -> dict:
    """Forecasts issued at the end of the previous block, keyed by (series, asset code)."""
    rows = db.scalars(select(Forecast).where(Forecast.run_id == run.id, Forecast.issued_block == t0 - 1))
    code_of = {i: c for c, i in ctx.asset_ids.items()}
    return {(f.series, code_of.get(f.asset_id)): f for f in rows}


def plan_block(db: Session, ctx, truth: World, run: Run, t0: int) -> None:
    forecasts = latest_forecasts(db, ctx, run, t0)
    hits, gaps = [], []
    if t0 > 0:  # the block just settled, against the forecast made for it: watch conditions and surprises
        made_for = latest_forecasts(db, ctx, run, t0 - 1)
        hits = configs.watch_hits(db, run, t0 - 1, {code: f.p50[0] for (series, code), f in made_for.items()
                                                    if series == "re_avail"})
        gaps = surprises(db, ctx, run, t0 - 1, made_for)
    now = run.sim_start_at + t0 * BLOCK_SPAN
    plan_bob(db, ctx, truth, run, t0, forecasts, now, trigger="watch" if hits else "telemetry" if gaps else "tick",
             detail="; ".join(hits + gaps)[:200])
    plan_baseline(db, ctx, truth, run, t0, forecasts)
    if t0 < run.live_from_block:
        return  # proposals need someone to answer them: none before the demo opens
    known = storms(run, knowledge(db, ctx, run), t0)
    if t0 % 4 == 0:  # hourly
        maintenance.review(db, ctx, run, t0, forecasts, known, now)
    # Damage shows against what the weather allows, not against forecasts the feeds have already pulled down.
    weather = ctx.world(revealed_only=True)
    expected = {b: {a.code: float(weather.available[a.code][b]) for a in ctx.assets if a.kind in ("solar", "wind")}
                for b in (t0 - 1, t0 - 2) if b >= 1}
    maintenance.inspect(db, ctx, run, t0, known, expected, now)


def settle_block(db: Session, ctx, truth: World, run: Run, b: int, policy: str) -> None:
    previous = _previous(db, run, policy, b - 1)
    code_of = {i: c for c, i in ctx.asset_ids.items()}
    assets = {a.code: a for a in ctx.assets}
    available = {code: float(series[b]) for code, series in truth.available.items()}
    for asset_id in maintenance.down(db, run, policy, b):
        available[code_of[asset_id]] = 0.0
    actions = list(db.scalars(select(Action).where(
        Action.run_id == run.id, Action.policy == policy, Action.block == b, Action.status == "acked")))
    setpoints = Setpoints()
    soc_before = {}
    for a in (a for a in ctx.assets if a.kind == "bess"):
        soc_before[a.code] = _soc(ctx, run, previous, a.code)
    for action in actions:
        code = code_of.get(action.asset_id)
        if action.kind in ("bess_charge", "bess_discharge"):
            a, mw = assets[code], action.delivered_mw * (1 if action.kind == "bess_discharge" else -1)
            if available[code] <= 0:
                mw = 0.0  # a tripped battery does nothing
            p, soc = a.params, soc_before[code]
            # The battery's own controls stop it at its state-of-charge limits.
            mw = min(mw, (soc - p["energy_mwh"] * p["soc_min_pct"] / 100) * p["eta_d"] / DT)
            mw = max(mw, -(p["energy_mwh"] * p["soc_max_pct"] / 100 - soc) / (p["eta_c"] * DT))
            setpoints.battery_mw[code] = mw
        elif action.kind == "curtail":
            setpoints.gen_cap_mw[code] = action.delivered_mw
        elif action.kind in ("dr_call", "load_shift"):
            setpoints.load_change_mw[code] = setpoints.load_change_mw.get(code, 0.0) - action.delivered_mw
    limits = {code: float(series[b]) for code, series in truth.line_limit.items()}
    for a in ctx.assets:
        if a.kind == "interconnection":
            available[a.code] = 0.0
    s = settle(ctx.assets, ctx.lines, available, limits, setpoints)

    rows = []
    wear = 0.0
    for a in ctx.assets:
        soc = None
        if a.kind == "bess":
            mw = s.actual[a.code]
            p = a.params
            soc = soc_before[a.code] + DT * (p["eta_c"] * max(-mw, 0) - max(mw, 0) / p["eta_d"])
            wear += max(mw, 0) * DT * p["deg_cost_inr_mwh"]
        rows.append(AssetBlock(run_id=run.id, policy=policy, block=b, asset_id=ctx.asset_ids[a.code],
                               available_mw=available[a.code], actual_mw=s.actual[a.code], soc_mwh=soc))
    db.add_all(rows)
    db.add_all(LineBlock(run_id=run.id, policy=policy, block=b, line_id=ctx.line_ids[code],
                         limit_mw=limits[code], flow_mw=flow) for code, flow in s.flow.items())

    ics = [a for a in ctx.assets if a.kind == "interconnection"]
    net = sum(s.actual[a.code] for a in ics)
    imports = sum(max(s.actual[a.code], 0) for a in ics)
    planned = float(schedule(db, run, policy, b, 1)[0])
    rtm_mw = planned - run.dam_schedule[b]
    price, freq = float(truth.rtm[b]), float(truth.frequency[b])
    market = (run.dam_schedule[b] * float(truth.dam[b]) + rtm_mw * price) * DT
    dsm = dsm_inr(net - planned, planned, price, freq, ctx.market, DT)
    dr = sum(
        action.delivered_mw * DT * (assets[code_of[action.asset_id]].params["dr_incentive_inr_mwh"]
                                    if action.kind == "dr_call"
                                    else assets[code_of[action.asset_id]].params["shift_cost_inr_mwh"])
        for action in actions if action.kind in ("dr_call", "load_shift") and action.delivered_mw > 0
    )
    curtail = sum((available[a.code] - s.actual[a.code]) * DT * a.params["curtail_comp_inr_mwh"]
                  for a in ctx.assets if a.kind in ("solar", "wind"))
    db.add(SystemBlock(
        run_id=run.id, policy=policy, block=b, frequency_hz=freq, dam_price=float(truth.dam[b]), rtm_price=price,
        emission_factor=float(truth.emission_factor[b]), net_exchange_mw=net, schedule_mw=planned,
        deviation_mw=net - planned, market_inr=market, dsm_inr=dsm, dr_inr=dr, wear_inr=wear,
        curtail_inr=curtail, cost_inr=market + dsm + dr + wear + curtail,
        carbon_t=imports * float(truth.emission_factor[b]) * DT,
        curtailed_mwh=s.curtailed_mw * DT, unserved_mwh=s.unserved_mw * DT,
    ))
    for action in actions:  # batteries and plants are measured; trades and load changes are as delivered
        code = code_of.get(action.asset_id)
        measured = action.kind in ("bess_charge", "bess_discharge", "curtail")
        action.actual_mw = abs(s.actual[code]) if measured else action.delivered_mw
        action.status = "verified"
