from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.portfolio import current_portfolio
from app.core.database import get_db
from app.models.portfolio import Portfolio
from app.models.run import Run, Study
from app.models.user import User
from app.schemas.runs import BobCalls, StudyCreate, StudyItem, StudyOut
from app.services import studies
from app.services.whatif import WhatIf, what_if
from app.sim.presets import PRESETS

router = APIRouter(dependencies=[Depends(get_current_user)])


def _study(study_id: int, db: Session = Depends(get_db)) -> Study:
    study = db.get(Study, study_id)
    if study is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study not found")
    return study


@router.get("/studies", response_model=list[StudyItem])
def list_studies(db: Session = Depends(get_db)) -> list[Study]:
    return list(db.scalars(select(Study).order_by(Study.id.desc()).limit(20)))


@router.post("/studies", response_model=StudyOut, status_code=status.HTTP_201_CREATED)
def create_study(payload: StudyCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user),
                 portfolio: Portfolio = Depends(current_portfolio)) -> dict:
    if payload.preset not in PRESETS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown preset")
    try:
        study = studies.create(db, portfolio, payload.preset, payload.seeds, user.email, datetime.now(timezone.utc))
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from None
    db.commit()
    return studies.result(db, study)


@router.get("/studies/{study_id}", response_model=StudyOut)
def study(study: Study = Depends(_study), db: Session = Depends(get_db)) -> dict:
    return studies.result(db, study)


@router.delete("/studies/{study_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_study(study: Study = Depends(_study), db: Session = Depends(get_db)) -> None:
    db.delete(study)
    db.commit()


@router.get("/bob-calls", response_model=BobCalls)
def bob_calls(db: Session = Depends(get_db)) -> dict:
    return studies.bob_calls(db)


@router.post("/runs/{run_id}/what-if")
def run_what_if(run_id: int, payload: WhatIf, db: Session = Depends(get_db)) -> dict:
    run = db.get(Run, run_id)
    if run is None or run.current_block < 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Start a run first")
    try:
        return what_if(db, run, payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from None
