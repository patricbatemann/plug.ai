"""A site's activity log: what happened and why, newest first. Merges BOB's re-plans and mode
changes, actions that needed a person or called a customer, maintenance work orders, world
events, constraints read from documents, and configuration changes."""

from bisect import bisect_right
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.portfolio import ActionConfig, Asset, Line, Node, Site
from app.models.run import Constraint, Cycle, Document, Run, WorldEvent
from app.services import runs
from app.services.policy import WORK_ORDERS
from app.services.summary import recent_actions

CATEGORIES = ("decisions", "actions", "maintenance", "events", "documents", "configuration")
LIMIT = 200
PORTFOLIO_EVENTS = ("price_spike", "frequency_dip", "forecast_update", "document_publish")


def site_activity(db: Session, run: Run, site: Site, categories: set[str]) -> list[dict]:
    assets = {a.code for a in site.assets}
    nodes = set(db.scalars(select(Node.code).join(Asset, Asset.node_id == Node.id).where(Asset.site_id == site.id)))
    node_ids = select(Node.id).where(Node.code.in_(nodes))
    lines = set(db.scalars(select(Line.code).where(Line.from_node_id.in_(node_ids) | Line.to_node_id.in_(node_ids))))
    cycles = list(db.scalars(select(Cycle).where(Cycle.run_id == run.id).order_by(Cycle.id)))
    when = lambda block: run.sim_start_at + block * runs.BLOCK  # noqa: E731
    stamps = [c.created_at for c in cycles]

    def sim_at(wall: datetime) -> datetime:
        """Sim time of something recorded in wall time: the block being planned at that moment."""
        i = bisect_right(stamps, wall)
        return when(cycles[i - 1].block) if i else run.sim_start_at

    out = []
    if "decisions" in categories:
        mode = None
        for c in cycles:
            if c.mode != mode and mode is not None:
                by = {"bob": "BOB", "rule": "Rule", "operator": "Operator default"}[c.mode_by]
                out.append(entry(when(c.block), "decisions", f"Mode: {c.mode.replace('_', ' ')}", c.mode_reason, by))
            if c.trigger != "tick":
                out.append(entry(when(c.block), "decisions", f"Re-planned: {c.trigger_detail or c.trigger}",
                                 c.rationale, "BOB" if c.selected_by == "bob" else "Rule"))
            mode = c.mode
    if categories & {"actions", "maintenance"}:
        for a in recent_actions(db, run, LIMIT, site=site.code, notable=True):
            category = "maintenance" if a.kind in WORK_ORDERS else "actions"
            if category in categories:
                out.append({**entry(a.time, category, None, a.reason or "", a.decided_by or "BOB"),
                            "kind": a.kind, "mw": a.mw, "status": a.status, "asset": a.asset})
    if "events" in categories:
        labels = {**runs.VISIBLE, **runs.NOTICES}
        for e in db.scalars(select(WorldEvent).where(WorldEvent.run_id == run.id, WorldEvent.fired_at.isnot(None))):
            p = e.payload
            if (e.kind in PORTFOLIO_EVENTS or p.get("asset") in assets or p.get("node") in nodes
                    or p.get("line") in lines or assets & set(p.get("assets", []))):
                label = labels.get(e.kind, lambda _: e.kind.replace("_", " ").capitalize())(p)
                out.append(entry(e.sim_at, "events", label, "", "Operator" if e.source == "operator" else "Simulator"))
    if "documents" in categories:
        rows = db.execute(select(Constraint, Document.filename, Document.created_at)
                          .join(Document, Document.id == Constraint.document_id).where(Constraint.run_id == run.id))
        for c, filename, uploaded in rows:
            if set(c.targets) & (assets | nodes | lines):
                window = f"{c.start_at.astimezone(runs.IST):%H:%M}–{c.end_at.astimezone(runs.IST):%H:%M}"
                out.append(entry(c.decided_at or sim_at(uploaded), "documents",
                                 f"{c.kind.replace('_', ' ').capitalize()} {', '.join(c.targets)}, {window}: "
                                 f"{c.status}",
                                 f"{c.note}. From {filename}: “{c.quote}”", c.decided_by or "BOB"))
    if "configuration" in categories:
        for c in db.scalars(select(ActionConfig).where(ActionConfig.site_id == site.id,
                                                       ActionConfig.activated_at.isnot(None))):
            out.append(entry(sim_at(c.activated_at), "configuration", f"{c.name}: version {c.version} activated",
                             f"Autonomy {c.autonomy}; " + ", ".join(f"{k.replace('_', ' ')} {v:g}"
                                                                     for k, v in c.limits.items()), c.activated_by))
    return sorted(out, key=lambda e: e["at"], reverse=True)[:LIMIT]


def entry(at: datetime, category: str, title: str | None, detail: str, by: str) -> dict:
    return {"at": at, "category": category, "title": title, "detail": detail, "by": by,
            "kind": None, "mw": None, "status": None, "asset": None}
