from datetime import datetime, timezone

import numpy as np
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.portfolio import ActionConfig, Asset
from app.models.run import Action, AssetBlock, Cycle
from app.seed import seed
from app.services import policy
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


def test_events_replan_and_gated_actions_wait_for_approval(
    client: TestClient, db: Session, auth_headers: dict[str, str], monkeypatch
) -> None:
    seed(db)
    db.execute(update(ActionConfig).values(autonomy="approval"))  # every action needs a person
    db.commit()
    run = client.post("/api/runs", json={"preset": "calm_day"}, headers=auth_headers).json()
    url = f"/api/runs/{run['id']}"
    client.post(f"{url}/pause", headers=auth_headers)
    for _ in range(22):
        client.post(f"{url}/step", headers=auth_headers)

    client.post(f"{url}/events", json={"kind": "bess_trip", "asset": "BESS-01", "minutes": 60}, headers=auth_headers)
    cycle = db.scalar(select(Cycle).where(Cycle.trigger == "event"))
    assert cycle is not None and "BESS-01 tripped" in cycle.trigger_detail

    pending = client.get(f"{url}/actions?status=awaiting_approval", headers=auth_headers).json()
    assert pending and all(a["deadline_at"] for a in pending)
    first, *rest = pending
    assert client.post(f"{url}/actions/{first['id']}/approve", headers=auth_headers).status_code == 200
    assert db.get(Action, first["id"]).status == "acked"
    assert client.post(f"{url}/actions/{first['id']}/approve", headers=auth_headers).status_code == 409

    client.post(f"{url}/step", headers=auth_headers)  # the block ends: unanswered approvals lapse
    db.expire_all()
    assert all(db.get(Action, a["id"]).status in ("expired", "superseded") for a in rest)
    assert any(e["kind"] == "bess_trip" for e in client.get(f"{url}/events", headers=auth_headers).json())

    monkeypatch.setattr(settings, "solver_disabled", True)
    client.post(f"{url}/step", headers=auth_headers)
    latest = db.scalar(select(Cycle).where(Cycle.run_id == run["id"]).order_by(Cycle.id.desc()).limit(1))
    assert latest.status == "safe_hold"


def test_configure_test_activate_watch_and_pause(client: TestClient, db: Session, auth_headers: dict[str, str]) -> None:
    seed(db)
    run = client.post("/api/runs", json={"preset": "calm_day"}, headers=auth_headers).json()
    url = f"/api/runs/{run['id']}"
    client.post(f"{url}/pause", headers=auth_headers)
    client.post(f"{url}/step", headers=auth_headers)

    draft = {"asset": "BESS-01", "kind": "battery_discharge", "name": "Discharge Battery 1", "autonomy": "approval",
             "limits": {"max_mw": 12, "auto_max_mw": 6, "reserve_pct": 20}, "approval": {"response_min": 10},
             "watch": [{"metric": "soc_below_pct", "value": 99}]}
    blocked = client.post("/api/sites/KUP-SOLAR-001/configs", json=draft, headers=auth_headers)
    assert blocked.status_code == 422 and blocked.json()["detail"].startswith("Protected boundary")

    draft["limits"]["reserve_pct"] = 50
    saved = client.post("/api/sites/KUP-SOLAR-001/configs", json=draft, headers=auth_headers).json()
    assert saved["current"] is False and saved["active"]["autonomy"] == "auto"
    assert client.post(f"/api/configs/{saved['id']}/activate", headers=auth_headers).status_code == 409
    tested = client.post(f"/api/configs/{saved['id']}/test", headers=auth_headers).json()
    assert len(tested["tests"]) == 3 and all(t["passed"] for t in tested["tests"].values())
    active = client.post(f"/api/configs/{saved['id']}/activate", headers=auth_headers).json()
    assert active["current"] and active["version"] == 2

    client.post(f"{url}/step", headers=auth_headers)  # Battery 1 is below 99 %: the watch condition fires
    db.expire_all()
    latest = db.scalar(select(Cycle).where(Cycle.run_id == run["id"]).order_by(Cycle.id.desc()).limit(1))
    assert latest.trigger == "watch" and "Battery 1" in latest.trigger_detail
    watch = client.get(f"{url}/sites/KUP-SOLAR-001/watch", headers=auth_headers).json()
    assert watch and watch[0]["met"]

    listed = client.get("/api/sites/KUP-SOLAR-001/configs", headers=auth_headers).json()
    discharge = next(c for c in listed if c["kind"] == "battery_discharge")
    assert discharge["id"] == active["id"]
    client.patch(f"/api/configs/{discharge['id']}", json={"status": "paused"}, headers=auth_headers)
    assert "battery_discharge:BESS-01" not in policy.allowed(db, get_portfolio(db).id)
