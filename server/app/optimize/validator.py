"""Independent checks on an action before it is sent. Deliberately does not reuse the
optimiser: it re-derives the limits from the asset parameters and the measured state."""

import math
from collections.abc import Sequence
from typing import Any

from app.sim.world import AssetSpec

DT = 0.25
TOLERANCE_MW = 0.01
ACTIVE_MW = 0.05  # a block with less discharge than this is not part of a continuous discharge


def check(kind: str, mw: float, asset: AssetSpec | None, *, soc_mwh: float | None = None,
          available: bool = True, lead_blocks: int = 0, trade_cap_mw: float = 0.0,
          limits: dict[str, Any] | None = None, recent_mw: Sequence[float] = (),
          deficit_mw: Sequence[float] = ()) -> str | None:
    """None when the action is safe to send, otherwise the reason it is not."""
    if mw < 0:
        return "Negative magnitude"
    if kind in ("bess_charge", "bess_discharge"):
        p = asset.params
        if not available:
            return f"{asset.code} is unavailable"
        if mw > asset.capacity + TOLERANCE_MW:
            return f"{mw:.1f} MW exceeds {asset.code} rating {asset.capacity:g} MW"
        energy = mw * DT * (p["eta_c"] if kind == "bess_charge" else -1 / p["eta_d"])
        after = soc_mwh + energy
        low, high = p["energy_mwh"] * p["soc_min_pct"] / 100, p["energy_mwh"] * p["soc_max_pct"] / 100
        if not low - TOLERANCE_MW <= after <= high + TOLERANCE_MW:
            return f"State of charge would leave {low:.1f}–{high:.1f} MWh"
        if kind == "bess_discharge" and limits:
            return _discharge_rules(mw, limits, list(recent_mw), list(deficit_mw))
    elif kind == "curtail" and mw > asset.capacity + TOLERANCE_MW:
        return f"Output limit above {asset.code} capacity"
    elif kind == "dr_call":
        if mw > asset.params["dr_max_mw"] + TOLERANCE_MW:
            return f"Demand response above {asset.code}'s {asset.params['dr_max_mw']:g} MW"
        if lead_blocks < asset.params["dr_notice_blocks"]:
            return f"{asset.code} needs {asset.params['dr_notice_blocks']} blocks' notice"
    elif kind == "load_shift" and mw > asset.params["shift_max_mw"] + TOLERANCE_MW:
        return f"Load shift above {asset.code}'s {asset.params['shift_max_mw']:g} MW"
    elif kind in ("rtm_buy", "rtm_sell") and mw > trade_cap_mw + TOLERANCE_MW:
        return f"Trade above the {trade_cap_mw:g} MW interconnection capacity"
    return None


def _discharge_rules(mw: float, limits: dict[str, Any], recent: list[float], deficits: list[float]) -> str | None:
    """A discharge now against its configuration, given the measured discharge (`recent`) and portfolio
    deficit (`deficits`, ending with this block's forecast) in the blocks before, oldest first."""
    if "deficit_mw" in limits:
        span = max(1, math.ceil(limits.get("deficit_minutes", 0) / 15))
        if len(deficits) < span or min(deficits[-span:]) <= limits["deficit_mw"]:
            return f"Portfolio deficit is not above {limits['deficit_mw']:g} MW for long enough"
    if "max_minutes" in limits:
        blocks = int(limits["max_minutes"] // 15)
        running = 0
        while running < len(recent) and recent[-1 - running] > ACTIVE_MW:
            running += 1
        if running + 1 > blocks:
            return f"Would discharge for longer than {limits['max_minutes']:g} minutes"
        window = recent[len(recent) - (blocks - 1):] if blocks > 1 else []
        if "max_mwh" in limits and DT * (sum(window) + mw) > limits["max_mwh"] + TOLERANCE_MW * DT:
            return f"Would discharge more than {limits['max_mwh']:g} MWh in {limits['max_minutes']:g} minutes"
    return None
