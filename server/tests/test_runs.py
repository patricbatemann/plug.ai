from datetime import datetime, timezone

import numpy as np
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.portfolio import Asset
from app.models.run import AssetBlock
from app.seed import seed
from app.services.portfolio import get_portfolio
from app.services.runs import RunContext, advance, claim_due_run, create_run
from tests.conftest import TestingSession

NOW = datetime(2026, 10, 4, tzinfo=timezone.utc)


def test_same_seed_same_world_and_every_block_balances(db: Session) -> None:
    seed(db)
    run = create_run(db, get_portfolio(db), "demo_story", NOW)
    twin = create_run(db, get_portfolio(db), "demo_story", NOW)
    for _ in range(30):
        advance(db, run, NOW)
    db.commit()

    world, twin_world = RunContext.load(db, run).world(), RunContext.load(db, twin).world()
    assert all(np.array_equal(world.available[c], twin_world.available[c]) for c in world.available)
    assert np.array_equal(world.rtm, twin_world.rtm)

    kinds = dict(db.execute(select(Asset.id, Asset.kind)).all())
    totals: dict[int, float] = {}
    for row in db.scalars(select(AssetBlock).where(AssetBlock.run_id == run.id)):
        sign = -1 if kinds[row.asset_id] == "consumer" else 1
        key = (row.policy, row.block)
        totals[key] = totals.get(key, 0.0) + sign * row.actual_mw
    assert len(totals) == 2 * 30  # both policies
    assert max(abs(v) for v in totals.values()) < 1e-6


def test_only_one_worker_claims_a_due_run(db: Session) -> None:
    seed(db)
    create_run(db, get_portfolio(db), "calm_day", NOW)
    with TestingSession() as first, TestingSession() as second:
        assert claim_due_run(first, NOW) is not None
        assert claim_due_run(second, NOW) is None
        first.rollback()
        assert claim_due_run(second, NOW) is not None


def test_run_controls_events_and_live_overview(
    client: TestClient, db: Session, auth_headers: dict[str, str]
) -> None:
    seed(db)
    run = client.post("/api/runs", json={"preset": "calm_day"}, headers=auth_headers).json()
    url = f"/api/runs/{run['id']}"
    assert client.get(f"{url}/sites/KUP-SOLAR-001/live", headers=auth_headers).status_code == 409

    assert client.post(f"{url}/pause", headers=auth_headers).json()["status"] == "paused"
    for _ in range(26):  # to 12:00, mid-day sun
        state = client.post(f"{url}/step", headers=auth_headers).json()
    assert state["block"] == 25

    bad = client.post(f"{url}/events", json={"kind": "bess_trip", "asset": "SOL-KUP", "minutes": 30},
                      headers=auth_headers)
    assert bad.status_code == 422
    client.post(f"{url}/events", json={"kind": "cloud_bank", "node": "SOUTH", "depth": 0.6, "minutes": 120},
                headers=auth_headers)
    client.post(f"{url}/step", headers=auth_headers)

    live = client.get(f"{url}/sites/KUP-SOLAR-001/live", headers=auth_headers).json()
    titles = {a["title"] for a in live["alerts"]}
    assert {"Cloud bank over the site", "Generation is below forecast"} <= titles
    assert live["batteries"][0]["code"] == "BESS-01"
    assert {p["group"] for p in live["chart"]} == {"Actual generation", "Forecast", "Planned battery"}

    summary = client.get(f"{url}/summary", headers=auth_headers).json()
    assert summary["block"] == 26
    assert summary["bob"]["unserved_mwh"] == 0
    assert summary["saving_inr"] == summary["baseline"]["cost_inr"] - summary["bob"]["cost_inr"]
    latest = client.get(f"{url}/decisions/latest", headers=auth_headers).json()
    assert latest["tests"] >= 5 and latest["chosen"]
    decision = client.get(f"/api/runs/decisions/{latest['id']}", headers=auth_headers).json()
    assert len(decision["situation"]) == 6
    assert sum(o["chosen"] for o in decision["options"]) == 1
    assert all(set(o["stress"]) == set(decision["scenarios"]) for o in decision["options"])
    assert client.get(url.replace(f"/{run['id']}", "/current"), headers=auth_headers).json()["mode"] == decision["mode"]
    actions = client.get(f"{url}/actions?limit=5", headers=auth_headers).json()
    assert len(actions) == 5
    assert {a["status"] for a in actions} <= {"acked", "verified", "rejected"}
