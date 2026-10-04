"""The simulated world's truth: pure functions of the run config, the assets and the events.

Every series is computed for all blocks at once, so any replica can rebuild it from the
database alone and the BOB run and its baseline twin see exactly the same world.
"""

import math
import zlib
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

import numpy as np

BLOCK_MIN = 15
BLOCKS_PER_DAY = 96
SUNRISE_H, SUNSET_H = 6.2, 17.8
PRICE_CAP = 10_000.0
# Day-ahead price shape by hour (₹/MWh): night, morning, solar trough, evening peak.
DAM_BY_HOUR = np.array(
    [3500] * 6 + [4500] * 3 + [2500] * 7 + [5000] * 2 + [6500] * 4 + [5000] * 2, dtype=float
)
LOAD_PROFILES = {
    "steel": lambda h: np.full_like(h, 0.85),
    "cement": lambda h: np.where((h >= 18) & (h < 22), 0.6, 0.8),
    "textiles": lambda h: 0.25 + 0.65 * ((h >= 8) & (h < 18)),
    "chemicals": lambda h: np.full_like(h, 0.9),
    "data_centre": lambda h: 0.85 + 0.05 * np.sin(2 * np.pi * (h - 14) / 24),
    "automotive": lambda h: 0.3 + 0.6 * ((h >= 6) & (h < 22)),
}


@dataclass(frozen=True)
class AssetSpec:
    code: str
    kind: str
    node: str
    capacity: float
    params: dict[str, Any] = field(hash=False)


@dataclass(frozen=True)
class EventSpec:
    kind: str
    start_min: float  # minutes after the run start
    payload: dict[str, Any] = field(hash=False)

    @property
    def end_min(self) -> float:
        return self.start_min + self.payload.get("minutes", 0)


@lru_cache(maxsize=512)
def _ar1_cached(seed: int, key: str, n: int, phi: float, sigma: float) -> np.ndarray:
    series = ar1(seed, key, n, phi, sigma)
    series.flags.writeable = False
    return series


def ar1(seed: int, key: str, n: int, phi: float, sigma: float) -> np.ndarray:
    """A reproducible AR(1) path; `key` separates independent series under one seed."""
    rng = np.random.default_rng([seed, zlib.crc32(key.encode())])
    shocks = rng.normal(0.0, sigma, n)
    out = np.empty(n)
    level = rng.normal(0.0, sigma / math.sqrt(1 - phi * phi))
    for i in range(n):
        level = phi * level + shocks[i]
        out[i] = level
    return out


class World:
    def __init__(self, config: dict[str, Any], assets: list[AssetSpec], line_limits: dict[str, float],
                 start_min: int, n: int, events: list[EventSpec]) -> None:
        self.n = n
        self.seed = config["seed"]
        minutes = start_min + BLOCK_MIN * np.arange(n)
        self.hour = ((minutes + BLOCK_MIN / 2) / 60) % 24
        self.day = minutes // (24 * 60)
        self._block_start = BLOCK_MIN * np.arange(n)
        self.events = events

        weather = config["weather"]
        nodes = sorted({a.node for a in assets})
        base_cloud = {node: self._cloud(node, weather["cloud_mean"]) for node in nodes}
        bank = {node: self._cloud_bank(node) for node in nodes}
        self.cloud = {node: np.minimum(1, base_cloud[node] + bank[node]) for node in nodes}
        self.wind_speed = {node: self._wind_speed(node, weather["wind_mean_ms"]) for node in nodes}
        self.temperature = 22 + 9 * np.clip(np.sin(np.pi * (self.hour - 7) / 12), -0.4, 1)
        self.irradiance = {
            node: 1000 * self._clear_sky() * (1 - 0.8 * base_cloud[node]) * (1 - bank[node])
            for node in nodes
        }

        self.available: dict[str, np.ndarray] = {}
        for a in assets:
            if a.kind == "solar":
                self.available[a.code] = self._solar(a, self.irradiance[a.node])
            elif a.kind == "wind":
                self.available[a.code] = self._wind(a)
            elif a.kind == "consumer":
                self.available[a.code] = self._load(a, config["noise"]["load"][0])
            elif a.kind == "bess":
                self.available[a.code] = a.capacity * (1 - self._mask("bess_trip", asset=a.code))
        self.line_limit = {code: self._line_limit(code, limit) for code, limit in line_limits.items()}
        self.dam, self.rtm = self._prices()
        self.frequency = self._frequency()
        self.emission_factor = 0.71 * (
            1 + 0.1 * ((self.hour >= 18) & (self.hour < 23)) - 0.1 * ((self.hour >= 10) & (self.hour < 16))
        )

    def _events(self, kind: str, **match: str) -> list[EventSpec]:
        return [e for e in self.events
                if e.kind == kind and all(e.payload.get(k) == v for k, v in match.items())]

    def _window(self, event: EventSpec) -> np.ndarray:
        return (self._block_start < event.end_min) & (self._block_start + BLOCK_MIN > event.start_min)

    def _mask(self, kind: str, **match: str) -> np.ndarray:
        mask = np.zeros(self.n, dtype=bool)
        for e in self._events(kind, **match):
            mask |= self._window(e)
        return mask.astype(float)

    def _clear_sky(self) -> np.ndarray:
        phase = (self.hour - SUNRISE_H) / (SUNSET_H - SUNRISE_H)
        return np.where((phase > 0) & (phase < 1), np.sin(np.pi * np.clip(phase, 0, 1)) ** 1.2, 0.0)

    def _cloud(self, node: str, mean: float) -> np.ndarray:
        logit = math.log(mean / (1 - mean)) + _ar1_cached(self.seed, f"cloud:{node}", self.n, 0.95, 0.35)
        cloud = 1 / (1 + np.exp(-logit))
        return np.where(self._mask("storm", node=node) > 0, 0.95, cloud)

    def _cloud_bank(self, node: str) -> np.ndarray:
        """Fraction of solar output a cloud bank removes in each block."""
        depth = np.zeros(self.n)
        for e in self._events("cloud_bank", node=node):
            depth = np.maximum(depth, self._window(e) * e.payload["depth"])
        return depth

    def _wind_speed(self, node: str, mean: float) -> np.ndarray:
        speed = mean * (1 + 0.15 * np.sin(2 * np.pi * (self.hour - 9) / 24))
        speed = speed + _ar1_cached(self.seed, f"wind:{node}", self.n, 0.97, 0.9)
        for e in self._events("wind_ramp", node=node):
            speed = speed + self._window(e) * e.payload["delta_ms"]
        return np.where(self._mask("storm", node=node) > 0, 30.0, np.maximum(speed, 0))

    def _solar(self, a: AssetSpec, irradiance: np.ndarray) -> np.ndarray:
        out = a.capacity * 0.92 * irradiance / 1000
        out = out * (1 + _ar1_cached(self.seed, f"solar:{a.code}", self.n, 0.9, 0.03))
        return np.clip(out, 0, a.capacity)

    def _wind(self, a: AssetSpec) -> np.ndarray:
        p = a.params
        speed = self.wind_speed[a.node] * (1 + _ar1_cached(self.seed, f"wind:{a.code}", self.n, 0.9, 0.03))
        ramp = np.clip((speed - p["cut_in"]) / (p["rated"] - p["cut_in"]), 0, 1) ** 3
        return a.capacity * np.where((speed < p["cut_in"]) | (speed >= p["cut_out"]), 0.0, ramp)

    def _load(self, a: AssetSpec, sigma: float) -> np.ndarray:
        shape = LOAD_PROFILES[a.params["segment"]](self.hour)
        load = a.capacity * shape * (1 + _ar1_cached(self.seed, f"load:{a.code}", self.n, 0.9, sigma))
        for e in self._events("demand_surge"):
            if a.code in e.payload["assets"]:
                load = load * (1 + self._window(e) * e.payload["pct"] / 100)
        return np.clip(load, 0, a.capacity * 1.3)

    def _line_limit(self, code: str, limit: float) -> np.ndarray:
        out = np.full(self.n, limit)
        for e in self._events("line_derate", line=code):
            out = np.where(self._window(e), e.payload["limit_mw"], out)
        return out

    def _prices(self) -> tuple[np.ndarray, np.ndarray]:
        dam = DAM_BY_HOUR[self.hour.astype(int)] * (1 + 0.04 * np.sin(2 * np.pi * self.day / 7))
        rtm = dam * np.exp(_ar1_cached(self.seed, "rtm", self.n, 0.8, 0.08))
        for e in self._events("price_spike"):
            event_day = e.start_min // (24 * 60)
            spike = ((self._block_start >= e.start_min) & (self.day == event_day)
                     & (self.hour >= e.payload["from_hh"]) & (self.hour < e.payload["to_hh"]))
            rtm = np.where(spike, rtm * e.payload["mult"], rtm)
        return np.clip(dam, 0, PRICE_CAP), np.clip(rtm, 0, PRICE_CAP)

    def _frequency(self) -> np.ndarray:
        freq = np.clip(50 + _ar1_cached(self.seed, "frequency", self.n, 0.8, 0.012), 49.85, 50.15)
        for e in self._events("frequency_dip"):
            freq = np.where(self._window(e), e.payload["hz"], freq)
        return freq
