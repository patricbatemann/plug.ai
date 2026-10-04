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
    assert sum("bess" in s["asset_kinds"] for s in body["sites"]) == 2

    site = client.get("/api/sites/KUP-SOLAR-001", headers=auth_headers).json()
    assert [a["code"] for a in site["assets"]] == ["BESS-01", "SOL-KUP"]
    assert site["assets"][0]["params"]["energy_mwh"] == 60


def test_portfolio_requires_auth_and_reports_missing_data(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    assert client.get("/api/portfolio").status_code == 401
    assert client.get("/api/portfolio", headers=auth_headers).status_code == 404
