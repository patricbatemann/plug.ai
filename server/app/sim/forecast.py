"""Forecasts: what BOB can know. Built from a World that contains only revealed events,
plus an error that grows with lead time and is fixed by the seed."""

import math
from dataclasses import dataclass
from typing import Any

import numpy as np

from app.sim.world import AssetSpec, World, ar1

HORIZON = 96  # blocks: 24 hours
Z90 = 1.2816  # P10/P90 distance from P50 in standard deviations


@dataclass
class Issue:
    series: str
    asset_code: str | None
    p10: list[float]
    p50: list[float]
    p90: list[float]


def _band(known: np.ndarray, scale: np.ndarray, sigma: np.ndarray, z: np.ndarray,
          upper: float | np.ndarray) -> tuple[list[float], list[float], list[float]]:
    p50 = np.clip(known + sigma * z * scale, 0, upper)
    spread = Z90 * sigma * scale
    return (np.clip(p50 - spread, 0, upper).round(2).tolist(), p50.round(2).tolist(),
            np.clip(p50 + spread, 0, upper).round(2).tolist())


def issue(known: World, block: int, assets: list[AssetSpec], config: dict[str, Any],
          horizon: int = HORIZON) -> list[Issue]:
    """Forecasts issued at the end of `block` for the next `horizon` blocks."""
    span = slice(block + 1, block + 1 + horizon)
    hours = np.arange(1, horizon + 1) * 0.25
    noise = config["noise"]
    phi = 0.9

    def error(key: str) -> np.ndarray:
        return ar1(config["seed"], f"fc:{key}:{block}", horizon, phi, math.sqrt(1 - phi * phi))

    def sigma(series: str) -> np.ndarray:
        base, growth = noise[series]
        return base + growth * np.sqrt(hours)

    issues = []
    for a in assets:
        if a.kind in ("solar", "wind"):
            values = known.available[a.code][span]
            # Solar is certain to be zero at night; elsewhere the error scales with capacity.
            scale = a.capacity * (known.irradiance[a.node][span] > 0 if a.kind == "solar" else np.ones(horizon))
            band = _band(values, scale, sigma("re_avail"), error(a.code), a.capacity)
            issues.append(Issue("re_avail", a.code, *band))
        elif a.kind == "consumer":
            values = known.available[a.code][span]
            band = _band(values, values, sigma("load"), error(a.code), a.capacity * 1.3)
            issues.append(Issue("load", a.code, *band))
    for series, values in (("rtm_price", known.rtm[span]), ("dam_price", known.dam[span])):
        issues.append(Issue(series, None, *_band(values, values, sigma("price"), error(series), 10_000)))
    return issues
