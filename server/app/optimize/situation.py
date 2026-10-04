"""Situation signals and the rule that picks the operating mode (docs/spec/01 §6, §8).
Rules also set guard floors that apply whoever chooses the mode."""

from dataclasses import asdict, dataclass

import numpy as np

from app.optimize.dispatch import Inputs
from app.optimize.profiles import PROFILES

NEXT_BLOCKS = 8  # two hours
PRECEDENCE = ("resilience", "grid_support", "economic", "clean")


@dataclass
class Signal:
    code: str
    label: str
    value: str
    threshold: str
    material: bool
    mode: str  # the mode this signal calls for when material

    def __post_init__(self) -> None:
        self.material = bool(self.material)  # numpy comparisons yield numpy booleans


def assess(inp: Inputs, base_line_limits: dict[str, float], day_ahead_price: np.ndarray,
           storm_ahead: bool, spike_ahead: str | None) -> list[Signal]:
    """`spike_ahead` describes a price spike the market has announced (a revealed event).
    Forecast ratios alone are too noisy to call a spike: normal days reach ~150 %."""
    batteries = [a for a in inp.assets if a.kind == "bess"]
    out = [a.code for a in batteries if inp.bess_available[a.code][0] == 0]
    # Hour-long averages, so one noisy block cannot flip the mode.
    hourly = lambda x: np.convolve(x, np.ones(4) / 4, mode="valid") if len(x) >= 4 else x  # noqa: E731
    ratio = hourly(inp.price) / np.maximum(hourly(day_ahead_price), 1)
    derated = [c for c, limit in inp.line_limit.items() if limit < base_line_limits[c] - 1e-6]
    near = slice(0, NEXT_BLOCKS)
    surplus = (sum(inp.available[a.code][near] for a in inp.assets if a.kind in ("solar", "wind"))
               - sum(inp.available[a.code][near] for a in inp.assets if a.kind == "consumer"))
    outlet = (sum(a.params["export_max_mw"] for a in inp.assets if a.kind == "interconnection")
              + sum(a.capacity * inp.bess_available[a.code][0] for a in batteries))
    available_power = sum(a.capacity * inp.bess_available[a.code][0] for a in batteries)
    requirement = PROFILES["balanced"]["reserve_share"] * sum(a.capacity for a in batteries)
    return [
        Signal("storm", "Storm warning within 6 hours", "yes" if storm_ahead else "no", "any", storm_ahead,
               "resilience"),
        Signal("outage", "Battery outage with thin reserve",
               f"{', '.join(out) or 'none'} out; {available_power:.0f} MW available", f"< {1.2 * requirement:.0f} MW",
               bool(out) and available_power < 1.2 * requirement, "resilience"),
        Signal("frequency", "Grid frequency", f"{inp.frequency:.2f} Hz", "outside 49.90–50.05 Hz",
               not 49.90 <= inp.frequency <= 50.05, "grid_support"),
        Signal("corridor", "Corridor derated", ", ".join(derated) or "none", "any derate", bool(derated),
               "grid_support"),
        Signal("price", "Price spike ahead",
               spike_ahead or f"real-time up to {ratio.max():.0%} of day-ahead (hourly)",
               "announced spike, or > 160 %", spike_ahead is not None or bool(ratio.max() > 1.6), "economic"),
        Signal("surplus", "Renewable surplus vs export and charging room, next 2 h",
               f"{surplus.max():.0f} MW vs {outlet:.0f} MW", "surplus above room", bool(surplus.max() > outlet),
               "clean"),
    ]


def choose_mode(signals: list[Signal], default: str) -> tuple[str, str]:
    """The highest-precedence mode a material signal calls for, and why."""
    for mode in PRECEDENCE:
        hit = next((s for s in signals if s.material and s.mode == mode), None)
        if hit:
            return mode, f"{hit.label}: {hit.value} ({hit.threshold})."
    return default, "No material signal; the operator's default mode applies."


def apply_floors(params: dict, signals: list[Signal]) -> tuple[dict, list[str]]:
    """Guard floors hold whichever mode is chosen (by rule, operator or BOB)."""
    out, applied = dict(params), []
    material = {s.code for s in signals if s.material}
    if "storm" in material:
        out["reserve_share"] = max(out["reserve_share"], PROFILES["resilience"]["reserve_share"])
        out["soc_floor_pct"] = max(out["soc_floor_pct"], PROFILES["resilience"]["soc_floor_pct"])
        applied.append("Storm: reserve at least 60 % of battery power, charge floor 50 %")
    if material & {"frequency", "corridor"}:
        out["lambda_deviation"] = max(out["lambda_deviation"], 1500.0)
        applied.append("Grid stress: schedule deviation priced at least ₹1,500/MWh")
    return out, applied


def to_json(signals: list[Signal]) -> list[dict]:
    return [asdict(s) for s in signals]
