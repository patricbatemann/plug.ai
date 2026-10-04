"""Opt-in accuracy check of document extraction against the labelled samples. It calls the model
(about ten requests) and writes nothing: `cd server && .venv/bin/python -m app.agent.harness`."""

import json
from datetime import datetime
from pathlib import Path

from app.agent import extract
from app.agent.llm import Unavailable
from app.core.database import SessionLocal
from app.services.documents import IST, MIMES, SAMPLE_DIR, Reference, check, read_text
from app.services.portfolio import get_portfolio

NOW = datetime(2026, 11, 12, 10, 45, tzinfo=IST)  # the presets' day, before the live demo starts
FIELDS = ("start", "end", "value", "status")


def main() -> None:
    labels = {k: v for k, v in json.loads((SAMPLE_DIR / "labels.json").read_text()).items() if not k.startswith("_")}
    right = total = auto = auto_right = extra = 0
    with SessionLocal() as db:
        ref = Reference.load(db, get_portfolio(db).id)
        for name, expected in labels.items():
            content, mime = (SAMPLE_DIR / name).read_bytes(), MIMES[Path(name).suffix]
            text = read_text(content, mime)
            try:
                items = extract.extract(db, None, ref.text(), ref.codes, text, None if text is not None else content,
                                        mime)["items"]
            except Unavailable as error:  # a refusal applies nothing, which is right only if nothing was expected
                print(f"{name:28} not read: {error}")
                items = []
            got = [{**check(i, ref, NOW, text), "start": i["start"], "end": i["end"]} for i in items]
            score = 0
            for e in expected:
                g = next((g for g in got if g["kind"] == e["kind"] and sorted(g["targets"]) == sorted(e["targets"])), None)
                score += (g is not None) + sum(g is not None and g[f] == e[f] for f in FIELDS)
            matched = [g for g in got if any(g["kind"] == e["kind"] and sorted(g["targets"]) == sorted(e["targets"])
                                             for e in expected)]
            extra += len(got) - len(matched)
            for g in (g for g in got if g["status"] == "active"):
                auto += 1
                auto_right += any(all(g[f] == e[f] for f in FIELDS) and g["kind"] == e["kind"] for e in expected)
            right, total = right + score, total + len(expected) * (1 + len(FIELDS))
            print(f"{name:28} expected {len(expected)} got {len(got)}  fields {score}/{len(expected) * 5}  "
                  + "; ".join(f"{g['kind']} {g['targets']} {g['start']}–{g['end']} {g['value']} → {g['status']}"
                              for g in got))
        db.rollback()
    print(f"\nField accuracy {right}/{total} ({right / total:.0%}); items not in the labels {extra}; "
          f"auto-applied {auto}, correct {auto_right} (precision {auto_right / auto:.0%})" if auto else "")


if __name__ == "__main__":
    main()
