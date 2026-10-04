"""Seed the demo portfolio: `python -m app.seed`. Does nothing if a portfolio exists."""

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.portfolio import Asset, Line, Node, Portfolio, Site
from app.schemas.portfolio import validate_params

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
    ("KUP-SOLAR-001", "Kuppam Solar Site", "hybrid", "Chittoor, Andhra Pradesh", date(2021, 3, 15), "SOUTH", [
        ("SOL-KUP", "Kuppam solar array", "solar", 45, solar()),
        ("BESS-01", "Battery 1", "bess", 15, bess(60, 15)),
    ]),
    ("NEL-SOLAR-002", "Nellore Solar Site", "solar", "Nellore, Andhra Pradesh", date(2020, 11, 2), "SOUTH", [
        ("SOL-NEL", "Nellore solar array", "solar", 55, solar()),
    ]),
    ("TIR-WIND-003", "Tirupati Wind Site", "wind", "Tirupati, Andhra Pradesh", date(2019, 6, 20), "NORTH", [
        ("WND-TIR", "Tirupati wind farm", "wind", 65, wind(comp=3200)),
    ]),
    ("CHT-HYBRID-004", "Chittoor Hybrid Site", "hybrid", "Chittoor, Andhra Pradesh", date(2022, 1, 10), "SOUTH", [
        ("SOL-CHT", "Chittoor solar array", "solar", 70, solar()),
        ("BESS-02", "Battery 2", "bess", 10, bess(40, 10)),
    ]),
    ("KDR-SOLAR-005", "Kadiri Solar Site", "solar", "Sri Sathya Sai, Andhra Pradesh", date(2018, 8, 5), "SOUTH", [
        ("SOL-KDR", "Kadiri solar park", "solar", 105, solar(comp=2600)),
    ]),
    ("MDP-SOLAR-006", "Madanapalle Solar Site", "solar", "Annamayya, Andhra Pradesh", date(2023, 2, 28), "SOUTH", [
        ("SOL-MDP", "Madanapalle solar array", "solar", 45, solar()),
    ]),
    ("ATP-WIND-007", "Anantapur Wind Site", "wind", "Anantapur, Andhra Pradesh", date(2017, 9, 12), "NORTH", [
        ("WND-ATP", "Anantapur wind farm", "wind", 60, wind()),
        ("IC-NORTH", "North grid interconnection", "interconnection", 40,
         {"import_max_mw": 20, "export_max_mw": 40}),
    ]),
    ("GTY-WIND-008", "Gooty Wind Site", "wind", "Anantapur, Andhra Pradesh", date(2020, 4, 18), "NORTH", [
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
    portfolio = Portfolio(name="Andhra Pradesh renewable portfolio", tz="Asia/Kolkata", mode_code="balanced")
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
    db.commit()
    return True


if __name__ == "__main__":
    with SessionLocal() as session:
        print("Seeded demo portfolio." if seed(session) else "Portfolio already exists; nothing to do.")
