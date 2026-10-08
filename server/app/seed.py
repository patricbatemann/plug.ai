"""Seed the demo portfolio and start its story run: `python -m app.seed`. Safe to repeat."""

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.portfolio import ActionConfig, Asset, Line, Node, Portfolio, Site
from app.schemas.portfolio import validate_params
from app.services import runs
from app.services.portfolio import get_portfolio
from app.sim.market import DEFAULT_MARKET

# Organisation limits that no configured action can loosen.
PROTECTED = {"battery_soc_floor_pct": 30, "approval_above_mw": 100}
# Configured battery reserve, above the protected emergency floor.
BATTERY_RESERVE_PCT = 55

NODES = {"NORTH": "North wind corridor", "SOUTH": "South solar corridor", "HUB": "Sri City load hub"}
LINES = [("L-NORTH-HUB", "NORTH", "HUB", 120), ("L-SOUTH-HUB", "SOUTH", "HUB", 260)]


def solar(comp: float = 0) -> dict[str, Any]:
    return {"curtailable": True, "curtail_comp_inr_mwh": comp}


def wind(comp: float = 0) -> dict[str, Any]:
    return {**solar(comp), "cut_in": 3, "rated": 12, "cut_out": 25}


def bess(energy: float, power: float) -> dict[str, Any]:
    return {
        "energy_mwh": energy, "p_max_mw": power, "eta_c": 0.95, "eta_d": 0.95,
        "soc_min_pct": 10, "soc_max_pct": 95, "cycles_per_day": 1.5, "deg_cost_inr_mwh": 1500,
    }


def consumer(segment: str, critical: float, dr: float = 0, notice: int = 0, dr_mwh: float = 0,
             incentive: float = 0, shift: float = 0, window: tuple[int, int] | None = None) -> dict[str, Any]:
    return {
        "segment": segment, "critical_mw": critical, "dr_max_mw": dr, "dr_notice_blocks": notice,
        "dr_energy_mwh_day": dr_mwh, "dr_incentive_inr_mwh": incentive, "shift_max_mw": shift,
        "shift_window": window, "shift_cost_inr_mwh": 500 if shift else 0,
    }


# (code, name, kind, location, commissioned, node, [(code, name, kind, capacity_mw, params)])
SITES = [
    ("KUP-SOLAR-001", "Kuppam Solar Site", "solar", "Chittoor, Andhra Pradesh", date(2021, 3, 15), "SOUTH", [
        ("SOL-KUP", "Kuppam solar array", "solar", 45, solar()),
        ("BESS-01", "Battery 1", "bess", 8, bess(20, 8)),
        # Import only: exporting first would sell south solar before it reaches the hub's load.
        ("IC-KUP", "Kuppam grid connection", "interconnection", 50, {"import_max_mw": 50, "export_max_mw": 0}),
    ]),
    ("NEL-SOLAR-002", "Nellore Solar", "solar", "Nellore, Andhra Pradesh", date(2020, 11, 2), "SOUTH", [
        ("SOL-NEL", "Nellore solar array", "solar", 55, solar()),
    ]),
    ("TIR-WIND-003", "Tirupati Wind", "wind", "Tirupati, Andhra Pradesh", date(2019, 6, 20), "NORTH", [
        ("WND-TIR", "Tirupati wind farm", "wind", 65, wind(comp=3200)),
    ]),
    ("CHI-HYBRID-004", "Chittoor Hybrid", "hybrid", "Chittoor, Andhra Pradesh", date(2022, 1, 10), "SOUTH", [
        ("SOL-CHI", "Chittoor solar array", "solar", 70, solar()),
        ("BESS-02", "Battery 2", "bess", 17, bess(80, 17)),
    ]),
    ("MAD-HYBRID-005", "Madanapalle Hybrid", "hybrid", "Annamayya, Andhra Pradesh", date(2023, 2, 28), "SOUTH", [
        ("SOL-MAD", "Madanapalle solar array", "solar", 45, solar()),
    ]),
    ("KDR-SOLAR-006", "Kadiri Solar", "solar", "Sri Sathya Sai, Andhra Pradesh", date(2018, 8, 5), "SOUTH", [
        ("SOL-KDR", "Kadiri solar park", "solar", 105, solar(comp=2600)),
    ]),
    ("ATP-WIND-007", "Anantapur Wind", "wind", "Anantapur, Andhra Pradesh", date(2017, 9, 12), "NORTH", [
        ("WND-ATP", "Anantapur wind farm", "wind", 60, wind()),
        ("IC-NORTH", "North grid interconnection", "interconnection", 40,
         {"import_max_mw": 20, "export_max_mw": 40}),
    ]),
    ("GTY-WIND-008", "Gooty Wind", "wind", "Anantapur, Andhra Pradesh", date(2020, 4, 18), "NORTH", [
        ("WND-GTY", "Gooty wind farm", "wind", 55, wind()),
    ]),
    ("SRC-IND-009", "Sri City Industrial Cluster", "industrial", "Tirupati, Andhra Pradesh", date(2016, 1, 1), "HUB", [
        ("IND-1", "Steel plant", "consumer", 70, consumer("steel", 30, 15, 2, 30, 5000, 10, (10, 17))),
        ("IND-2", "Cement plant", "consumer", 35, consumer("cement", 10, 10, 4, 20, 4500, 8, (9, 17))),
        ("IND-3", "Textile mill", "consumer", 25, consumer("textiles", 5, 5, 2, 8, 4000, 5, (8, 18))),
        ("IND-4", "Chemicals plant", "consumer", 45, consumer("chemicals", 30, 5, 4, 6, 6000)),
        ("IND-5", "Data centre", "consumer", 20, consumer("data_centre", 20)),
        ("IND-6", "Auto plant", "consumer", 30, consumer("automotive", 10, 8, 2, 12, 5000, 6, (10, 16))),
        ("IC-HUB", "Hub grid interconnection", "interconnection", 250,
         {"import_max_mw": 250, "export_max_mw": 150}),
    ]),
]


def seed(db: Session) -> bool:
    if db.scalar(select(Portfolio.id).limit(1)) is not None:
        return False
    portfolio = Portfolio(name="Andhra Pradesh renewable portfolio", tz="Asia/Kolkata", mode_code="balanced",
                          market=DEFAULT_MARKET, protected=PROTECTED)
    db.add(portfolio)
    db.flush()
    nodes = {code: Node(portfolio_id=portfolio.id, code=code, name=name) for code, name in NODES.items()}
    db.add_all(nodes.values())
    db.flush()
    db.add_all(
        Line(portfolio_id=portfolio.id, code=code, from_node_id=nodes[a].id, to_node_id=nodes[b].id, limit_mw=limit)
        for code, a, b, limit in LINES
    )
    for code, name, kind, location, commissioned, node, assets in SITES:
        site = Site(portfolio_id=portfolio.id, code=code, name=name, kind=kind, location=location,
                    commissioned_on=commissioned)
        db.add(site)
        db.flush()
        db.add_all(
            Asset(portfolio_id=portfolio.id, site_id=site.id, node_id=nodes[node].id, code=a_code, kind=a_kind,
                  name=a_name, capacity_mw=capacity, params=validate_params(a_kind, params))
            for a_code, a_name, a_kind, capacity, params in assets
        )
    db.flush()
    db.add_all(default_configs(db.scalars(select(Asset).where(Asset.portfolio_id == portfolio.id)).all()))
    db.commit()
    return True


def default_configs(assets: list[Asset]) -> list[ActionConfig]:
    """Starting mandates: BOB acts alone within modest limits and asks above them."""
    approval = {"approver": "Site operator", "response_min": 10}
    config = lambda a, kind, name, **limits: ActionConfig(  # noqa: E731
        site_id=a.site_id, asset_id=a.id, kind=kind, name=name, status="active", autonomy="auto",
        limits=limits, approval=approval)
    out = []
    for a in assets:
        p = a.params
        if a.kind == "bess":
            out.append(config(a, "battery_charge", f"Charge {a.name} from surplus", max_mw=a.capacity_mw,
                              auto_max_mw=a.capacity_mw))
            discharge = config(a, "battery_discharge", f"Discharge {a.name} to support demand", max_mw=a.capacity_mw,
                               auto_max_mw=round(a.capacity_mw * 0.75), reserve_pct=BATTERY_RESERVE_PCT)
            discharge.watch = [{"metric": "soc_below_pct", "value": 60}]  # the start threshold, above the reserve
            out.append(discharge)
        elif a.kind in ("solar", "wind"):
            out.append(config(a, "curtail", f"Limit {a.name} output", auto_max_mw=50))
        elif a.kind == "consumer":
            if p["dr_max_mw"]:
                out.append(config(a, "demand_response", f"Demand response: {a.name}", max_mw=p["dr_max_mw"],
                                  auto_max_mw=5))
            if p["shift_max_mw"]:
                out.append(config(a, "load_shift", f"Move load: {a.name}", max_mw=p["shift_max_mw"]))
        elif a.kind == "interconnection" and p["import_max_mw"] >= 100:  # the hub's market connection
            out.append(config(a, "grid_import", "Buy power in the real-time market", auto_max_mw=60))
            out.append(config(a, "grid_export", "Sell surplus power", auto_max_mw=60, min_price_inr_mwh=0))
    return out


if __name__ == "__main__":
    with SessionLocal() as session:
        print("Seeded demo portfolio." if seed(session) else "Portfolio already exists; nothing to do.")
        # The client has no run controls, so the demo starts with its story running.
        if runs.latest_live(session) is None:
            runs.create_run(session, get_portfolio(session), "demo_story", datetime.now(timezone.utc))
            session.commit()
            print("Started the demo story run.")
