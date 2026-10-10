import contextlib
import json
from datetime import datetime, timezone
from types import SimpleNamespace

import httpx
import numpy as np
import openai
from fastapi.testclient import TestClient
from openai.types.chat import ChatCompletionChunk
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.agent import extract, llm
from app.core.config import settings
from app.models.portfolio import ActionConfig, Asset
from app.models.run import Action, AgentCall, AssetBlock, Cycle, Forecast, MaintenanceTask, Run
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
    sites = {s["code"]: s for s in client.get(f"{url}/sites", headers=auth_headers).json()}
    assert sites["KUP-SOLAR-001"]["battery_mw"] == round(sum(b["mw"] for b in live["batteries"]), 1)
    assert sites["SRC-IND-009"]["net_mw"] < 0  # load only: it draws from the network
    # BOB was not told of the cloud bank. Nellore's feed shows it and pulls Nellore's forecast down, and BOB
    # re-plans on the surprise; Kuppam's feed is not connected, so its forecast does not move.
    p50 = lambda issued, code: db.scalar(select(Forecast.p50).join(Asset, Asset.id == Forecast.asset_id).where(  # noqa: E731
        Forecast.run_id == run["id"], Forecast.issued_block == issued, Asset.code == code))
    assert p50(26, "SOL-NEL")[0] < 0.7 * p50(25, "SOL-NEL")[1]
    assert p50(26, "SOL-KUP")[0] > 0.8 * p50(25, "SOL-KUP")[1]
    assert "Nellore solar array" in live["replanned"] and "below forecast" in live["replanned"]
    assert "Kuppam" not in live["replanned"]

    summary = client.get(f"{url}/summary", headers=auth_headers).json()
    assert summary["block"] == 26
    assert summary["bob"]["unserved_mwh"] == 0
    assert summary["saving_inr"] == summary["baseline"]["cost_inr"] - summary["bob"]["cost_inr"]
    assert summary["actions"] == len(client.get(f"{url}/actions?limit=200", headers=auth_headers).json())
    assert summary["by_people"] == 0
    latest = client.get(f"{url}/decisions/latest", headers=auth_headers).json()
    assert latest["tests"] >= 5 and latest["chosen"]
    decision = client.get(f"/api/runs/decisions/{latest['id']}", headers=auth_headers).json()
    assert len(decision["situation"]) == 6
    assert sum(o["chosen"] for o in decision["options"]) == 1
    assert all(set(o["stress"]) == set(decision["scenarios"]) for o in decision["options"])
    assert client.get(url.replace(f"/{run['id']}", "/current"), headers=auth_headers).json()["mode"] == decision["mode"]
    actions = client.get(f"{url}/actions?limit=5", headers=auth_headers).json()
    assert len(actions) == 5
    # Covering the lost solar takes a trade above BOB's automatic limit: it asks, and trades what it may meanwhile.
    assert {a["status"] for a in actions} <= {"acked", "verified", "rejected", "awaiting_approval"}


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
             "limits": {"max_mw": 8, "auto_max_mw": 6, "reserve_pct": 20}, "approval": {"response_min": 10},
             "watch": [{"metric": "soc_below_pct", "value": 99}]}
    blocked = client.post("/api/sites/KUP-SOLAR-001/configs", json=draft, headers=auth_headers)
    assert blocked.status_code == 422 and blocked.json()["detail"].startswith("Protected boundary")

    market = {**draft, "asset": "IC-KUP", "kind": "grid_import", "limits": {"max_mw": 10}}
    assert "configured once" in client.post("/api/sites/KUP-SOLAR-001/configs", json=market,
                                            headers=auth_headers).json()["detail"]
    offered = client.get("/api/sites/KUP-SOLAR-001/config-options", headers=auth_headers).json()
    assert next(a for a in offered["assets"] if a["code"] == "IC-KUP")["actions"] == []
    draft["limits"].update(reserve_pct=50, max_mwh=3)
    assert "duration cap" in client.post("/api/sites/KUP-SOLAR-001/configs", json=draft, headers=auth_headers).json()["detail"]
    draft["limits"]["max_minutes"] = 30
    draft["preferences"] = {"recovery": "request_import", "notify": ["sms"]}
    saved = client.post("/api/sites/KUP-SOLAR-001/configs", json=draft, headers=auth_headers).json()
    assert saved["current"] is False and saved["active"]["autonomy"] == "auto"
    assert saved["preferences"] == {"objective": "reliability", "recovery": "request_import", "notify": ["sms"]}
    assert client.post(f"/api/configs/{saved['id']}/activate", headers=auth_headers).status_code == 409
    tested = client.post(f"/api/configs/{saved['id']}/test", headers=auth_headers).json()
    assert len(tested["tests"]) == 3 and all(t["passed"] for t in tested["tests"].values())
    active = client.post(f"/api/configs/{saved['id']}/activate", headers=auth_headers).json()
    assert active["current"] and active["version"] == 2

    client.post(f"{url}/step", headers=auth_headers)  # Battery 1 is below 99 %: the watch condition fires
    db.expire_all()
    latest = db.scalar(select(Cycle).where(Cycle.run_id == run["id"]).order_by(Cycle.id.desc()).limit(1))
    assert latest.trigger == "watch" and "Battery 1" in latest.trigger_detail
    client.post(f"{url}/step", headers=auth_headers)  # still below: once per crossing, not every block
    db.expire_all()
    latest = db.scalar(select(Cycle).where(Cycle.run_id == run["id"]).order_by(Cycle.id.desc()).limit(1))
    assert latest.trigger == "tick"
    watch = client.get(f"{url}/sites/KUP-SOLAR-001/watch", headers=auth_headers).json()
    assert watch and watch[0]["met"]

    listed = client.get("/api/sites/KUP-SOLAR-001/configs", headers=auth_headers).json()
    discharge = next(c for c in listed if c["kind"] == "battery_discharge")
    assert discharge["id"] == active["id"]
    client.patch(f"/api/configs/{discharge['id']}", json={"status": "paused"}, headers=auth_headers)
    assert "battery_discharge:BESS-01" not in policy.allowed(db, get_portfolio(db).id)


class FakeModel:
    """Stands in for Azure: `reply(messages)` gives (tool, arguments) to call, or the final text,
    streamed in chunks as the API sends them."""

    def __init__(self, reply) -> None:
        self.reply = reply
        self.chat = SimpleNamespace(completions=self)

    def create(self, messages: list[dict], **_) -> contextlib.nullcontext:
        out = self.reply(messages)
        chunk = lambda delta, usage=None: ChatCompletionChunk.model_validate({  # noqa: E731
            "id": "x", "object": "chat.completion.chunk", "created": 0, "model": "fake", "usage": usage,
            "choices": [{"index": 0, "delta": delta}] if delta else []})
        if isinstance(out, str):
            middle = len(out) // 2
            deltas = [{"content": out[:middle]}, {"content": out[middle:]}]
        else:
            deltas = [{"tool_calls": [{"index": 0, "id": f"call{len(messages)}", "type": "function",
                                       "function": {"name": out[0], "arguments": json.dumps(out[1])}}]}]
        usage = {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
        return contextlib.nullcontext([*map(chunk, deltas), chunk(None, usage)])


def test_bob_decides_within_bounds_falls_back_to_rules_and_chat_never_breaches_limits(
    client: TestClient, db: Session, auth_headers: dict[str, str], monkeypatch
) -> None:
    for name, value in (("bob_enabled", True), ("microsoft_azure_openai_endpoint", "https://fake/openai/v1/"),
                        ("microsoft_azure_openai_key", "k"), ("microsoft_azure_openai_deployment_name", "fake")):
        monkeypatch.setattr(settings, name, value)
    seed(db)
    run = client.post("/api/runs", json={"preset": "calm_day"}, headers=auth_headers).json()
    url = f"/api/runs/{run['id']}"
    db.execute(update(Run).values(live_from_block=0))
    db.commit()
    assert client.post(f"{url}/pause", headers=auth_headers).json()["bob_online"]

    seen = {}

    def cycle(messages: list[dict]):
        last = json.loads(messages[-1]["content"]) if messages[-1]["role"] == "tool" else {}
        if not last:
            return "get_situation", {}
        if "signals" in last:
            return "generate_plans", {}
        if "options" in last:  # try the riskiest option first; BOB may not go past the regret bound
            seen.update(last)
            riskiest = max(last["options"], key=lambda o: o["worst_regret_inr"])
            return "select_plan", {"plan_id": riskiest["plan_id"], "rationale": "Riskiest option."}
        seen["rejection"] = last.get("error")
        return "select_plan", {"plan_id": seen["rule_choice"], "rationale": "Least worst-case regret."}

    monkeypatch.setattr(llm, "_client", lambda: FakeModel(cycle))
    client.post(f"{url}/events", json={"kind": "bess_trip", "asset": "BESS-01", "minutes": 60}, headers=auth_headers)
    decided = db.scalar(select(Cycle).where(Cycle.trigger == "event"))
    riskiest = max(seen["options"], key=lambda o: o["worst_regret_inr"])
    if riskiest["worst_regret_inr"] > seen["allowed_worst_regret_inr"]:
        assert "above the allowed" in seen["rejection"] and decided.rationale == "Least worst-case regret."
    else:
        assert decided.rationale == "Riskiest option."
    assert decided.selected_by == "bob" and decided.timings["agent"] == "ok"

    def down(*_, **__):
        raise openai.APIConnectionError(request=httpx.Request("POST", "https://fake"))

    monkeypatch.setattr(llm, "_client", lambda: SimpleNamespace(chat=SimpleNamespace(
        completions=SimpleNamespace(create=down))))
    client.post(f"{url}/events", json={"kind": "line_derate", "line": "L-NORTH-HUB", "limit_mw": 20, "minutes": 60},
                headers=auth_headers)
    fallback = db.scalar(select(Cycle).order_by(Cycle.id.desc()).limit(1))
    assert fallback.trigger == "event" and fallback.status == "planned" and fallback.selected_by == "rule"
    assert fallback.timings["agent"].startswith("fallback")
    assert [c.outcome for c in db.scalars(select(AgentCall).order_by(AgentCall.id))] == ["ok", "fallback"]

    drafts = db.scalar(select(func.count()).select_from(ActionConfig))
    unchanged = dict.fromkeys(("name", "autonomy", "max_mw", "auto_max_mw", "reserve_pct", "min_price_inr_mwh",
                               "max_minutes", "max_mwh", "deficit_mw", "deficit_minutes", "remove_limits",
                               "objective", "recovery", "notify", "response_min", "watch_threshold"))
    asks = lambda text, **change: lambda messages: text if messages[-1]["role"] == "tool" else (  # noqa: E731
        "draft_action_config", {**unchanged, "asset": "BESS-01", "kind": "battery_discharge", "remove_watch": False,
                                **change})
    monkeypatch.setattr(llm, "_client", lambda: FakeModel(asks("Blocked by a protected limit.", reserve_pct=0)))
    stream = client.post(f"{url}/chat", json={"message": "Remove the minimum battery reserve"}, headers=auth_headers)
    events = [(frame.split("\n")[0].removeprefix("event: "), json.loads(frame.split("\n")[1].removeprefix("data: ")))
              for frame in stream.text.strip().split("\n\n")]
    assert [name for name, _ in events] == ["status", "delta", "delta", "done"]
    assert events[0][1] == "Drafting the setup" and "".join(d for n, d in events if n == "delta") == \
        "Blocked by a protected limit."
    *_, reply = events[-1][1]
    assert reply["cards"][0]["type"] == "blocked" and "30 %" in reply["cards"][0]["text"]
    assert db.scalar(select(func.count()).select_from(ActionConfig)) == drafts
    assert [m["role"] for m in client.get(f"{url}/chat", headers=auth_headers).json()] == ["user", "assistant"]
    assert client.delete(f"{url}/chat", headers=auth_headers).status_code == 204
    assert client.get(f"{url}/chat", headers=auth_headers).json() == []

    # Asked for caps and a start condition, BOB drafts them; the draft waits for a person.
    monkeypatch.setattr(llm, "_client", lambda: FakeModel(asks("Drafted.", max_minutes=30, max_mwh=3, deficit_mw=5,
                                                               deficit_minutes=15, recovery="request_import")))
    stream = client.post(f"{url}/chat", json={"message": "Cap discharge at 30 minutes"}, headers=auth_headers)
    *_, reply = json.loads(stream.text.strip().split("\n\n")[-1].split("\n")[1].removeprefix("data: "))
    draft = reply["cards"][0]
    assert draft["type"] == "draft" and draft["preferences"]["recovery"] == "request_import"
    assert {k: draft["limits"][k] for k in ("max_minutes", "max_mwh", "deficit_mw", "deficit_minutes")} == {
        "max_minutes": 30, "max_mwh": 3, "deficit_mw": 5, "deficit_minutes": 15}
    assert not db.get(ActionConfig, draft["config_id"]).current


def test_storm_bulletin_moves_maintenance_and_brings_an_inspection(
    client: TestClient, db: Session, auth_headers: dict[str, str], monkeypatch
) -> None:
    seed(db)
    run = client.post("/api/runs", json={"preset": "storm_day"}, headers=auth_headers).json()
    url = f"/api/runs/{run['id']}"
    db.execute(update(Run).values(live_from_block=10_000))  # one option per block keeps the test quick
    db.commit()
    client.post(f"{url}/pause", headers=auth_headers)
    for _ in range(21):  # to 11:00, after the bulletin
        client.post(f"{url}/step", headers=auth_headers)

    storm = {"kind": "storm", "targets": ["NORTH"], "start": "2026-11-12 14:30", "end": "2026-11-12 17:30",
             "value": None, "confidence": 0.95, "source_quote": "from 14:30 to 17:30 IST on 12 November 2026"}
    monkeypatch.setattr(extract, "extract", lambda *_, **__: {"summary": "A storm bulletin.", "items": [storm]})
    *_, reply = client.post(f"{url}/documents", json={"sample": "storm_bulletin.pdf"}, headers=auth_headers).json()
    assert [(c["type"], c["status"]) for c in reply["cards"]] == [("constraint", "active")]

    moves = client.get(f"{url}/actions?status=awaiting_approval", headers=auth_headers).json()
    move, = [a for a in moves if a["kind"] == "maintenance_schedule"]
    assert move["asset"] == "Tirupati wind farm" and "storm" in move["reason"]
    assert client.post(f"{url}/actions/{move['id']}/approve", headers=auth_headers).status_code == 200
    task = db.scalar(select(MaintenanceTask))
    db.refresh(task)
    assert task.scheduled_at >= datetime(2026, 11, 12, 12, 0, tzinfo=timezone.utc)  # 17:30 IST or later

    for _ in range(14):  # to 14:30; the calendared job runs for today's practice only
        client.post(f"{url}/step", headers=auth_headers)
    assert db.scalar(select(Cycle).order_by(Cycle.id.desc()).limit(1)).mode == "resilience"
    tir = db.scalar(select(Asset).where(Asset.code == "WND-TIR")).id
    at_two = {r.policy: r.available_mw for r in db.scalars(select(AssetBlock).where(
        AssetBlock.asset_id == tir, AssetBlock.block == 34))}  # 14:00
    assert at_two["baseline"] == 0 and at_two["bob"] > 0

    db.execute(update(Run).values(live_from_block=49))  # inspections are proposed only once someone can answer
    db.commit()
    for _ in range(15):  # past the storm: Gooty runs at 60 %
        client.post(f"{url}/step", headers=auth_headers)
    inspections = [a for a in client.get(f"{url}/actions?status=awaiting_approval", headers=auth_headers).json()
                   if a["kind"] == "inspection_dispatch"]
    assert [a["asset"] for a in inspections] == ["Gooty wind farm"]

    log = client.get(f"{url}/sites/TIR-WIND-003/activity", headers=auth_headers).json()
    assert {"decisions", "maintenance", "events", "documents"} <= {e["category"] for e in log}
    assert any(e["kind"] == "maintenance_schedule" and e["status"] == "verified" for e in log)  # the approved move
    assert [e["at"] for e in log] == sorted((e["at"] for e in log), reverse=True)
    only = client.get(f"{url}/sites/TIR-WIND-003/activity?category=documents", headers=auth_headers).json()
    assert only and {e["category"] for e in only} == {"documents"}

    csv = client.get(f"{url}/sites/TIR-WIND-003/telemetry.csv", headers=auth_headers).text
    assert csv.startswith("timestamp,asset,power_mw") and "WND-TIR" in csv
    tir_api = "https://scada.example.invalid/api/mock/sites/TIR-WIND-003/telemetry"
    tested = client.post("/api/sites/TIR-WIND-003/data-sources/api/test",
                         json={"endpoint": tir_api, "refresh_min": 5}, headers=auth_headers)
    assert tested.json()["problems"] == [] and tested.json()["rows"] == 1
    for wrong in ("ftp://x/api/mock/sites/TIR-WIND-003/telemetry", "https://scada.example.invalid/v1"):
        assert client.post("/api/sites/TIR-WIND-003/data-sources/api/test", json={"endpoint": wrong, "refresh_min": 5},
                           headers=auth_headers).status_code == 422

    kup_api = "http://localhost:5173/api/mock/sites/KUP-SOLAR-001/telemetry"
    feed = client.get("/api/mock/sites/KUP-SOLAR-001/telemetry").json()  # open, like a vendor's sandbox
    assert feed["headers"][:4] == ["timestamp", "device_id", "soc_percent", "battery_power_mw"]
    assert {r[1] for r in feed["rows"]} == {"BESS-01"} and all(len(r) == len(feed["headers"]) for r in feed["rows"])
    assert not client.get(f"{url}/sites/KUP-SOLAR-001/live", headers=auth_headers).json()["connected"]
    connect = lambda site, endpoint: client.post("/api/data-sources/connect", headers=auth_headers, json={  # noqa: E731
        "siteId": site, "endpoint": endpoint, "apiKey": "unused", "refreshIntervalMin": 5})
    assert connect("KUP-SOLAR-001", "https://bms.example.invalid/v1").status_code == 422
    assert connect("KUP-SOLAR-001", kup_api).json() == feed
    connect("KUP-SOLAR-001", kup_api)  # connecting again keeps one source
    assert [s["name"] for s in client.get("/api/sites/KUP-SOLAR-001/data-sources", headers=auth_headers).json()
            if s["kind"] == "api"] == [kup_api]
    assert client.get(f"{url}/sites/KUP-SOLAR-001/live", headers=auth_headers).json()["connected"]
    assert connect("TIR-WIND-003", tir_api).status_code == 422  # no battery


def test_what_if_and_replay_study_leave_the_live_run_alone(
    client: TestClient, db: Session, auth_headers: dict[str, str]
) -> None:
    seed(db)
    run = client.post("/api/runs", json={"preset": "calm_day"}, headers=auth_headers).json()
    url = f"/api/runs/{run['id']}"
    client.post(f"{url}/pause", headers=auth_headers)
    client.post(f"{url}/step", headers=auth_headers)
    change = {"assets_out": ["BESS-01", "BESS-02"], "demand_pct": 10, "renewables_pct": None, "price_pct": None,
              "line_limits": [], "mode": None}
    compared = client.post(f"{url}/what-if", json=change, headers=auth_headers).json()
    assert compared["current"]["feasible"] and compared["what_if"]["feasible"]
    assert not any(a.startswith("Battery") for a in compared["what_if"]["actions"])
    assert compared["what_if"]["net_cost_inr"] > compared["current"]["net_cost_inr"]
    bad = client.post(f"{url}/what-if", json={**change, "assets_out": ["IC-NORTH"]}, headers=auth_headers)
    assert bad.status_code == 422

    study = client.post("/api/studies", json={"preset": "calm_day", "seeds": 2}, headers=auth_headers).json()
    assert [s["seed"] for s in study["seeds"]] == [42, 43] and not any(s["done"] for s in study["seeds"])
    current = client.get("/api/runs/current", headers=auth_headers).json()
    assert current["id"] == run["id"] and not current["lagging"]  # paused: nothing is overdue
    assert client.post("/api/studies", json={"preset": "calm_day", "seeds": 19}, headers=auth_headers).status_code == 409
    assert client.delete(f"/api/studies/{study['id']}", headers=auth_headers).status_code == 204
    assert db.scalar(select(func.count()).select_from(Run).where(Run.study_id.isnot(None))) == 0
