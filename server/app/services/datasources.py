"""Connect data source (a mock, docs/spec/05). A CSV of telemetry history is checked against fixed
known columns, typed and previewed, then stored for the site. A site's live API is the mock telemetry
endpoint, answered by the simulator: no external system is ever called. BOB commands only the assets
of sites with a connected API."""

import csv
import io
from collections.abc import Iterator
from datetime import datetime
from urllib.parse import urlsplit

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.portfolio import Asset, DataSource, Site
from app.models.run import AssetBlock, Run
from app.services import runs

REQUIRED = ("timestamp", "asset", "power_mw")
KNOWN = (*REQUIRED, "available_mw", "soc_pct", "voltage_v", "cell_temp_c", "status", "frequency_hz")
MAX_BYTES = 5_000_000
PREVIEW_ROWS = 10
FEED_BLOCKS = 12  # three hours
MOCK_PATH = "/api/mock/sites/{}/telemetry"
FEED = {"timestamp": "DateTime", "device_id": "String", "device_type": "String", "power_mw": "Number",
        "available_mw": "Number", "soc_percent": "Number", "irradiance_wm2": "Number", "wind_ms": "Number",
        "temperature_c": "Number", "frequency_hz": "Number"}


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


def _telemetry(db: Session, run: Run, site: Site, since: int = 0) -> Iterator[tuple[datetime, Asset, AssetBlock]]:
    assets = {a.id: a for a in site.assets}
    for row in db.scalars(select(AssetBlock).where(AssetBlock.run_id == run.id, AssetBlock.policy == "bob",
                                                   AssetBlock.asset_id.in_(assets), AssetBlock.block >= since)
                          .order_by(AssetBlock.block)):
        yield (run.sim_start_at + row.block * runs.BLOCK).astimezone(runs.IST), assets[row.asset_id], row


def telemetry_csv(db: Session, run: Run, site: Site) -> str:
    """The run's settled telemetry for the site, in the fixed columns: a sample to import."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["timestamp", "asset", "power_mw", "available_mw", "soc_pct"])
    for at, a, row in _telemetry(db, run, site):
        soc = round(row.soc_mwh / a.params["energy_mwh"] * 100, 1) if row.soc_mwh is not None else ""
        writer.writerow([f"{at:%Y-%m-%d %H:%M}", a.code, round(row.actual_mw, 2), round(row.available_mw, 2), soc])
    return out.getvalue()


def _live(db: Session) -> Run:
    run = runs.latest_live(db)
    if run is None or run.current_block < 0:
        raise ValueError("Start a run: the simulator answers for the connected system")
    return run


def _check(site: Site, endpoint: str) -> None:
    """Only the site's mock endpoint can be connected; nothing outside is ever called."""
    url = urlsplit(endpoint)
    if url.scheme not in ("http", "https") or not url.netloc or url.path.rstrip("/") != MOCK_PATH.format(site.code):
        raise ValueError(f"Enter {site.name}'s telemetry endpoint: http(s)://<host>{MOCK_PATH.format(site.code)}")


def test_api(db: Session, site: Site, endpoint: str) -> dict:
    """What the connected system sends now: the last settled block, one row per asset."""
    _check(site, endpoint)
    lines = telemetry_csv(db, _live(db), site).strip().splitlines()
    return read_csv(site, "\n".join([lines[0], *lines[-len(site.assets):]]).encode())


def feed(db: Session, site: Site) -> dict:
    """The site's telemetry API: a row per asset per block for the last three hours (output, what it could
    give, a battery's charge) with the site's weather. It moves on every settled block, and BOB plans on
    the same readings."""
    run = _live(db)
    truth = runs.RunContext.load(db, run).world()
    node = site.assets[0].node.code
    rows = []
    for at, a, r in _telemetry(db, run, site, since=run.current_block - FEED_BLOCKS + 1):
        soc = round(r.soc_mwh / a.params["energy_mwh"] * 100, 1) if r.soc_mwh is not None else ""
        # `+ 0.0` turns -0.0 into 0.0 so an idle connection does not read "-0.0".
        rows.append([at.isoformat(), a.code, a.kind, round(r.actual_mw, 2) + 0.0, round(r.available_mw, 2) + 0.0, soc,
                     round(float(truth.irradiance[node][r.block])), round(float(truth.wind_speed[node][r.block]), 1),
                     round(float(truth.temperature[r.block]), 1), round(float(truth.frequency[r.block]), 2)])
    return {"headers": list(FEED), "rows": rows}


def connect(db: Session, site: Site, endpoint: str, user: str, refresh_min: int | None) -> dict:
    """Test the site's API and keep it as the site's one live source; BOB acts at the site from the next plan."""
    _check(site, endpoint)
    data = feed(db, site)
    db.execute(delete(DataSource).where(DataSource.site_id == site.id, DataSource.kind == "api"))
    save(db, site, "api", endpoint, user, {"rows": len(data["rows"]),
                                          "columns": [{"name": n, "type": t} for n, t in FEED.items()]},
         refresh_min=refresh_min)
    return data


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
