"""Options under uncertainty (docs/spec/01 §7, §9): build stress scenarios, test each option's
here-and-now decisions against them, and choose by least worst-case regret."""

import multiprocessing
from concurrent.futures import ProcessPoolExecutor
from dataclasses import replace

import numpy as np

from app.core.config import settings
from app.optimize.dispatch import HereAndNow, Inputs, Plan, here_and_now, plan

STRESS_BLOCKS = 8  # two hours
SCENARIO_LABELS = {
    "expected": "Expected (P50)",
    "re_low": "Renewables at P10",
    "demand_high": "Demand at P90",
    "bess_out": "Largest battery out",
    "price_spike": "Evening price ×2",
    "storm": "Storm cuts wind",
    "corridor": "Corridor limits −30 %",
}

_pool: ProcessPoolExecutor | None = None


def _solve(job: tuple[Inputs, HereAndNow | None, bool]) -> Plan:
    return plan(*job)


def solve_all(jobs: list[tuple[Inputs, HereAndNow | None, bool]]) -> list[Plan]:
    """Solve independent jobs, in a process pool when one is configured."""
    global _pool
    if settings.solver_processes <= 1 or len(jobs) == 1:
        return [_solve(job) for job in jobs]
    if _pool is None:
        # Compute only: workers hold no state between jobs. Forkserver starts them from a clean
        # process, so they inherit no threads or database connections from the API or worker.
        context = multiprocessing.get_context("forkserver")
        context.set_forkserver_preload(["app.optimize.dispatch"])
        _pool = ProcessPoolExecutor(settings.solver_processes, mp_context=context)
    return list(_pool.map(_solve, jobs))


def scenarios(inp: Inputs, re_p10: dict[str, np.ndarray], load_p90: dict[str, np.ndarray],
              storm: tuple[str, int, int] | None, corridor: bool) -> dict[str, Inputs]:
    near = slice(0, STRESS_BLOCKS)

    def with_available(codes: list[str], source: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
        out = dict(inp.available)
        for c in codes:
            out[c] = out[c].copy()
            out[c][near] = source[c][near]
        return out

    gens = [a for a in inp.assets if a.kind in ("solar", "wind")]
    out = {
        "expected": inp,
        "re_low": replace(inp, available=with_available([a.code for a in gens], re_p10)),
        "demand_high": replace(inp, available=with_available(list(load_p90), load_p90)),
    }
    batteries = [a for a in inp.assets if a.kind == "bess" and inp.bess_available[a.code][0] > 0]
    if batteries:
        largest = max(batteries, key=lambda a: a.capacity).code
        available = dict(inp.bess_available)
        available[largest] = available[largest].copy()
        available[largest][1:1 + STRESS_BLOCKS] = 0
        out["bess_out"] = replace(inp, bess_available=available)
    evening = (inp.hour >= 18) & (inp.hour < 22)
    out["price_spike"] = replace(inp, price=np.where(evening, inp.price * 2, inp.price))
    if storm:
        node, start, end = storm
        available = dict(inp.available)
        for a in gens:
            if a.node == node:
                available[a.code] = available[a.code].copy()
                available[a.code][start:end] *= 0.0 if a.kind == "wind" else 0.2
        out["storm"] = replace(inp, available=available)
    if corridor:
        out["corridor"] = replace(inp, line_limit={c: 0.7 * v for c, v in inp.line_limit.items()})
    return out


def evaluate(options: dict[str, Plan], base: Inputs, cases: dict[str, Inputs]) -> dict[str, dict[str, dict]]:
    """For each option and scenario: regret (₹ against the best possible under that scenario),
    whether all load stays served, and any shortfall against the (soft) reserve target."""
    commitments = {name: here_and_now(p, base) for name, p in options.items()}
    jobs = [(case, None, True) for case in cases.values()]
    jobs += [(case, commitments[name], True) for name in options for case in cases.values()]
    results = solve_all(jobs)
    best = dict(zip(cases, results[: len(cases)]))
    out, rest = {}, iter(results[len(cases):])
    for name in options:
        out[name] = {}
        for scenario in cases:
            r = next(rest)
            feasible = not np.isnan(r.objective)
            out[name][scenario] = {
                "regret_inr": round(r.objective - best[scenario].objective) if feasible else None,
                "holds": feasible and r.kpis["unserved_mwh"] < 1e-3,
                "reserve_shortfall_mwh": round(r.kpis["reserve_shortfall_mwh"], 2) if feasible else None,
            }
    return out


def choose_option(robust: dict[str, dict[str, dict]], expected_cost: dict[str, float]) -> str:
    """Least worst-case regret; ties go to the cheaper expected cost."""
    worst = {name: max((s["regret_inr"] if s["regret_inr"] is not None else float("inf")) for s in scenarios.values())
             for name, scenarios in robust.items()}
    return min(worst, key=lambda name: (worst[name], expected_cost[name]))
