"""Deviation settlement (simplified from the CERC DSM Regulations 2024) for a portfolio that
schedules a net drawal with the grid. Positive deviation = drawing more than scheduled."""

from typing import Any

import numpy as np

DEFAULT_MARKET: dict[str, Any] = {
    "gate_blocks": 4,  # RTM bids close an hour before delivery
    "band_pct": 0.10,  # tolerance band: the lower of 10 % of schedule and band_mw
    "band_mw": 100.0,
    "band_floor_mw": 5.0,  # a small schedule still gets a usable band
    "overdraw_freq_uplift": 0.5,  # overdrawing while frequency is low costs more
    "low_freq_hz": 49.95,
    "underdraw_credit": 0.9,  # under-drawal in band is paid at 90 % of the price
    "beyond_band_mult": 1.5,  # over-drawal beyond the band
}


def band(schedule: np.ndarray, market: dict[str, Any]) -> np.ndarray:
    return np.maximum(market["band_floor_mw"], np.minimum(market["band_pct"] * np.abs(schedule), market["band_mw"]))


def overdraw_rate(price: np.ndarray, frequency: float, market: dict[str, Any]) -> np.ndarray:
    stressed = frequency < market["low_freq_hz"]
    return price * (1 + market["overdraw_freq_uplift"] * stressed)


def dsm_inr(deviation_mw: float, schedule_mw: float, price: float, frequency: float,
            market: dict[str, Any], hours: float) -> float:
    """Charge (positive) or credit (negative) for one block's deviation."""
    limit = float(band(np.array([schedule_mw]), market)[0])
    if deviation_mw >= 0:
        inside = min(deviation_mw, limit)
        rate = float(overdraw_rate(np.array([price]), frequency, market)[0])
        return (inside * rate + (deviation_mw - inside) * price * market["beyond_band_mult"]) * hours
    return -min(-deviation_mw, limit) * price * market["underdraw_credit"] * hours
