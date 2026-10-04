from datetime import datetime, timezone

import numpy as np
from sqlalchemy.orm import Session

from app.optimize.dispatch import DT, plan
from app.optimize.validator import check
from app.seed import seed
from app.services.dispatch import bob_inputs, latest_forecasts
from app.services.portfolio import get_portfolio
from app.services.runs import RunContext, advance, create_run

NOW = datetime(2026, 10, 4, tzinfo=timezone.utc)


def test_plan_balances_respects_battery_limits_and_trades_only_after_the_gate(db: Session) -> None:
    seed(db)
    run = create_run(db, get_portfolio(db), "demo_story", NOW)
    for _ in range(25):  # to midday, with batteries and markets in play
        advance(db, run, NOW)
    ctx = RunContext.load(db, run)
    t0 = run.current_block + 1
    inputs = bob_inputs(db, ctx, ctx.world(), run, t0, latest_forecasts(db, ctx, run, t0))
    p = plan(inputs)
    assert p.kpis["unserved_mwh"] == 0

    supply = sum(p.generation.values()) + sum(p.battery.values()) + sum(p.exchange.values())
    served = sum(inputs.available[c] - p.demand_response[c] - p.shift[c] - p.unserved[c] for c in p.unserved)
    assert np.allclose(supply, served, atol=1e-4)

    for a in (a for a in inputs.assets if a.kind == "bess"):
        e, params = a.params["energy_mwh"], a.params
        assert np.all(np.abs(p.battery[a.code]) <= a.capacity + 1e-6)
        assert np.all(p.soc[a.code] >= e * params["soc_min_pct"] / 100 - 1e-6)
        assert p.soc[a.code][-1] >= min(inputs.soc_mwh[a.code], e * params["soc_max_pct"] / 100) - 1e-4
        charge, discharge = np.maximum(-p.battery[a.code], 0), np.maximum(p.battery[a.code], 0)
        previous = np.concatenate([[inputs.soc_mwh[a.code]], p.soc[a.code][:-1]])
        expected = previous + DT * (params["eta_c"] * charge - discharge / params["eta_d"])
        assert np.allclose(p.soc[a.code], expected, atol=1e-4)

    assert np.all(p.rtm[: inputs.market["gate_blocks"]] == 0)


def test_validator_rejects_unsafe_actions(db: Session) -> None:
    seed(db)
    ctx = RunContext.load(db, create_run(db, get_portfolio(db), "calm_day", NOW))
    battery = next(a for a in ctx.assets if a.code == "BESS-01")  # 15 MW, 60 MWh, 10–95 %
    steel = next(a for a in ctx.assets if a.code == "IND-1")  # 15 MW demand response, 2 blocks' notice
    assert check("bess_discharge", 10, battery, soc_mwh=30) is None
    assert "exceeds" in check("bess_discharge", 20, battery, soc_mwh=30)
    assert "State of charge" in check("bess_discharge", 10, battery, soc_mwh=7)
    assert "unavailable" in check("bess_charge", 5, battery, soc_mwh=30, available=False)
    assert "notice" in check("dr_call", 5, steel, lead_blocks=1)
