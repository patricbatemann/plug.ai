"""Documents to constraints (docs/spec/02, D3): read, extract, validate, and apply only what is
safe without a person. A constraint applies automatically when it tightens a limit, the model is
confident and its quote is found in the document; anything else waits for Apply or Reject."""

import hashlib
import io
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent import extract
from app.agent.llm import Unavailable
from app.models.portfolio import Asset, Line, Node
from app.models.run import ChatMessage, Constraint, Document, Run
from app.services import maintenance, runs
from app.services.dispatch import knowledge, latest_forecasts, storms

IST = ZoneInfo("Asia/Kolkata")
SAMPLE_DIR = Path(__file__).parents[1] / "sim" / "documents"
SAMPLES = {  # the demo set; the labelled set in SAMPLE_DIR/labels.json adds variants
    "storm_bulletin.pdf": "Storm bulletin (PDF)",
    "corridor_derate.txt": "Corridor derate instruction",
    "curtailment_order.png": "Curtailment order (photo)",
    "corridor_uprating.txt": "Corridor uprating, raises a limit",
    "shift_roster.txt": "Shift roster, no constraints",
}
MIMES = {".pdf": "application/pdf", ".txt": "text/plain", ".png": "image/png", ".jpg": "image/jpeg",
         ".jpeg": "image/jpeg"}
MAX_BYTES = 5_000_000
SUPPORTED = ("storm", "line_derate", "asset_outage", "curtailment_order")
CONFIDENT = 0.8
HORIZON = timedelta(days=7)


@dataclass
class Reference:
    nodes: dict[str, str]  # code → name
    lines: dict[str, float]  # code → base limit, MW
    assets: dict[str, tuple[str, str, float]]  # code → (name, kind, capacity)

    @classmethod
    def load(cls, db: Session, portfolio_id: int) -> "Reference":
        of = lambda *cols: db.execute(select(*cols).where(cols[0].class_.portfolio_id == portfolio_id)).all()  # noqa: E731
        return cls(dict(of(Node.code, Node.name)), dict(of(Line.code, Line.limit_mw)),
                   {code: (name, kind, cap) for code, name, kind, cap, active in
                    of(Asset.code, Asset.name, Asset.kind, Asset.capacity_mw, Asset.active)
                    if active and kind in ("solar", "wind", "bess")})

    @property
    def codes(self) -> list[str]:
        return [*self.nodes, *self.lines, *self.assets]

    def text(self) -> str:
        return "\n".join([
            "Nodes: " + "; ".join(f"{c} ({n})" for c, n in self.nodes.items()),
            "Lines: " + "; ".join(f"{c} (normal limit {v:g} MW)" for c, v in self.lines.items()),
            "Assets: " + "; ".join(f"{c} ({n}, {k}, {cap:g} MW)" for c, (n, k, cap) in self.assets.items()),
        ])

    def name(self, code: str) -> str:
        return self.nodes.get(code) or (self.assets[code][0] if code in self.assets else code)


def read_text(content: bytes, mime: str) -> str | None:
    if mime == "application/pdf":
        return "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(content)).pages[:20])
    if mime == "text/plain":
        return content.decode("utf-8", errors="replace")
    return None  # an image: the model reads it, nothing can check its quotes


def _plain(text: str) -> str:
    text = text.lower().replace("’", "'").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", text).strip()


def check(item: dict, ref: Reference, now: datetime, text: str | None) -> dict:
    """The validator: Constraint fields for one extracted item, with its status and why."""
    out = {"kind": item["kind"], "targets": item["targets"], "value": item["value"],
           "quote": item["source_quote"][:600], "confidence": item["confidence"],
           "verified": text is not None and _plain(item["source_quote"]) in _plain(text), "tightens": True}
    try:
        out["start_at"], out["end_at"] = (datetime.fromisoformat(item[k]).replace(tzinfo=IST) for k in ("start", "end"))
    except ValueError:
        return {**out, "start_at": now, "end_at": now, "status": "rejected", "note": "The time window is unreadable"}

    def rejected(note: str) -> dict:
        return {**out, "status": "rejected", "note": note}

    kind, targets, value = item["kind"], item["targets"], item["value"]
    if kind not in SUPPORTED:
        return rejected(f"{kind.replace('_', ' ').capitalize()} is not supported yet")
    if out["end_at"] <= out["start_at"] or out["end_at"] <= now or out["start_at"] > now + HORIZON:
        return rejected("The window has passed, is empty, or starts more than 7 days ahead")
    allowed = {"storm": ref.nodes, "line_derate": ref.lines,
               "asset_outage": ref.assets,
               "curtailment_order": {c for c, (_, k, _) in ref.assets.items() if k in ("solar", "wind")}}[kind]
    if not targets or any(t not in allowed for t in targets) or (kind == "line_derate" and len(targets) != 1):
        return rejected("Its targets do not fit this kind of constraint")
    if kind == "line_derate":
        base = ref.lines[targets[0]]
        if value is None or not 0 <= value <= 2 * base:
            return rejected(f"A limit for {targets[0]} must be between 0 and {2 * base:g} MW")
        out["tightens"] = value < base
    if kind == "curtailment_order" and (value is None or not 0 <= value <= max(ref.assets[t][2] for t in targets)):
        return rejected("The output cap must be between 0 MW and the plant's capacity")
    auto = out["tightens"] and out["confidence"] >= CONFIDENT and out["verified"]
    why = ("Tightens a limit, quote found: applied automatically" if auto else
           "Raises a limit: needs your confirmation" if not out["tightens"] else
           "The quote cannot be checked against an image: needs your confirmation" if text is None else
           "Quote not found in the document: needs your confirmation" if not out["verified"] else
           "BOB is not confident: needs your confirmation")
    return {**out, "status": "active" if auto else "pending", "note": why}


def upload(db: Session, run: Run, user_id: int, filename: str, mime: str, content: bytes, now: datetime) -> None:
    """Store, extract and validate a document, and post BOB's reading to the chat. The run is
    locked only for applying constraints, not while the model reads."""
    ref = Reference.load(db, run.portfolio_id)
    text = read_text(content, mime)
    doc = Document(run_id=run.id, filename=filename[:200], mime=mime, content=content,
                   sha256=hashlib.sha256(content).hexdigest(), text=text, uploaded_by=user_id)
    db.add(doc)
    db.flush()
    sim = runs.sim_now(run, now)
    try:
        result = extract.extract(db, run.id, ref.text(), ref.codes, text, None if text is not None else content, mime)
    except Unavailable as error:
        result = None
        reply = f"I couldn't read {filename} ({error}). Nothing was applied."
    found = []
    if result is not None:
        doc.extraction = result
        found = [Constraint(run_id=run.id, document_id=doc.id, **check(i, ref, sim, text)) for i in result["items"]]
        db.add_all(found)
        db.flush()
        reply = result["summary"] + ("" if found else " It states no operational constraint, so nothing changes.")
    db.add(ChatMessage(run_id=run.id, user_id=user_id, role="user", content={
        "message": {"role": "user", "content": f"(Uploaded the document {filename}.)"}, "text": f"📎 {filename}"}))
    db.add(ChatMessage(run_id=run.id, user_id=user_id, role="assistant", content={
        "message": {"role": "assistant", "content": reply},
        "cards": [{"type": "constraint", "id": c.id} for c in found]}))
    applied = [c for c in found if c.status == "active"]
    if applied:
        _replan(db, runs.lock_run(db, run.id), now, applied, f"Document {filename}")


def decide(db: Session, run: Run, constraint: Constraint, decision: str, user: str, now: datetime) -> None:
    """apply or reject a pending constraint, or withdraw an active one. Caller holds the run lock."""
    before, after, done = {"apply": ("pending", "active", "Applied"), "reject": ("pending", "rejected", "Rejected"),
                           "withdraw": ("active", "withdrawn", "Withdrawn")}[decision]
    if constraint.status != before:
        raise ValueError(f"This constraint is {constraint.status}, so it cannot be changed that way")
    constraint.status, constraint.decided_by, constraint.decided_at = after, user, runs.sim_now(run, now)
    constraint.note = f"{done} by {user}"
    if decision != "reject":
        _replan(db, run, now, [constraint], f"{done} by {user}: {constraint.kind.replace('_', ' ')}")


def _replan(db: Session, run: Run, now: datetime, changed: list[Constraint], detail: str) -> None:
    """Re-plan the block in progress on what BOB now knows; a storm also reviews maintenance."""
    runs.replan(db, run, now, "document", detail[:200])
    t0 = run.current_block + 1
    if any(c.kind == "storm" for c in changed) and t0 < run.total_blocks:
        ctx = runs.RunContext.load(db, run)
        maintenance.review(db, ctx, run, t0, latest_forecasts(db, ctx, run, t0),
                           storms(run, knowledge(db, ctx, run), t0), runs.sim_now(run, now))


KIND_LABELS = {"storm": "Storm", "line_derate": "Line limit", "asset_outage": "Out of service",
               "curtailment_order": "Output cap"}


def _label(c: Constraint, ref: Reference) -> str:
    targets = ", ".join(ref.name(t) for t in c.targets)
    window = f"{c.start_at.astimezone(IST):%H:%M}–{c.end_at.astimezone(IST):%H:%M}"
    value = f" {c.value:g} MW" if c.value is not None else ""
    return f"{KIND_LABELS.get(c.kind, c.kind)}: {targets}{value}, {window}"


def card(db: Session, c: Constraint, ref: Reference) -> dict:
    """A constraint as the chat shows it, with its current status."""
    doc = db.get(Document, c.document_id) if c.document_id else None
    return {"type": "constraint", "id": c.id, "kind": c.kind, "label": _label(c, ref), "quote": c.quote,
            "status": c.status, "note": c.note, "verified": c.verified, "confidence": c.confidence,
            "filename": doc.filename if doc else None}

