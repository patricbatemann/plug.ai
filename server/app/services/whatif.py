"""What-if: plan the block in progress again with hypothetical changes and compare it with the plan
for current conditions. Nothing is executed. Used by the Simulation page and by Ask BOB."""

from dataclasses import asdict, replace
from typing import Literal

import numpy as np
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import Cycle, Run
from app.optimize.dispatch import here_and_now
from app.optimize.profiles import PROFILES
from app.optimize.robust import solve_all
from app.optimize.situation import Signal, apply_floors
from app.services import runs
from app.services.deliberation import describe
from app.services.dispatch import bob_inputs, latest_forecasts


class LineLimit(BaseModel):
    line: str
    limit_mw: float


class WhatIf(BaseModel):
    """Re-plan the block in progress with hypothetical changes and compare with the plan for current
    conditions. Percentages change the forecast (10 means +10 %). Nothing is executed."""
    assets_out: list[str]
    demand_pct: float | None
    renewables_pct: float | None
    price_pct: float | None
    line_limits: list[LineLimit]
    mode: Literal[tuple(PROFILES)] | None


def what_if(db: Session, run: Run, a: WhatIf) -> dict:
    ctx = runs.RunContext.load(db, run)
    t0 = min(run.current_block + 1, run.total_blocks - 1)
    latest = db.scalar(select(Cycle).where(Cycle.run_id == run.id).order_by(Cycle.id.desc()).limit(1))
    signals = [Signal(**s) for s in latest.situation] if latest else []
    base = bob_inputs(db, ctx, ctx.world(), run, t0, latest_forecasts(db, ctx, run, t0))
    base = replace(base, profile=apply_floors(PROFILES[run.mode_code], signals)[0])
    kind = {s.code: s.kind for s in ctx.assets}
    available, bess = dict(base.available), dict(base.bess_available)
    for code in a.assets_out:
        if kind.get(code) == "bess":
            bess[code] = np.zeros_like(bess[code])
        elif kind.get(code) in ("solar", "wind"):
            available[code] = np.zeros_like(available[code])
        else:
            raise ValueError(f"{code} is not a battery or generator")
    for pct, kinds in ((a.demand_pct, ("consumer",)), (a.renewables_pct, ("solar", "wind"))):
        if pct is not None:
            available = {c: v * (1 + pct / 100) if kind[c] in kinds else v for c, v in available.items()}
    limits = dict(base.line_limit)
    for x in a.line_limits:
        if x.line not in limits:
            raise ValueError(f"Unknown line {x.line}")
        limits[x.line] = x.limit_mw
    changed = replace(base, available=available, bess_available=bess, line_limit=limits,
                      price=base.price * (1 + (a.price_pct or 0) / 100))
    if a.mode:
        changed = replace(changed, profile=apply_floors(PROFILES[a.mode], signals)[0])
    notice = {s.code: s.params.get("dr_notice_blocks", 0) for s in ctx.assets if s.kind == "consumer"}
    start = run.sim_start_at + t0 * runs.BLOCK

    def brief(p, inputs) -> dict:
        if np.isnan(p.objective):
            return {"feasible": False}
        return {"feasible": True, "net_cost_inr": round(p.kpis["cost_inr"]), "carbon_t": round(p.kpis["carbon_t"], 1),
                "curtailed_mwh": round(p.kpis["curtailed_mwh"], 1), "unserved_mwh": round(p.kpis["unserved_mwh"], 2),
                "actions": describe(asdict(here_and_now(p, inputs)), ctx.names, notice,
                                    ctx.market["gate_blocks"], start)}

    current, alternative = solve_all([(base, None, False), (changed, None, False)])
    result = {"current": brief(current, base), "what_if": brief(alternative, changed),
              "changes": {k: v for k, v in a.model_dump().items() if v not in (None, [])}}
    return result
