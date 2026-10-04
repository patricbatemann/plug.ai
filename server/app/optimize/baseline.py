"""Today's practice, for comparison: batteries on a fixed clock and a trading desk that only
buys or sells the forecast gap when it falls outside the deviation band."""

from typing import Any

import numpy as np

from app.sim.market import band
from app.sim.world import AssetSpec

DT = 0.25
CHARGE_HOURS = (10, 15)
DISCHARGE_HOURS = (18, 22)
CHARGE_SHARE = 0.6  # of rated power, spread across the solar hours


def battery_mw(asset: AssetSpec, soc_mwh: float, hour: float, available: bool) -> float:
    if not available:
        return 0.0
    p = asset.params
    e, power = p["energy_mwh"], asset.capacity
    if CHARGE_HOURS[0] <= hour < CHARGE_HOURS[1]:
        room = e * p["soc_max_pct"] / 100 - soc_mwh
        return -min(CHARGE_SHARE * power, max(room, 0) / (p["eta_c"] * DT))
    if DISCHARGE_HOURS[0] <= hour < DISCHARGE_HOURS[1]:
        stored = soc_mwh - e * p["soc_min_pct"] / 100
        return min(power, max(stored, 0) * p["eta_d"] / DT)
    return 0.0


def rtm_trade(expected_net_mw: float, schedule_mw: float, market: dict[str, Any], cap_mw: float) -> float:
    """MW to buy (+) or sell (−) so the expected drawal lands inside the band."""
    gap = expected_net_mw - schedule_mw
    if abs(gap) <= float(band(np.array([schedule_mw]), market)[0]):
        return 0.0
    return float(np.clip(gap, -cap_mw, cap_mw))
