"""The reliability harness (D2): replay the demo story on three seeds and check that BOB never
breaks a hard limit or leaves load unserved. A full simulated day per seed; about 90 s."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import Run
from app.seed import seed
from app.services import runs, studies
from app.services.portfolio import get_portfolio

NOW = datetime(2026, 10, 4, tzinfo=timezone.utc)


def test_three_seeds_break_no_hard_limit(db: Session) -> None:
    seed(db)
    study = studies.create(db, get_portfolio(db), "demo_story", 3, "ci", NOW)
    for replay in db.scalars(select(Run).where(Run.study_id == study.id)).all():
        while replay.status != "done":
            runs.advance(db, replay, NOW)
        db.commit()
    result = studies.result(db, study)
    assert result["reliability"]["replays_done"] == 3
    assert [s["violations"] for s in result["seeds"]] == [[], [], []]
    assert result["reliability"]["unserved_mwh"]["bob"] == 0
    assert len({s["seed"] for s in result["seeds"]}) == 3
