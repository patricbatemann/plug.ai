from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.portfolio import current_portfolio
from app.core.database import get_db
from app.models.portfolio import Portfolio
from app.models.run import Run
from app.schemas.runs import InjectEvent, PresetInfo, RunCreate, RunState, SiteLive, SpeedUpdate
from app.services import runs
from app.services.live import site_live
from app.sim.presets import PRESETS

router = APIRouter(prefix="/runs", dependencies=[Depends(get_current_user)])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _state(run: Run) -> RunState:
    return RunState(
        id=run.id, preset=run.preset, name=run.config["name"], status=run.status, speed=run.speed,
        sim_time=runs.sim_now(run, _now()), block=run.current_block, total_blocks=run.total_blocks,
        live=runs.is_live(run),
    )


def _locked_run(run_id: int, db: Session = Depends(get_db)) -> Run:
    run = runs.lock_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


@router.get("/presets", response_model=list[PresetInfo])
def list_presets() -> list[PresetInfo]:
    return [PresetInfo(code=code, name=p["name"], description=p["description"]) for code, p in PRESETS.items()]


@router.get("/current", response_model=RunState)
def current_run(db: Session = Depends(get_db)) -> RunState:
    run = db.scalar(select(Run).order_by(Run.id.desc()).limit(1))
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No run yet")
    return _state(run)


@router.post("", response_model=RunState, status_code=status.HTTP_201_CREATED)
def create_run(
    payload: RunCreate, db: Session = Depends(get_db), portfolio: Portfolio = Depends(current_portfolio)
) -> RunState:
    if payload.preset not in PRESETS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown preset")
    return _state(runs.create_run(db, portfolio, payload.preset, _now()))


@router.post("/{run_id}/pause", response_model=RunState)
def pause(run: Run = Depends(_locked_run), db: Session = Depends(get_db)) -> RunState:
    runs.pause(run, _now())
    db.commit()
    return _state(run)


@router.post("/{run_id}/play", response_model=RunState)
def play(run: Run = Depends(_locked_run), db: Session = Depends(get_db)) -> RunState:
    runs.play(run, _now())
    db.commit()
    return _state(run)


@router.post("/{run_id}/step", response_model=RunState)
def step(run: Run = Depends(_locked_run), db: Session = Depends(get_db)) -> RunState:
    if run.status != "paused":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pause the run before stepping")
    runs.advance(db, run, _now())
    db.commit()
    return _state(run)


@router.patch("/{run_id}", response_model=RunState)
def set_speed(payload: SpeedUpdate, run: Run = Depends(_locked_run), db: Session = Depends(get_db)) -> RunState:
    runs.set_speed(run, payload.speed)
    db.commit()
    return _state(run)


@router.post("/{run_id}/events", response_model=RunState, status_code=status.HTTP_201_CREATED)
def inject_event(
    event: InjectEvent = Body(), run: Run = Depends(_locked_run), db: Session = Depends(get_db)
) -> RunState:
    if run.status == "done":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The run has finished")
    payload = event.model_dump(exclude={"kind"})
    try:
        runs.check_references(db, run, payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from None
    runs.inject(db, run, event.kind, payload, _now())
    db.commit()
    return _state(run)


@router.get("/{run_id}/sites/{code}/live", response_model=SiteLive)
def live_overview(
    run_id: int, code: str, db: Session = Depends(get_db), portfolio: Portfolio = Depends(current_portfolio)
) -> SiteLive:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    site = next((s for s in portfolio.sites if s.code == code), None)
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    if run.current_block < 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The run has not settled a block yet")
    return site_live(db, run, site, _now())
