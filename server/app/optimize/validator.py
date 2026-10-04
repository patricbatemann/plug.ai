"""Independent checks on an action before it is sent. Deliberately does not reuse the
optimiser: it re-derives the limits from the asset parameters and the measured state."""

from app.sim.world import AssetSpec

DT = 0.25
TOLERANCE_MW = 0.01


def check(kind: str, mw: float, asset: AssetSpec | None, *, soc_mwh: float | None = None,
          available: bool = True, lead_blocks: int = 0, trade_cap_mw: float = 0.0) -> str | None:
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
