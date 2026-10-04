"""Connect data source (a mock, docs/spec/05). A CSV of telemetry history is checked against fixed
known columns, typed and previewed, then stored for the site. A live API is "tested" against the
simulator: no external system is ever called. BOB keeps planning on simulated telemetry."""

import csv
import io
import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.portfolio import DataSource, Site
from app.models.run import AssetBlock, Run
from app.services import runs

REQUIRED = ("timestamp", "asset", "power_mw")
KNOWN = (*REQUIRED, "available_mw", "soc_pct", "voltage_v", "cell_temp_c", "status", "frequency_hz")
MAX_BYTES = 5_000_000
PREVIEW_ROWS = 10


def _type(values: list[str]) -> str:
    present = [v for v in values if v.strip()]

    def all_parse(parse) -> bool:
        try:
            for v in present:
                parse(v)
        except ValueError:
            return False
        return bool(present)

    if all_parse(int):
        return "Integer"
    if all_parse(float):
        return "Number"
    if all_parse(lambda v: datetime.fromisoformat(v.strip())):
        return "DateTime"
    return "String"


def read_csv(site: Site, content: bytes) -> dict:
    """Rows, typed columns, a preview, and what stops the import (empty if it can be imported)."""
    if len(content) > MAX_BYTES:
        return {"rows": 0, "columns": [], "preview": [], "problems": ["Files are limited to 5 MB"]}
    table = list(csv.reader(io.StringIO(content.decode("utf-8-sig", errors="replace"))))
    header = [h.strip().lower() for h in table[0]] if table else []
    rows = [r for r in table[1:] if any(c.strip() for c in r)]
    columns = [{"name": h, "type": _type([r[i] for r in rows if i < len(r)]), "known": h in KNOWN}
               for i, h in enumerate(header)]
    problems = [f"Missing column {c}" for c in REQUIRED if c not in header]
    if not problems:
        typed = {c["name"]: c["type"] for c in columns}
        if typed["timestamp"] != "DateTime":
            problems.append("timestamp must be a date and time, such as 2026-11-12 10:45")
        if typed["power_mw"] not in ("Number", "Integer"):
            problems.append("power_mw must be a number")
        codes = {a.code for a in site.assets}
        unknown = {r[header.index("asset")].strip() for r in rows} - codes
        if unknown:
            problems.append(f"Assets not at {site.name}: {', '.join(sorted(unknown)[:5])} "
                            f"(expected {', '.join(sorted(codes))})")
    if not rows:
        problems.append("The file has no data rows")
    return {"rows": len(rows), "columns": columns, "preview": rows[:PREVIEW_ROWS], "problems": problems}


def telemetry_csv(db: Session, run: Run, site: Site) -> str:
    """The run's settled telemetry for the site, in the fixed columns: a sample to import."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["timestamp", "asset", "power_mw", "available_mw", "soc_pct"])
    assets = {a.id: a for a in site.assets}
    for row in db.scalars(select(AssetBlock).where(AssetBlock.run_id == run.id, AssetBlock.policy == "bob",
                                                   AssetBlock.asset_id.in_(assets)).order_by(AssetBlock.block)):
        a = assets[row.asset_id]
        soc = round(row.soc_mwh / a.params["energy_mwh"] * 100, 1) if row.soc_mwh is not None else ""
        at = (run.sim_start_at + row.block * runs.BLOCK).astimezone(runs.IST)
        writer.writerow([f"{at:%Y-%m-%d %H:%M}", a.code, round(row.actual_mw, 2), round(row.available_mw, 2), soc])
    return out.getvalue()


def test_api(db: Session, site: Site, endpoint: str) -> dict:
    """What a connected system would send now, answered by the simulator from the live run."""
    if not re.fullmatch(r"https?://[^\s/]+(/\S*)?", endpoint):
        raise ValueError("Enter an http or https endpoint URL")
    run = runs.latest_live(db)
    if run is None or run.current_block < 0:
        raise ValueError("Start a run: the simulator answers for the connected system")
    text = telemetry_csv(db, run, site)
    lines = text.strip().splitlines()
    latest = [lines[0], *lines[-len(site.assets):]]  # the last settled block, one row per asset
    return read_csv(site, "\n".join(latest).encode())


def save(db: Session, site: Site, kind: str, name: str, user: str, found: dict | None = None,
         content: bytes | None = None, refresh_min: int | None = None) -> DataSource:
    source = DataSource(site_id=site.id, kind=kind, name=name[:300], rows=found["rows"] if found else None,
                        columns=[{"name": c["name"], "type": c["type"]} for c in found["columns"]] if found else [],
                        content=content, refresh_min=refresh_min, created_by=user)
    db.add(source)
    db.flush()
    return source


def site_sources(db: Session, site: Site) -> list[DataSource]:
    return list(db.scalars(select(DataSource).where(DataSource.site_id == site.id).order_by(DataSource.id.desc())))
