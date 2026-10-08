import base64

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.seed import seed


def test_portfolio_overview_matches_seeded_capacities(
    client: TestClient, db: Session, auth_headers: dict[str, str]
) -> None:
    assert seed(db)
    assert not seed(db)

    body = client.get("/api/portfolio", headers=auth_headers).json()
    assert body["mode_code"] == "balanced"
    assert body["totals"] == {
        "solar_mw": 320, "wind_mw": 180, "battery_mw": 25, "battery_mwh": 100, "demand_mw": 225,
    }
    assert len(body["sites"]) == 9
    # The client merges these over its mock site list by code.
    assert {s["code"]: (s["kind"], s["generation_mw"]) for s in body["sites"][:5]} == {
        "KUP-SOLAR-001": ("solar", 45), "NEL-SOLAR-002": ("solar", 55), "TIR-WIND-003": ("wind", 65),
        "CHI-HYBRID-004": ("hybrid", 70), "MAD-HYBRID-005": ("hybrid", 45)}
    assert sum("bess" in s["asset_kinds"] for s in body["sites"]) == 2

    site = client.get("/api/sites/KUP-SOLAR-001", headers=auth_headers).json()
    assert [a["code"] for a in site["assets"]] == ["BESS-01", "IC-KUP", "SOL-KUP"]
    assert site["assets"][0]["params"]["energy_mwh"] == 20


def test_portfolio_requires_auth_and_reports_missing_data(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    assert client.get("/api/portfolio").status_code == 401
    assert client.get("/api/portfolio", headers=auth_headers).status_code == 404


def test_settings_and_csv_data_sources(client: TestClient, db: Session, auth_headers: dict[str, str]) -> None:
    seed(db)
    clean = client.patch("/api/portfolio", json={"mode_code": "clean"}, headers=auth_headers)
    assert clean.json()["mode_code"] == "clean"
    assert client.patch("/api/portfolio", json={"mode_code": "reckless"}, headers=auth_headers).status_code == 422

    url = "/api/sites/KUP-SOLAR-001/data-sources"
    upload = lambda text: {"filename": "kuppam.csv", "data": base64.b64encode(text.encode()).decode()}  # noqa: E731
    good = ("timestamp,asset,power_mw,soc_pct,status\n"
            "2026-11-12 10:00,BESS-01,4.2,73,Charging\n2026-11-12 10:15,SOL-KUP,31,,\n")
    checked = client.post(f"{url}/csv/check", json=upload(good), headers=auth_headers).json()
    assert checked["problems"] == [] and checked["rows"] == 2
    assert {c["name"]: c["type"] for c in checked["columns"]} == {
        "timestamp": "DateTime", "asset": "String", "power_mw": "Number", "soc_pct": "Integer", "status": "String"}
    bad = client.post(f"{url}/csv/check", json=upload("time,asset\n10:00,WND-TIR\n"), headers=auth_headers).json()
    assert "Missing column timestamp" in bad["problems"] and "Missing column power_mw" in bad["problems"]
    elsewhere = "timestamp,asset,power_mw\n2026-11-12 10:00,WND-TIR,4\n"
    assert client.post(f"{url}/csv", json=upload(elsewhere), headers=auth_headers).status_code == 422
    assert client.post(f"{url}/csv", json=upload(good), headers=auth_headers).status_code == 201
    assert [s["kind"] for s in client.get(url, headers=auth_headers).json()] == ["csv"]
