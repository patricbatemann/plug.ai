"""Portfolio dispatch over a rolling horizon (docs/spec/01-decision-model.md §2–5).

Stage A minimises unserved load and reserve shortfall; stage B minimises cost plus the
profile's shadow prices while keeping stage A's reliability. Index 0 is the block about
to start; only its decisions (and bids/calls that become binding now) are executed.
"""

from dataclasses import dataclass, field
from typing import Any

import numpy as np

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
    bess_available: dict[str, bool]
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
    market: dict[str, Any]
    profile: dict[str, Any]


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


def _daily(m: Model, x: np.ndarray, per_day_mwh: float, used_today_mwh: float, left_today: int) -> None:
    """Energy through `x` stays within today's remaining allowance, and tomorrow's within a full day's."""
    today, tomorrow = x[:left_today], x[left_today:]
    if len(today):
        m.add([(today[None, :], DT)], ub=max(per_day_mwh - used_today_mwh, 0.0))
    if len(tomorrow):
        m.add([(tomorrow[None, :], DT)], ub=per_day_mwh)


def plan(inp: Inputs) -> Plan:
    H = len(inp.price)
    gate = inp.market["gate_blocks"]
    prof = inp.profile
    m = Model()
    of_kind = lambda *kinds: [a for a in inp.assets if a.kind in kinds]  # noqa: E731
    gens, batteries, consumers, ics = of_kind("solar", "wind"), of_kind("bess"), of_kind("consumer"), of_kind("interconnection")

    # A plant that cannot be curtailed dispatches exactly its availability.
    g = {a.code: m.var(H, 0 if a.params["curtailable"] else inp.available[a.code], inp.available[a.code])
         for a in gens}

    ch, dis, mode, soc, res = {}, {}, {}, {}, {}
    for a in batteries:
        p = a.capacity if inp.bess_available[a.code] else 0.0
        e = a.params["energy_mwh"]
        ch[a.code], dis[a.code] = m.var(H, 0, p), m.var(H, 0, p)
        mode[a.code] = m.var(H, binary=True, ub=1)
        soc[a.code] = m.var(H, e * a.params["soc_min_pct"] / 100, e * a.params["soc_max_pct"] / 100)
        res[a.code] = m.var(H)

    dr, out, back, uns, uns_crit, shift_gap = {}, {}, {}, {}, {}, {}
    for a in consumers:
        p, load = a.params, inp.available[a.code]
        notice = np.arange(H) >= p["dr_notice_blocks"]
        committed = inp.committed_dr.get(a.code, np.full(H, np.nan))
        fixed = ~np.isnan(committed)
        dr_ub = np.where(fixed, np.nan_to_num(committed), np.where(notice, p["dr_max_mw"], 0.0))
        dr[a.code] = m.var(H, np.where(fixed, np.nan_to_num(committed), 0.0), dr_ub)
        window = p["shift_window"]
        in_window = (inp.hour >= window[0]) & (inp.hour < window[1]) if window else np.zeros(H, bool)
        out[a.code] = m.var(H, 0, np.where(in_window, p["shift_max_mw"], 0.0))
        back[a.code] = m.var(H, 0, np.where(in_window, p["shift_max_mw"], 0.0))
        uns[a.code] = m.var(H, 0, load)
        uns_crit[a.code] = m.var(H)
        shift_gap[a.code] = m.var((2, 2))  # [today, tomorrow] x [over, under]

    imp = {a.code: m.var(H, 0, a.params["import_max_mw"]) for a in ics}
    exp = {a.code: m.var(H, 0, a.params["export_max_mw"]) for a in ics}
    flow = {l.code: m.var(H, -inp.line_limit[l.code], inp.line_limit[l.code]) for l in inp.lines}
    tradable = np.arange(H) >= gate
    rtm_cap = sum(a.params["import_max_mw"] + a.params["export_max_mw"] for a in ics)
    buy, sell = m.var(H, 0, np.where(tradable, rtm_cap, 0.0)), m.var(H, 0, np.where(tradable, rtm_cap, 0.0))
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
        e, p = a.params["energy_mwh"], (a.capacity if inp.bess_available[a.code] else 0.0)
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

    reliability = np.zeros(m.n)
    for a in consumers:
        reliability[uns[a.code]] = VOLL * DT
        reliability[uns_crit[a.code]] = (VOLL_CRITICAL - VOLL) * DT
    reliability[shortfall] = VALUE_OF_RESERVE * DT
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
    stage_b = m.solve(cost, TIME_LIMIT_S, MIP_GAP)
    s = stage_b if not np.isnan(stage_b.objective) else stage_a

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
    result.kpis = {
        "market_inr": float(np.sum(price * result.rtm) * DT),
        "curtailed_mwh": float(sum(c.sum() for c in result.curtailment.values()) * DT),
        "unserved_mwh": float(sum(u.sum() for u in result.unserved.values()) * DT),
        "discharged_mwh": float(sum(np.maximum(b, 0).sum() for b in result.battery.values()) * DT),
        "deviation_mwh": float(np.abs(result.deviation).sum() * DT),
        "carbon_t": float(sum(np.maximum(x, 0) @ inp.emission for x in result.exchange.values()) * DT),
    }
    return result
