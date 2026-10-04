"""Simulation worker: `python -m app.worker`. Run as many replicas as needed; each run's
clock is advanced by whichever worker claims its row (FOR UPDATE SKIP LOCKED)."""

import logging
import time
from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.services.runs import tick

IDLE_SLEEP_S = 0.25


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.info("Worker started")
    while True:
        try:
            with SessionLocal() as db:
                busy = tick(db, datetime.now(timezone.utc))
        except Exception:
            logging.exception("Worker tick failed; retrying")
            busy = False
        if not busy:
            time.sleep(IDLE_SLEEP_S)


if __name__ == "__main__":
    main()
