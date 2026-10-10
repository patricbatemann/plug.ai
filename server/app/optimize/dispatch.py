"""Portfolio dispatch over a rolling horizon (docs/spec/01-decision-model.md §2–5).

Stage A minimises unserved load and reserve shortfall; stage B minimises cost plus the
profile's shadow prices while keeping stage A's reliability. Index 0 is the block about
to start; only its decisions (and bids/calls that become binding now) are executed.
"""

import math
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

from app.optimize.model import Model
from app.optimize.profiles import VALUE_OF_RESERVE, VOLL, VOLL_CRITICAL
from app.sim.market import band, overdraw_rate
from app.sim.plant import LineSpec
from app.sim.world import AssetSpec

DT = 0.25  # hours per block
EPSILON_MWH = 0.1  # stage B may lose at most this much stage A reliability
TIME_LIMIT_S = 2.0
MIP_GAP = 0.005
SHIFT_IMBALANCE = 50_000.0  # ₹/MWh of shifted load not returned the same day


@dataclass
class Inputs:
    assets: list[AssetSpec]
    lines: list[LineSpec]
    line_limit: dict[str, float]  # current limits, held over the horizon
    available: dict[str, np.ndarray]  # renewable P50 (MW) and consumer load P50 per block
    bess_available: dict[str, np.ndarray]  # 1 where the battery can operate, per block
    soc_mwh: dict[str, float]
    price: np.ndarray  # RTM P50 ₹/MWh
    emission: np.ndarray  # tCO2/MWh of grid imports
    frequency: float
    hour: np.ndarray  # hour of day of each block
    schedule: np.ndarray  # DAM plus RTM already committed, MW net import
    committed_dr: dict[str, np.ndarray]  # consumer -> MW already called (NaN = still free)
    blocks_left_today: int  # horizon blocks before midnight; daily limits apply per calendar day
    discharged_today_mwh: dict[str, float]
    dr_called_today_mwh: dict[str, float]
    shifted_today_mwh: dict[str, float]  # net load moved out so far today (+ out, − back in)
    recent_discharge_mw: dict[str, np.ndarray]  # each battery's measured discharge in the blocks before, oldest first
    recent_deficit_mw: np.ndarray  # measured portfolio load minus renewable availability, oldest first
    market: dict[str, Any]
    profile: dict[str, Any]
    # Active action configs by "family:code" (market families use code "portfolio"), with their
    # limits. A decision with no config is not available to BOB.
    allowed: dict[str, dict[str, Any]] = field(default_factory=dict)
    protected: dict[str, Any] = field(default_factory=dict)


@dataclass
class Plan:
    status: str
    objective: float
    gap: float
    generation: dict[str, np.ndarray] = field(default_factory=dict)  # MW dispatched
    curtailment: dict[str, np.ndarray] = field(default_factory=dict)
    battery: dict[str, np.ndarray] = field(default_factory=dict)  # MW, + discharge
    soc: dict[str, np.ndarray] = field(default_factory=dict)  # MWh at block end
    demand_response: dict[str, np.ndarray] = field(default_factory=dict)
    shift: dict[str, np.ndarray] = field(default_factory=dict)  # MW, + moved out of the block
    unserved: dict[str, np.ndarray] = field(default_factory=dict)
    exchange: dict[str, np.ndarray] = field(default_factory=dict)  # MW, + import
    rtm: np.ndarray = field(default_factory=lambda: np.zeros(0))  # MW, + buy
    deviation: np.ndarray = field(default_factory=lambda: np.zeros(0))
    kpis: dict[str, float] = field(default_factory=dict)


@dataclass
class HereAndNow:
    """Decisions that become binding now. Fixing them in another scenario's solve shows how
    well a plan's commitments hold up if that scenario happens."""

    battery: dict[str, float] = field(default_factory=dict)  # MW at index 0, + discharge
    output_cap: dict[str, float] = field(default_factory=dict)  # MW limit at index 0
    demand_response: dict[str, float] = field(default_factory=dict)  # MW at the consumer's notice index
    shift: dict[str, float] = field(default_factory=dict)  # MW at index 0, + out
    rtm: float = 0.0  # MW at the gate index, + buy


MIN_MW = 0.05  # smaller decisions are noise, not actions
CURTAIL_MIN_MW = 0.5


def here_and_now(p: Plan, inp: Inputs) -> HereAndNow:
    gate = inp.market["gate_blocks"]
    h = HereAndNow()
    h.battery = {c: float(v[0]) for c, v in p.battery.items() if abs(v[0]) >= MIN_MW}
    h.output_cap = {c: float(p.generation[c][0]) for c, v in p.curtailment.items() if v[0] >= CURTAIL_MIN_MW}
    for a in (a for a in inp.assets if a.kind == "consumer"):
        notice = a.params["dr_notice_blocks"]
        free = notice < len(p.rtm) and np.isnan(inp.committed_dr[a.code][notice])
        if free and p.demand_response[a.code][notice] >= MIN_MW:
            h.demand_response[a.code] = float(p.demand_response[a.code][notice])
        if abs(p.shift[a.code][0]) >= MIN_MW:
            h.shift[a.code] = float(p.shift[a.code][0])
    if gate < len(p.rtm) and abs(p.rtm[gate]) >= MIN_MW:
        h.rtm = float(p.rtm[gate])
    return h


def _daily(m: Model, x: np.ndarray, per_day_mwh: float, used_today_mwh: float, left_today: int) -> None:
    """Energy through `x` stays within today's remaining allowance, and tomorrow's within a full day's."""
    today, tomorrow = x[:left_today], x[left_today:]
    if len(today):
        m.add([(today[None, :], DT)], ub=max(per_day_mwh - used_today_mwh, 0.0))
    if len(tomorrow):
        m.add([(tomorrow[None, :], DT)], ub=per_day_mwh)


def _cap(inp: Inputs, key: str, rating: float | np.ndarray) -> float | np.ndarray:
    """Upper bound for a decision: zero without a config, else its rating within the configured maximum."""
    if key not in inp.allowed:
        return 0.0 * rating
    return np.minimum(rating, inp.allowed[key].get("max_mw", np.inf))


def portfolio_deficit(inp: Inputs) -> np.ndarray:
    """Forecast portfolio load minus renewable availability, MW per block."""
    load = sum(inp.available[a.code] for a in inp.assets if a.kind == "consumer")
    return load - sum(inp.available[a.code] for a in inp.assets if a.kind in ("solar", "wind"))


def discharge_history(inp: Inputs, code: str) -> dict[str, Any]:
    """What the validator needs to check a battery's discharge now against its configuration."""
    return {"limits": inp.allowed.get(f"battery_discharge:{code}"), "recent_mw": inp.recent_discharge_mw[code],
            "deficit_mw": [*inp.recent_deficit_mw, float(portfolio_deficit(inp)[0])]}


def _deficit_gate(inp: Inputs, rules: dict[str, Any]) -> float | np.ndarray:
    """1 where a configured battery may discharge: the portfolio's load exceeds its renewable output
    by more than deficit_mw, in this block and the blocks before it that deficit_minutes spans."""
    if "deficit_mw" not in rules:
        return 1.0
    span = max(1, math.ceil(rules.get("deficit_minutes", 0) / 15))
    # Blocks before the run began do not count as a deficit.
    before = np.concatenate([np.full(span - 1, -np.inf), inp.recent_deficit_mw])[len(inp.recent_deficit_mw):]
    above = np.concatenate([before, portfolio_deficit(inp)]) > rules["deficit_mw"]
    return sliding_window_view(above, span).all(axis=1).astype(float)


def _discharge_caps(m: Model, dis: np.ndarray, rating: np.ndarray, rules: dict[str, Any], recent: np.ndarray) -> None:
    """At most max_minutes of continuous discharge, and at most max_mwh in any max_minutes, counting
    what the battery discharged in the blocks before this plan."""
    if "max_minutes" not in rules:
        return
    H, D = len(dis), int(rules["max_minutes"] // 15)
    on = m.var(H, binary=True, ub=1)
    m.add([(dis, 1.0), (on, -rating)], ub=0.0)
    running = next((i for i, mw in enumerate(recent[::-1]) if mw <= MIN_MW), len(recent))
    m.add([(on[None, :min(max(D - running + 1, 1), H)], 1.0)], ub=max(D - running, 0))
    if H > D:
        m.add([(on[np.arange(H - D)[:, None] + np.arange(D + 1)], 1.0)], ub=D)
    if "max_mwh" not in rules:
        return
    cap = rules["max_mwh"]
    for j in range(1, D):  # windows that began j blocks before this plan
        m.add([(dis[None, :min(D - j, H)], DT)], ub=max(cap - DT * recent[-j:].sum(), 0.0))
    if H >= D:
        m.add([(dis[np.arange(H - D + 1)[:, None] + np.arange(D)], DT)], ub=cap)


def plan(inp: Inputs, fixed: HereAndNow | None = None, single_stage: bool = False,
         most: dict[str, float] | None = None) -> Plan:
    """Two-stage plan; or, for stress tests, one solve of reliability plus cost, optionally
    with another plan's here-and-now decisions fixed. `most` caps "family:code" decisions taken
    now, in MW (0 forbids them): the fallback plan does only what BOB may do without a person."""
    H = len(inp.price)
    gate = inp.market["gate_blocks"]
    prof = inp.profile
    m = Model()
    of_kind = lambda *kinds: [a for a in inp.assets if a.kind in kinds]  # noqa: E731
    gens, batteries, consumers, ics = of_kind("solar", "wind"), of_kind("bess"), of_kind("consumer"), of_kind("interconnection")

    # A plant that cannot be curtailed (physically, or without a config) dispatches its availability.
    g = {a.code: m.var(H, 0 if a.params["curtailable"] and f"curtail:{a.code}" in inp.allowed
                     else inp.available[a.code], inp.available[a.code])
         for a in gens}

    ch, dis, mode, soc, res = {}, {}, {}, {}, {}
    for a in batteries:
        p = a.capacity * inp.bess_available[a.code]
        e = a.params["energy_mwh"]
        ch[a.code] = m.var(H, 0, _cap(inp, f"battery_charge:{a.code}", p))
        rules = inp.allowed.get(f"battery_discharge:{a.code}", {})
        dis[a.code] = m.var(H, 0, _cap(inp, f"battery_discharge:{a.code}", p) * _deficit_gate(inp, rules))
        mode[a.code] = m.var(H, binary=True, ub=1)
        floor_pct = max(a.params["soc_min_pct"], inp.protected.get("battery_soc_floor_pct", 0),
                        inp.allowed.get(f"battery_discharge:{a.code}", {}).get("reserve_pct", 0))
        # Never demand a floor above where the battery starts; it may not be able to get there.
        low = min(e * floor_pct / 100, inp.soc_mwh[a.code])
        soc[a.code] = m.var(H, low, e * a.params["soc_max_pct"] / 100)
        res[a.code] = m.var(H)

    dr, out, back, uns, uns_crit, shift_gap = {}, {}, {}, {}, {}, {}
    for a in consumers:
        p, load = a.params, inp.available[a.code]
        notice = np.arange(H) >= p["dr_notice_blocks"]
        committed = inp.committed_dr.get(a.code, np.full(H, np.nan))
        called = ~np.isnan(committed)
        dr_ub = np.where(called, np.nan_to_num(committed),
                         np.where(notice, _cap(inp, f"demand_response:{a.code}", p["dr_max_mw"]), 0.0))
        dr[a.code] = m.var(H, np.where(called, np.nan_to_num(committed), 0.0), dr_ub)
        window = p["shift_window"]
        in_window = (inp.hour >= window[0]) & (inp.hour < window[1]) if window else np.zeros(H, bool)
        shift_ub = np.where(in_window, _cap(inp, f"load_shift:{a.code}", p["shift_max_mw"]), 0.0)
        out[a.code], back[a.code] = m.var(H, 0, shift_ub), m.var(H, 0, shift_ub)
        uns[a.code] = m.var(H, 0, load)
        uns_crit[a.code] = m.var(H)
        shift_gap[a.code] = m.var((2, 2))  # [today, tomorrow] x [over, under]

    imp = {a.code: m.var(H, 0, a.params["import_max_mw"]) for a in ics}
    exp = {a.code: m.var(H, 0, a.params["export_max_mw"]) for a in ics}
    flow = {l.code: m.var(H, -inp.line_limit[l.code], inp.line_limit[l.code]) for l in inp.lines}
    tradable = np.arange(H) >= gate
    rtm_cap = sum(a.params["import_max_mw"] + a.params["export_max_mw"] for a in ics)
    sell_cap = _cap(inp, "grid_export:portfolio", prof["rtm_sell_cap_share"] * sum(a.params["export_max_mw"] for a in ics))
    min_price = inp.allowed.get("grid_export:portfolio", {}).get("min_price_inr_mwh", 0)
    buy = m.var(H, 0, np.where(tradable, _cap(inp, "grid_import:portfolio", rtm_cap), 0.0))
    sell = m.var(H, 0, np.where(tradable & (inp.price >= min_price), sell_cap, 0.0))
    tol = band(inp.schedule, inp.market)
    over_in, over_out = m.var(H, 0, tol), m.var(H)
    under_in, under_out = m.var(H, 0, tol), m.var(H)
    shortfall = m.var(H)

    # Node balance: supply at the node equals the load that is actually served there.
    for node in sorted({a.node for a in inp.assets}):
        terms: list[tuple[np.ndarray, float]] = []
        terms += [(g[a.code], 1.0) for a in gens if a.node == node]
        terms += [(dis[a.code], 1.0) for a in batteries if a.node == node]
        terms += [(ch[a.code], -1.0) for a in batteries if a.node == node]
        terms += [(imp[a.code], 1.0) for a in ics if a.node == node]
        terms += [(exp[a.code], -1.0) for a in ics if a.node == node]
        terms += [(flow[l.code], 1.0) for l in inp.lines if l.hub == node]
        terms += [(flow[l.code], -1.0) for l in inp.lines if l.leaf == node]
        demand = np.zeros(H)
        for a in consumers:
            if a.node == node:
                terms += [(dr[a.code], 1.0), (out[a.code], 1.0), (back[a.code], -1.0), (uns[a.code], 1.0)]
                demand += inp.available[a.code]
        if terms:
            m.add(terms, demand, demand)

    reserve_terms = []
    for a in batteries:
        e, p = a.params["energy_mwh"], a.capacity * inp.bess_available[a.code]
        eta_c, eta_d = a.params["eta_c"], a.params["eta_d"]
        # soc_t = soc_(t-1) + dt*eta_c*ch_t - dt/eta_d*dis_t, starting from the measured state.
        flows = lambda sl: [(ch[a.code][sl], -DT * eta_c), (dis[a.code][sl], DT / eta_d)]  # noqa: E731
        m.add([(soc[a.code][:1], 1.0)] + flows(slice(0, 1)), inp.soc_mwh[a.code], inp.soc_mwh[a.code])
        m.add([(soc[a.code][1:], 1.0), (soc[a.code][:-1], -1.0)] + flows(slice(1, None)), 0.0, 0.0)
        m.add([(ch[a.code], 1.0), (mode[a.code], -p)], ub=0.0)
        m.add([(dis[a.code], 1.0), (mode[a.code], p)], ub=p)
        floor = e * max(prof["soc_floor_pct"], a.params["soc_min_pct"]) / 100
        m.add([(res[a.code], 1.0), (dis[a.code], 1.0), (ch[a.code], -1.0)], ub=p)
        m.add([(res[a.code], prof["reserve_hours"]), (soc[a.code], -eta_d)], ub=-eta_d * floor)
        m.add([(soc[a.code][-1:], 1.0)], lb=min(inp.soc_mwh[a.code], e * a.params["soc_max_pct"] / 100))
        _daily(m, dis[a.code], e * a.params["cycles_per_day"], inp.discharged_today_mwh[a.code], inp.blocks_left_today)
        _discharge_caps(m, dis[a.code], p, inp.allowed.get(f"battery_discharge:{a.code}", {}),
                        inp.recent_discharge_mw[a.code])
        reserve_terms.append((res[a.code], 1.0))
    requirement = prof["reserve_share"] * sum(a.capacity for a in batteries)
    m.add(reserve_terms + [(shortfall, 1.0)], lb=requirement)

    for a in consumers:
        p, load = a.params, inp.available[a.code]
        _daily(m, dr[a.code], p["dr_energy_mwh_day"], inp.dr_called_today_mwh[a.code], inp.blocks_left_today)
        # Moved load comes back the same day: today's net shift (including what already
        # happened) and tomorrow's each net to zero, softly so a missed block cannot block planning.
        for k, (part, already) in enumerate(((slice(0, inp.blocks_left_today), inp.shifted_today_mwh[a.code]),
                                             (slice(inp.blocks_left_today, None), 0.0))):
            if len(out[a.code][part]):
                m.add([(out[a.code][part][None, :], DT), (back[a.code][part][None, :], -DT),
                       (shift_gap[a.code][k, :1], -1.0), (shift_gap[a.code][k, 1:], 1.0)], -already, -already)
        m.add([(uns[a.code], 1.0), (dr[a.code], 1.0), (out[a.code], 1.0)], ub=load)
        m.add([(uns[a.code], 1.0), (uns_crit[a.code], -1.0)], ub=np.maximum(load - p["critical_mw"], 0))

    # Net grid exchange = schedule + new RTM trades + deviation.
    m.add([(imp[a.code], 1.0) for a in ics] + [(exp[a.code], -1.0) for a in ics]
          + [(buy, -1.0), (sell, 1.0), (over_in, -1.0), (over_out, -1.0), (under_in, 1.0), (under_out, 1.0)],
          inp.schedule, inp.schedule)

    if fixed:
        for code, mw in fixed.battery.items():
            m.fix(dis[code][0], max(mw, 0.0))
            m.fix(ch[code][0], max(-mw, 0.0))
        for code, cap in fixed.output_cap.items():
            m.fix(g[code][0], 0.0, min(cap, float(inp.available[code][0])))
        for a in consumers:
            notice = a.params["dr_notice_blocks"]
            if notice < H and np.isnan(inp.committed_dr[a.code][notice]):
                m.fix(dr[a.code][notice], min(fixed.demand_response.get(a.code, 0.0), a.params["dr_max_mw"]))
            mw = fixed.shift.get(a.code, 0.0)
            m.fix(out[a.code][0], max(mw, 0.0))
            m.fix(back[a.code][0], max(-mw, 0.0))
        if gate < H:
            m.fix(buy[gate], max(fixed.rtm, 0.0))
            m.fix(sell[gate], max(-fixed.rtm, 0.0))

    for key, mw in (most or {}).items():
        family, code = key.split(":")
        if family in ("battery_charge", "battery_discharge"):
            m.fix((ch if family == "battery_charge" else dis)[code][0], 0.0, mw)
        elif family == "curtail":  # curtail at most `mw` of what is available
            available = float(inp.available[code][0])
            m.fix(g[code][0], max(available - mw, 0.0), available)
        elif family == "demand_response":
            notice = next(a.params["dr_notice_blocks"] for a in consumers if a.code == code)
            if notice < H:
                m.fix(dr[code][notice], 0.0, mw)
        elif family == "load_shift":
            m.fix(out[code][0], 0.0, mw)
            m.fix(back[code][0], 0.0, mw)
        elif gate < H:
            m.fix((buy if family == "grid_import" else sell)[gate], 0.0, mw)

    reliability = np.zeros(m.n)
    for a in consumers:
        reliability[uns[a.code]] = VOLL * DT
        reliability[uns_crit[a.code]] = (VOLL_CRITICAL - VOLL) * DT
    reliability[shortfall] = VALUE_OF_RESERVE * DT
    if not single_stage:
        stage_a = m.solve(reliability, TIME_LIMIT_S, MIP_GAP)
        if np.isnan(stage_a.objective):
            return Plan(status=stage_a.status, objective=float("nan"), gap=0.0)
        used = np.flatnonzero(reliability)
        m.add([(used[None, :], reliability[used][None, :])], ub=stage_a.objective + EPSILON_MWH * VOLL * DT)

    cost = np.zeros(m.n)
    price = inp.price
    cost[buy] = price * DT
    cost[sell] = -price * DT
    deviation_penalty = prof["lambda_deviation"] * DT
    cost[over_in] = overdraw_rate(price, inp.frequency, inp.market) * DT + deviation_penalty
    cost[over_out] = price * inp.market["beyond_band_mult"] * DT + deviation_penalty
    cost[under_in] = -price * inp.market["underdraw_credit"] * DT + deviation_penalty
    cost[under_out] = deviation_penalty
    for a in gens:
        cost[g[a.code]] = -(a.params["curtail_comp_inr_mwh"] + prof["lambda_curtail"]) * DT
    for a in batteries:
        cost[dis[a.code]] = (a.params["deg_cost_inr_mwh"] + prof["lambda_wear"]) * DT
    for a in consumers:
        cost[dr[a.code]] = a.params["dr_incentive_inr_mwh"] * DT
        cost[out[a.code]] = a.params["shift_cost_inr_mwh"] * DT
        cost[shift_gap[a.code]] = SHIFT_IMBALANCE  # only when the day cannot be balanced
    for a in ics:
        cost[imp[a.code]] = prof["lambda_carbon"] * inp.emission * DT
    # Stage B keeps reliability in its objective too: the ε cap is numerical slack, not a budget
    # for shedding load whenever that saves money.
    s = m.solve(cost + reliability, TIME_LIMIT_S, MIP_GAP)
    if np.isnan(s.objective):
        return Plan(status=s.status, objective=float("nan"), gap=0.0)

    result = Plan(status=s.status, objective=s.objective, gap=s.gap)
    for a in gens:
        result.generation[a.code] = s[g[a.code]]
        result.curtailment[a.code] = inp.available[a.code] - s[g[a.code]]
    for a in batteries:
        result.battery[a.code] = s[dis[a.code]] - s[ch[a.code]]
        result.soc[a.code] = s[soc[a.code]]
    for a in consumers:
        result.demand_response[a.code] = s[dr[a.code]]
        result.shift[a.code] = s[out[a.code]] - s[back[a.code]]
        result.unserved[a.code] = s[uns[a.code]]
    for a in ics:
        result.exchange[a.code] = s[imp[a.code]] - s[exp[a.code]]
    result.rtm = s[buy] - s[sell]
    result.deviation = s[over_in] + s[over_out] - s[under_in] - s[under_out]
    economic = (
        price @ (s[buy] - s[sell]) + overdraw_rate(price, inp.frequency, inp.market) @ s[over_in]
        + inp.market["beyond_band_mult"] * price @ s[over_out] - inp.market["underdraw_credit"] * price @ s[under_in]
        + sum(a.params["dr_incentive_inr_mwh"] * s[dr[a.code]].sum()
              + a.params["shift_cost_inr_mwh"] * s[out[a.code]].sum() for a in consumers)
        + sum(a.params["deg_cost_inr_mwh"] * s[dis[a.code]].sum() for a in batteries)
        + sum(a.params["curtail_comp_inr_mwh"] * result.curtailment[a.code].sum() for a in gens)
    ) * DT
    result.kpis = {
        "cost_inr": float(economic),
        "market_inr": float(np.sum(price * result.rtm) * DT),
        "curtailed_mwh": float(sum(c.sum() for c in result.curtailment.values()) * DT),
        "unserved_mwh": float(sum(u.sum() for u in result.unserved.values()) * DT),
        "discharged_mwh": float(sum(np.maximum(b, 0).sum() for b in result.battery.values()) * DT),
        "deviation_mwh": float(np.abs(result.deviation).sum() * DT),
        "carbon_t": float(sum(np.maximum(x, 0) @ inp.emission for x in result.exchange.values()) * DT),
        "reserve_shortfall_mwh": float(s[shortfall].sum() * DT),
    }
    return result
