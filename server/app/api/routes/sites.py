"""A site's views of the run (maintenance, activity log) and its connected data sources."""

import base64
import binascii
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.portfolio import current_portfolio, current_site
from app.core.database import get_db
from app.models.portfolio import Asset, DataSource, Portfolio, Site
from app.models.run import Run
from app.models.user import User
from app.schemas.runs import (
    ActivityOut, ApiSource, CsvCheck, CsvUpload, DataConnect, DataSourceOut, MaintenanceOut, TaskOut,
)
from app.services import activity, datasources, maintenance, runs
from app.services.policy import WORK_ORDERS
from app.services.summary import recent_actions

router = APIRouter(dependencies=[Depends(get_current_user)])
mock_router = APIRouter()


def _run(run_id: int, db: Session) -> Run:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


@router.get("/runs/{run_id}/sites/{code}/maintenance", response_model=MaintenanceOut)
def site_maintenance(run_id: int, code: str, db: Session = Depends(get_db)) -> MaintenanceOut:
    run = _run(run_id, db)
    assets = {a.id: a for a in db.scalars(select(Asset).join(Site).where(Site.code == code))}
    now = runs.sim_now(run, datetime.now(timezone.utc))
    tasks = []
    for t in maintenance.tasks(db, run):
        if t.asset_id in assets:
            end = t.scheduled_at + t.duration_blocks * runs.BLOCK
            tasks.append(TaskOut(
                id=t.id, asset=assets[t.asset_id].name, kind=t.kind, hours=t.duration_blocks / 4,
                earliest_at=t.earliest_at, deadline_at=t.deadline_at, calendar_at=t.calendar_at,
                scheduled_at=t.scheduled_at, safety_critical=t.safety_critical,
                status="done" if end <= now else "in progress" if t.scheduled_at <= now else "planned"))
    proposals = [a for a in recent_actions(db, run, 50, site=code) if a.kind in WORK_ORDERS]
    return MaintenanceOut(tasks=tasks, proposals=proposals)


@router.get("/runs/{run_id}/sites/{code}/activity", response_model=list[ActivityOut])
def site_activity(run_id: int, site: Site = Depends(current_site), db: Session = Depends(get_db),
                  category: list[str] = Query(default=list(activity.CATEGORIES))) -> list[dict]:
    return activity.site_activity(db, _run(run_id, db), site, set(category))


@router.get("/runs/{run_id}/sites/{code}/telemetry.csv", response_class=PlainTextResponse)
def telemetry(run_id: int, site: Site = Depends(current_site), db: Session = Depends(get_db)) -> PlainTextResponse:
    return PlainTextResponse(datasources.telemetry_csv(db, _run(run_id, db), site), media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="{site.code.lower()}-telemetry.csv"'})


def _decode(upload: CsvUpload) -> bytes:
    try:
        return base64.b64decode(upload.data, validate=True)
    except binascii.Error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The file is not base64") from None


@router.get("/sites/{code}/data-sources", response_model=list[DataSourceOut])
def list_sources(site: Site = Depends(current_site), db: Session = Depends(get_db)) -> list[DataSource]:
    return datasources.site_sources(db, site)


@router.post("/sites/{code}/data-sources/csv/check", response_model=CsvCheck)
def check_csv(upload: CsvUpload, site: Site = Depends(current_site)) -> dict:
    return datasources.read_csv(site, _decode(upload))


@router.post("/sites/{code}/data-sources/csv", response_model=DataSourceOut, status_code=status.HTTP_201_CREATED)
def import_csv(upload: CsvUpload, site: Site = Depends(current_site), db: Session = Depends(get_db),
               user: User = Depends(get_current_user)) -> DataSource:
    content = _decode(upload)
    found = datasources.read_csv(site, content)
    if found["problems"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="; ".join(found["problems"]))
    source = datasources.save(db, site, "csv", upload.filename, user.email, found, content)
    db.commit()
    return source


@mock_router.get("/mock/sites/{code}/telemetry")
def mock_telemetry(site: Site = Depends(current_site), db: Session = Depends(get_db)) -> dict:
    """A site's telemetry API, open like a vendor's sandbox: the live run's last three hours."""
    try:
        return datasources.feed(db, site)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from None


@mock_router.get("/mock/portfolio/forecast")
def mock_forecast(db: Session = Depends(get_db)) -> dict:
    """The portfolio's forecast API, open like a vendor's sandbox: demand and renewables for the next 24 hours."""
    try:
        return datasources.forecast_feed(db)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from None


@mock_router.get("/mock/market/prices")
def mock_prices(db: Session = Depends(get_db)) -> dict:
    """The market's price API, open like a vendor's sandbox: price forecasts for the next 24 hours."""
    try:
        return datasources.market_feed(db)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from None


@router.post("/data-sources/connect")
def connect_feed(payload: DataConnect, db: Session = Depends(get_db), portfolio: Portfolio = Depends(current_portfolio),
                 user: User = Depends(get_current_user)) -> dict:
    """The client's API connection: tests the site's telemetry endpoint and keeps it as the site's source."""
    try:
        data = datasources.connect(db, current_site(payload.site_id, portfolio), payload.endpoint, user.email,
                                   payload.refresh_min)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from None
    db.commit()
    return data


@router.post("/sites/{code}/data-sources/api/test", response_model=CsvCheck)
def test_api(payload: ApiSource, site: Site = Depends(current_site), db: Session = Depends(get_db)) -> dict:
    try:
        return datasources.test_api(db, site, payload.endpoint)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from None


@router.post("/sites/{code}/data-sources/api", response_model=DataSourceOut, status_code=status.HTTP_201_CREATED)
def connect_api(payload: ApiSource, site: Site = Depends(current_site), db: Session = Depends(get_db),
                user: User = Depends(get_current_user)) -> DataSource:
    try:
        found = datasources.test_api(db, site, payload.endpoint)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from None
    source = datasources.save(db, site, "api", payload.endpoint, user.email, found, refresh_min=payload.refresh_min)
    db.commit()
    return source


@router.delete("/sites/{code}/data-sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_source(source_id: int, site: Site = Depends(current_site), db: Session = Depends(get_db)) -> None:
    source = db.get(DataSource, source_id)
    if source is None or source.site_id != site.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    db.delete(source)
    db.commit()
