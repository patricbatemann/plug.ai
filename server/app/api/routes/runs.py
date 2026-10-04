import json
from collections.abc import Iterator
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.agent import chat, llm
from app.api.dependencies import get_current_user
from app.api.routes.portfolio import current_portfolio
from app.core.database import get_db, get_session_factory
from app.models.portfolio import Portfolio
from app.models.run import Action, Cycle, Run, WorldEvent
from app.models.user import User
from app.schemas.runs import (
    ActionOut, ChatAsk, ChatItem, DecisionDetail, DecisionSummary, EventOut, InjectEvent, PresetInfo, RunCreate, RunState, RunSummary, SiteLive,
    SpeedUpdate,
)
from app.services import runs
from app.services import decisions, policy
from app.services.live import site_live
from app.services.summary import recent_actions, summary
from app.sim.presets import PRESETS

router = APIRouter(prefix="/runs", dependencies=[Depends(get_current_user)])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _state(run: Run) -> RunState:
    return RunState(
        id=run.id, preset=run.preset, name=run.config["name"], status=run.status, speed=run.speed,
        sim_time=runs.sim_now(run, _now()), block=run.current_block, total_blocks=run.total_blocks,
        live=runs.is_live(run), mode=run.mode_code, mode_by=run.mode_by, bob_online=llm.ready(),
    )


def _locked_run(run_id: int, db: Session = Depends(get_db)) -> Run:
    run = runs.lock_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


def _run(run_id: int, db: Session = Depends(get_db)) -> Run:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


@router.get("/presets", response_model=list[PresetInfo])
def list_presets() -> list[PresetInfo]:
    return [PresetInfo(code=code, name=p["name"], description=p["description"]) for code, p in PRESETS.items()]


@router.get("/current", response_model=RunState)
def current_run(db: Session = Depends(get_db)) -> RunState:
    run = runs.latest_live(db)
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
    code: str, run: Run = Depends(_run), db: Session = Depends(get_db),
    portfolio: Portfolio = Depends(current_portfolio),
) -> SiteLive:
    site = next((s for s in portfolio.sites if s.code == code), None)
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    if run.current_block < 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The run has not settled a block yet")
    return site_live(db, run, site, _now())


@router.get("/{run_id}/summary", response_model=RunSummary)
def run_summary(run: Run = Depends(_run), db: Session = Depends(get_db)) -> RunSummary:
    return summary(db, run)


@router.get("/{run_id}/actions", response_model=list[ActionOut])
def run_actions(
    run: Run = Depends(_run), db: Session = Depends(get_db), limit: int = Query(default=20, ge=1, le=200),
    status: list[str] = Query(default=[]), site: str | None = None, block: int | None = None,
) -> list[ActionOut]:
    return recent_actions(db, run, limit, status, site, block)


def _decide(run_id: int, action_id: int, approve: bool, db: Session, user: User) -> RunState:
    run = runs.lock_run(db, run_id)
    action = db.get(Action, action_id)
    if run is None or action is None or action.run_id != run.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")
    if action.status != "awaiting_approval":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"The action is {action.status}")
    try:
        policy.decide(db, run, action, approve, user.email, runs.sim_now(run, _now()))
    except ValueError as error:
        db.commit()  # keep the expiry
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from None
    db.commit()
    return _state(run)


@router.post("/{run_id}/actions/{action_id}/approve", response_model=RunState)
def approve(run_id: int, action_id: int, db: Session = Depends(get_db),
            user: User = Depends(get_current_user)) -> RunState:
    return _decide(run_id, action_id, True, db, user)


@router.post("/{run_id}/actions/{action_id}/decline", response_model=RunState)
def decline(run_id: int, action_id: int, db: Session = Depends(get_db),
            user: User = Depends(get_current_user)) -> RunState:
    return _decide(run_id, action_id, False, db, user)


@router.get("/{run_id}/events", response_model=list[EventOut])
def fired_events(run: Run = Depends(_run), db: Session = Depends(get_db), after: int = 0) -> list[EventOut]:
    rows = db.scalars(select(WorldEvent).where(
        WorldEvent.run_id == run.id, WorldEvent.fired_at.isnot(None), WorldEvent.id > after,
    ).order_by(WorldEvent.id))
    labels = {**runs.VISIBLE, **runs.NOTICES}
    return [EventOut(id=e.id, kind=e.kind, sim_at=e.sim_at, source=e.source,
                     label=labels.get(e.kind, lambda p: e.kind.replace("_", " ").capitalize())(e.payload))
            for e in rows]


@router.get("/{run_id}/decisions/latest", response_model=DecisionSummary)
def latest_decision(run: Run = Depends(_run), db: Session = Depends(get_db)) -> DecisionSummary:
    summary = decisions.latest(db, run)
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No decision yet")
    return summary


@router.get("/decisions/{cycle_id}", response_model=DecisionDetail)
def decision(cycle_id: int, db: Session = Depends(get_db)) -> DecisionDetail:
    cycle = db.get(Cycle, cycle_id)
    if cycle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")
    return decisions.detail(db, cycle)


@router.get("/{run_id}/chat", response_model=list[ChatItem])
def chat_history(run: Run = Depends(_run), db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)) -> list[dict]:
    return chat.display(db, run, chat.history(db, run, user.id))


@router.post("/{run_id}/chat")
def ask_bob(payload: ChatAsk, run: Run = Depends(_run), user: User = Depends(get_current_user),
            sessions: sessionmaker = Depends(get_session_factory)) -> StreamingResponse:
    """Server-sent events: status (a tool started), delta (answer text), done (the stored
    conversation, with cards)."""
    run_id, user_id = run.id, user.id

    def events() -> Iterator[str]:
        with sessions() as db:
            for name, data in chat.ask(db, db.get(Run, run_id), user_id, payload.message, payload.context):
                yield f"event: {name}\ndata: {json.dumps(data, default=str)}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
