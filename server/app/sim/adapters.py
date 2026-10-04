"""Mock downstream systems. Each returns what it actually delivered; the shortfalls are
reproducible per action, and their size is set by the run's `adapters` config."""

import zlib
from typing import Any

import numpy as np

DEFAULTS: dict[str, dict[str, float]] = {
    "bms": {"shortfall_sd": 0.02},  # battery delivers command × (1 − |N(0, sd)|)
    "rtm": {"clear_ratio": 1.0},  # share of each bid that clears
    "dr": {"compliance_min": 0.8},  # consumers deliver between this share and 100 %
}


def deliver(kind: str, mw: float, key: str, config: dict[str, Any]) -> float:
    settings = {name: {**values, **config.get("adapters", {}).get(name, {})} for name, values in DEFAULTS.items()}
    rng = np.random.default_rng(zlib.crc32(key.encode()))
    if kind in ("bess_charge", "bess_discharge"):
        return mw * (1 - abs(rng.normal(0, settings["bms"]["shortfall_sd"])))
    if kind in ("rtm_buy", "rtm_sell"):
        return mw * settings["rtm"]["clear_ratio"]
    if kind == "dr_call":
        return mw * rng.uniform(settings["dr"]["compliance_min"], 1.0)
    return mw
