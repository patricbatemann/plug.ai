"""Per-block decisions and settlement for both policies: BOB (optimiser) and today's practice."""

import time
from datetime import datetime

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import Action, AssetBlock, Cycle, Forecast, LineBlock, Plan, Run, SystemBlock
from app.optimize import baseline
from app.optimize.dispatch import Inputs, plan
from app.optimize.profiles import BALANCED
from app.optimize.validator import check
from app.sim.adapters import deliver
from app.sim.market import dsm_inr
from app.sim.plant import Setpoints, settle
from app.sim.world import World

DT = 0.25
MIN_MW = 0.05  # smaller setpoints are noise, not actions
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
          asset_id: int | None, code: str, mw: float, reason: str | None) -> None:
    key = f"{run.id}:{policy}:{block}:{kind}:{code}:{cycle_id or 0}"
    action = Action(run_id=run.id, policy=policy, cycle_id=cycle_id, block=block, kind=kind, asset_id=asset_id,
                    mw=round(mw, 3), idempotency_key=key, status="rejected" if reason else "acked", reason=reason)
    if reason is None:
        action.delivered_mw = round(deliver(kind, mw, key, run.config), 3)
    db.add(action)


def bob_inputs(db: Session, ctx, truth: World, run: Run, t0: int, forecasts: dict) -> Inputs:
    horizon = min(96, run.total_blocks - t0)
    previous = _previous(db, run, "bob", t0 - 1)
    of_kind = lambda *kinds: [a for a in ctx.assets if a.kind in kinds]  # noqa: E731
    p50 = lambda series, code=None: np.array(forecasts[(series, code)].p50[:horizon])  # noqa: E731
    committed = {a.code: np.full(horizon, np.nan) for a in of_kind("consumer")}
    for action in _actions(db, run, "bob", (t0, t0 + horizon), ("dr_call",)):
        code = next(c for c, i in ctx.asset_ids.items() if i == action.asset_id)
        committed[code][action.block - t0] = action.mw
    last_lines = {r.line_id: r.limit_mw for r in db.scalars(select(LineBlock).where(
        LineBlock.run_id == run.id, LineBlock.policy == "bob", LineBlock.block == t0 - 1))}
    return Inputs(
        assets=ctx.assets, lines=ctx.lines,
        line_limit={code: last_lines.get(ctx.line_ids[code], limit) for code, limit in ctx.line_limits.items()},
        available={**{a.code: p50("re_avail", a.code) for a in of_kind("solar", "wind")},
                   **{a.code: p50("load", a.code) for a in of_kind("consumer")}},
        bess_available={a.code: previous[ctx.asset_ids[a.code]].available_mw > 0 if previous else True
                        for a in of_kind("bess")},
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
        shifted_today_mwh={
            a.code: DT * sum(x.delivered_mw for x in _actions(db, run, "bob", (t0 - t0 % 96, t0), ("load_shift",))
                             if x.asset_id == ctx.asset_ids[a.code])
            for a in of_kind("consumer")
        },
        market=ctx.market, profile=BALANCED,
    )


def plan_bob(db: Session, ctx, truth: World, run: Run, t0: int, forecasts: dict) -> None:
    started = time.perf_counter()
    inputs = bob_inputs(db, ctx, truth, run, t0, forecasts)
    horizon = len(inputs.price)
    of_kind = lambda *kinds: [a for a in ctx.assets if a.kind in kinds]  # noqa: E731
    committed = inputs.committed_dr
    gate = ctx.market["gate_blocks"]
    result = plan(inputs)
    cycle = Cycle(run_id=run.id, block=t0, seq=0, trigger="tick",
                  status="planned" if result.battery else "failed",
                  timings={"solve_ms": round((time.perf_counter() - started) * 1000)})
    db.add(cycle)
    db.flush()
    rounded = lambda arrays: {k: np.round(v, 2).tolist() for k, v in arrays.items()}  # noqa: E731
    db.add(Plan(
        cycle_id=cycle.id, variant="balanced", role="selected", kpis=result.kpis,
        schedule={"start_block": t0, "generation": rounded(result.generation), "battery": rounded(result.battery),
                  "soc": rounded(result.soc), "demand_response": rounded(result.demand_response),
                  "shift": rounded(result.shift), "rtm": np.round(result.rtm, 2).tolist()},
        solver={"status": result.status, "objective": result.objective, "gap": result.gap},
    ))
    if not result.battery:
        return  # no feasible plan: nothing is sent and assets keep their defaults

    for a in of_kind("bess"):
        mw = float(result.battery[a.code][0])
        if abs(mw) >= MIN_MW:
            kind = "bess_discharge" if mw > 0 else "bess_charge"
            reason = check(kind, abs(mw), a, soc_mwh=inputs.soc_mwh[a.code], available=inputs.bess_available[a.code])
            _send(db, run, "bob", cycle.id, t0, kind, ctx.asset_ids[a.code], a.code, abs(mw), reason)
    for a in of_kind("solar", "wind"):
        if result.curtailment[a.code][0] >= 0.5:
            cap = float(result.generation[a.code][0])
            _send(db, run, "bob", cycle.id, t0, "curtail", ctx.asset_ids[a.code], a.code, cap, check("curtail", cap, a))
    for a in of_kind("consumer"):
        notice = a.params["dr_notice_blocks"]
        if notice < horizon and np.isnan(committed[a.code][notice]) and result.demand_response[a.code][notice] >= MIN_MW:
            mw = float(result.demand_response[a.code][notice])
            _send(db, run, "bob", cycle.id, t0 + notice, "dr_call", ctx.asset_ids[a.code], a.code, mw,
                  check("dr_call", mw, a, lead_blocks=notice))
        shift = float(result.shift[a.code][0])
        if abs(shift) >= MIN_MW:
            _send(db, run, "bob", cycle.id, t0, "load_shift", ctx.asset_ids[a.code], a.code, shift,
                  check("load_shift", abs(shift), a))
    if gate < horizon and abs(result.rtm[gate]) >= MIN_MW:
        mw = float(result.rtm[gate])
        kind = "rtm_buy" if mw > 0 else "rtm_sell"
        _send(db, run, "bob", cycle.id, t0 + gate, kind, None, "portfolio", abs(mw),
              check(kind, abs(mw), None, trade_cap_mw=_trade_cap(ctx)))


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
    plan_bob(db, ctx, truth, run, t0, forecasts)
    plan_baseline(db, ctx, truth, run, t0, forecasts)


def settle_block(db: Session, ctx, truth: World, run: Run, b: int, policy: str) -> None:
    previous = _previous(db, run, policy, b - 1)
    code_of = {i: c for c, i in ctx.asset_ids.items()}
    assets = {a.code: a for a in ctx.assets}
    available = {code: float(series[b]) for code, series in truth.available.items()}
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
