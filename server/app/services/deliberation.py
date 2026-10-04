"""One cycle's decisions, in order: mode → stress scenarios → options → choice. The rules make
them, or BOB does through its tools (app/agent/cycle.py). Every number comes from the solver."""

from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import numpy as np

from app.core.config import settings
from app.optimize.dispatch import Inputs, Plan, here_and_now
from app.optimize.profiles import PROFILES, VARIANT_LABELS, VARIANTS, variant
from app.optimize.robust import choose_option, evaluate, scenarios, solve_all
from app.optimize.situation import Signal, apply_floors

IST = ZoneInfo("Asia/Kolkata")
BLOCK = timedelta(minutes=15)
TOLERANCE = 1.10  # BOB may choose any option within 10 % of the least worst-case regret


@dataclass
class Deliberation:
    inputs: Inputs
    signals: list[Signal]
    forecasts: dict
    storm: tuple[str, int, int] | None
    live: bool
    mode: str = ""
    mode_by: str = "rule"
    mode_reason: str = ""
    floors: list[str] = field(default_factory=list)
    added: set[str] = field(default_factory=set)  # stress scenarios BOB asked for
    options: dict[str, Plan] = field(default_factory=dict)
    robust: dict | None = None
    chosen: str | None = None
    selected_by: str = "rule"
    rationale: str = ""

    @property
    def material(self) -> set[str]:
        return {s.code for s in self.signals if s.material}

    def set_mode(self, mode: str, by: str, reason: str) -> None:
        """Guard floors apply whoever chooses; options made for another mode no longer count."""
        params, self.floors = apply_floors(PROFILES[mode], self.signals)
        self.inputs = replace(self.inputs, profile=params)
        self.mode, self.mode_by, self.mode_reason = mode, by, reason
        self.options, self.robust, self.chosen = {}, None, None

    def cases(self) -> dict[str, Inputs]:
        horizon = len(self.inputs.price)
        band = lambda series, edge: {  # noqa: E731
            c: np.array(getattr(self.forecasts[(series, c)], edge)[:horizon])
            for c in self.inputs.available if (series, c) in self.forecasts}
        return scenarios(self.inputs, band("re_avail", "p10"), band("load", "p90"), self.storm,
                         "corridor" in self.material | self.added)

    def generate(self) -> None:
        """Live blocks weigh five options under stress; fast-forwarded blocks plan one."""
        names = list(VARIANTS) if self.live else ["profile"]
        jobs = [] if settings.solver_disabled else [
            (replace(self.inputs, profile=variant(self.inputs.profile, n)), None, False) for n in names]
        options, seen = {}, set()
        for name, result in zip(names, solve_all(jobs)):
            if np.isnan(result.objective):
                continue
            key = repr(here_and_now(result, self.inputs))
            if key not in seen:  # options that commit to the same actions are one option
                seen.add(key)
                options[name] = result
        robust = evaluate(options, self.inputs, self.cases()) if options and self.live else None
        self.options, self.robust = options, robust

    def worst(self, name: str) -> float:
        return max((s["regret_inr"] if s["regret_inr"] is not None else float("inf"))
                   for s in self.robust[name].values())

    def rule_choice(self) -> str | None:
        if not self.options:
            return None
        if self.robust is None:
            return next(iter(self.options))
        return choose_option(self.robust, {n: p.kpis["cost_inr"] for n, p in self.options.items()})

    def allowed_regret(self) -> float:
        return min(self.worst(n) for n in self.options) * TOLERANCE

    def select(self, name: str, by: str, rationale: str) -> None:
        if name not in self.options:
            raise ValueError(f"No option {name}; generate plans first")
        if self.robust is not None and self.worst(name) > self.allowed_regret():
            raise ValueError(f"Worst-case regret ₹{self.worst(name):,.0f} is above the allowed "
                             f"₹{self.allowed_regret():,.0f} (10 % over the best option)")
        self.chosen, self.selected_by, self.rationale = name, by, rationale

    def finish(self) -> None:
        """The rules make whatever decisions are still open."""
        if not self.options:
            self.generate()
        if self.chosen is None and (name := self.rule_choice()):
            self.select(name, "rule", self._rule_rationale(name))
        if self.chosen is None:
            self.rationale = "Safe hold: no feasible plan, so batteries stay idle and no new trades or calls are made."

    def _rule_rationale(self, chosen: str) -> str:
        if self.robust is None:
            return "Fast-forward block: one option planned for the active mode."
        holds = sum(s["holds"] for s in self.robust[chosen].values())
        tests = len(self.robust[chosen])
        others = sorted(self.worst(n) for n in self.robust if n != chosen)
        runner_up = f"; next best ₹{others[0]:,.0f}" if others else ""
        return (f"Chose “{VARIANT_LABELS[chosen]}”: the smallest worst-case regret, ₹{self.worst(chosen):,.0f}, "
                f"across {tests} stress tests{runner_up}. Keeps all load served in {holds} of {tests}.")


def describe(here: dict, names: dict[str, str], notice: dict[str, int], gate: int, start: datetime) -> list[str]:
    """Here-and-now decisions in words."""
    at = lambda blocks: (start + blocks * BLOCK).astimezone(IST).strftime("%H:%M")  # noqa: E731
    out = []
    for code, mw in here["battery"].items():
        out.append(f"{names[code]}: {'discharge' if mw > 0 else 'charge'} {abs(mw):.1f} MW")
    for code, cap in here["output_cap"].items():
        out.append(f"{names[code]}: limit output to {cap:.1f} MW")
    for code, mw in here["demand_response"].items():
        out.append(f"{names[code]}: demand response {mw:.1f} MW at {at(notice[code])}")
    for code, mw in here["shift"].items():
        out.append(f"{names[code]}: move {abs(mw):.1f} MW of load {'out of' if mw > 0 else 'into'} this block")
    if here["rtm"]:
        side = "buy" if here["rtm"] > 0 else "sell"
        out.append(f"Market: {side} {abs(here['rtm']):.1f} MW for {at(gate)}")
    return out or ["Hold: no change this block"]
