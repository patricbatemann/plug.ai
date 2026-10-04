import base64
import binascii
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.agent import chat
from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.run import Constraint, Run
from app.models.user import User
from app.schemas.runs import ChatItem, DocumentUpload, SampleOut
from app.services import documents, runs

router = APIRouter(dependencies=[Depends(get_current_user)])


def _run(run_id: int, db: Session) -> Run:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


@router.get("/document-samples", response_model=list[SampleOut])
def samples() -> list[SampleOut]:
    return [SampleOut(name=name, title=title) for name, title in documents.SAMPLES.items()]


@router.post("/runs/{run_id}/documents", response_model=list[ChatItem])
def upload(payload: DocumentUpload, run_id: int, db: Session = Depends(get_db),
           user: User = Depends(get_current_user)) -> list[dict]:
    """A file (base64) or one of the samples. BOB's reading is posted to the chat, which is returned."""
    run = _run(run_id, db)
    if payload.sample:
        if payload.sample not in documents.SAMPLES:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown sample")
        filename, content = payload.sample, (documents.SAMPLE_DIR / payload.sample).read_bytes()
    else:
        try:
            filename, content = payload.filename, base64.b64decode(payload.data, validate=True)
        except binascii.Error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The file is not base64") from None
    mime = documents.MIMES.get(Path(filename).suffix.lower())
    if mime is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Upload a PDF, text file or image")
    if len(content) > documents.MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Documents are limited to 5 MB")
    documents.upload(db, run, user.id, filename, mime, content, datetime.now(timezone.utc))
    db.commit()
    return chat.display(db, run, chat.history(db, run, user.id))


@router.post("/runs/{run_id}/constraints/{constraint_id}/{decision}", response_model=list[ChatItem])
def decide(run_id: int, constraint_id: int, decision: str, db: Session = Depends(get_db),
           user: User = Depends(get_current_user)) -> list[dict]:
    if decision not in ("apply", "reject", "withdraw"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown decision")
    run = runs.lock_run(db, run_id)
    constraint = db.get(Constraint, constraint_id)
    if run is None or constraint is None or constraint.run_id != run.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Constraint not found")
    try:
        documents.decide(db, run, constraint, decision, user.email, datetime.now(timezone.utc))
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from None
    db.commit()
    return chat.display(db, run, chat.history(db, run, user.id))
