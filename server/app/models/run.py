from datetime import datetime
from typing import Any

from sqlalchemy import (
    ARRAY, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, LargeBinary, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

RUN_STATUSES = ("running", "paused", "done")
# Each run is settled twice on the same world: BOB's plan and today's rule-based practice.
POLICIES = ("bob", "baseline")


class Study(Base):
    """A replay of one preset over several seeds: BOB and today's practice on the same worlds."""

    __tablename__ = "study"

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolio.id", ondelete="CASCADE"))
    preset: Mapped[str] = mapped_column(String(32))
    seeds: Mapped[int] = mapped_column(Integer)
    created_by: Mapped[str] = mapped_column(String(320))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Run(Base):
    __tablename__ = "run"
    __table_args__ = (
        CheckConstraint(f"status IN {RUN_STATUSES}", name="run_status"),
        Index("ix_run_clock", "status", "next_due_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolio.id", ondelete="CASCADE"))
    # A replay belongs to a study; the live demo run has none.
    study_id: Mapped[int | None] = mapped_column(ForeignKey("study.id", ondelete="CASCADE"), index=True)
    preset: Mapped[str] = mapped_column(String(32))
    config: Mapped[dict[str, Any]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(16), default="running")
    speed: Mapped[float] = mapped_column(Float)
    sim_start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    total_blocks: Mapped[int] = mapped_column(Integer)
    live_from_block: Mapped[int] = mapped_column(Integer)
    # Last settled block; -1 before the first one.
    current_block: Mapped[int] = mapped_column(Integer, default=-1)
    block_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    next_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Day-ahead net drawal (MW per block), fixed when the run starts.
    dam_schedule: Mapped[list[float]] = mapped_column(ARRAY(Float))
    # The operating mode in force and who set it (operator, rule or BOB).
    mode_code: Mapped[str] = mapped_column(String(32), server_default="balanced")
    mode_by: Mapped[str] = mapped_column(String(16), server_default="operator")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorldEvent(Base):
    """Something that really happens in the simulated world (truth, not BOB's knowledge)."""

    __tablename__ = "world_event"
    __table_args__ = (Index("ix_world_event_run", "run_id", "sim_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"))
    sim_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    kind: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    source: Mapped[str] = mapped_column(String(16))
    fired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Forecasts include an event only after a forecast_update reveals it.
    revealed: Mapped[bool] = mapped_column(default=False)


class AssetBlock(Base):
    __tablename__ = "asset_block"

    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"), primary_key=True)
    policy: Mapped[str] = mapped_column(String(16), primary_key=True)
    block: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("asset.id", ondelete="CASCADE"), primary_key=True)
    available_mw: Mapped[float] = mapped_column(Float)
    actual_mw: Mapped[float] = mapped_column(Float)
    soc_mwh: Mapped[float | None] = mapped_column(Float)


class SystemBlock(Base):
    __tablename__ = "system_block"

    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"), primary_key=True)
    policy: Mapped[str] = mapped_column(String(16), primary_key=True)
    block: Mapped[int] = mapped_column(Integer, primary_key=True)
    frequency_hz: Mapped[float] = mapped_column(Float)
    dam_price: Mapped[float] = mapped_column(Float)
    rtm_price: Mapped[float] = mapped_column(Float)
    emission_factor: Mapped[float] = mapped_column(Float)
    net_exchange_mw: Mapped[float] = mapped_column(Float)
    schedule_mw: Mapped[float] = mapped_column(Float)
    deviation_mw: Mapped[float] = mapped_column(Float)
    # Costs for the block (₹): market trades, deviation settlement, demand response,
    # battery wear and curtailment compensation; cost_inr is their total.
    market_inr: Mapped[float] = mapped_column(Float)
    dsm_inr: Mapped[float] = mapped_column(Float)
    dr_inr: Mapped[float] = mapped_column(Float)
    wear_inr: Mapped[float] = mapped_column(Float)
    curtail_inr: Mapped[float] = mapped_column(Float)
    cost_inr: Mapped[float] = mapped_column(Float)
    carbon_t: Mapped[float] = mapped_column(Float)
    curtailed_mwh: Mapped[float] = mapped_column(Float)
    unserved_mwh: Mapped[float] = mapped_column(Float)


class LineBlock(Base):
    __tablename__ = "line_block"

    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"), primary_key=True)
    policy: Mapped[str] = mapped_column(String(16), primary_key=True)
    block: Mapped[int] = mapped_column(Integer, primary_key=True)
    line_id: Mapped[int] = mapped_column(ForeignKey("line.id", ondelete="CASCADE"), primary_key=True)
    limit_mw: Mapped[float] = mapped_column(Float)
    flow_mw: Mapped[float] = mapped_column(Float)


class Forecast(Base):
    """One forecast issue for one series: arrays over the blocks after `issued_block`."""

    __tablename__ = "forecast"
    __table_args__ = (Index("ix_forecast_lookup", "run_id", "series", "asset_id", "issued_block"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"))
    issued_block: Mapped[int] = mapped_column(Integer)
    series: Mapped[str] = mapped_column(String(16))
    asset_id: Mapped[int | None] = mapped_column(ForeignKey("asset.id", ondelete="CASCADE"))
    p10: Mapped[list[float]] = mapped_column(ARRAY(Float))
    p50: Mapped[list[float]] = mapped_column(ARRAY(Float))
    p90: Mapped[list[float]] = mapped_column(ARRAY(Float))


class Cycle(Base):
    """One decision cycle: BOB plans the block about to start."""

    __tablename__ = "cycle"
    __table_args__ = (UniqueConstraint("run_id", "block", "seq"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"))
    block: Mapped[int] = mapped_column(Integer)
    seq: Mapped[int] = mapped_column(Integer, default=0)
    trigger: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16))
    timings: Mapped[dict[str, Any]] = mapped_column(JSONB)
    situation: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default="[]")
    mode: Mapped[str] = mapped_column(String(32), server_default="balanced")
    mode_by: Mapped[str] = mapped_column(String(16), server_default="rule")
    mode_reason: Mapped[str] = mapped_column(String(300), server_default="")
    floors: Mapped[list[str]] = mapped_column(JSONB, server_default="[]")
    scenarios: Mapped[list[str]] = mapped_column(JSONB, server_default="[]")
    rationale: Mapped[str] = mapped_column(String(600), server_default="")
    trigger_detail: Mapped[str] = mapped_column(String(200), server_default="")
    selected_by: Mapped[str] = mapped_column(String(16), server_default="rule")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Plan(Base):
    __tablename__ = "plan"

    id: Mapped[int] = mapped_column(primary_key=True)
    cycle_id: Mapped[int] = mapped_column(ForeignKey("cycle.id", ondelete="CASCADE"), index=True)
    variant: Mapped[str] = mapped_column(String(16))
    role: Mapped[str] = mapped_column(String(16))
    kpis: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # Columnar arrays over the horizon, read whole by the charts.
    schedule: Mapped[dict[str, Any]] = mapped_column(JSONB)
    solver: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # Per stress scenario: regret (₹) and whether the plan still serves load and holds reserve.
    robust: Mapped[dict[str, Any] | None] = mapped_column(JSONB)


class Action(Base):
    """One dispatch decision, from proposal to verification."""

    __tablename__ = "action"
    __table_args__ = (Index("ix_action_run_block", "run_id", "policy", "block"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"))
    policy: Mapped[str] = mapped_column(String(16))
    cycle_id: Mapped[int | None] = mapped_column(ForeignKey("cycle.id", ondelete="CASCADE"))
    block: Mapped[int] = mapped_column(Integer)  # delivery block
    kind: Mapped[str] = mapped_column(String(24))
    asset_id: Mapped[int | None] = mapped_column(ForeignKey("asset.id", ondelete="CASCADE"))
    mw: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(24))
    reason: Mapped[str | None] = mapped_column(String(200))
    idempotency_key: Mapped[str] = mapped_column(String(80), unique=True)
    delivered_mw: Mapped[float | None] = mapped_column(Float)
    actual_mw: Mapped[float | None] = mapped_column(Float)
    tier: Mapped[str] = mapped_column(String(16), server_default="auto")
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by: Mapped[str | None] = mapped_column(String(320))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    params: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # e.g. a maintenance move's task and start
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgentCall(Base):
    """One agent turn (a cycle decision, a chat reply or an extraction), for cost and reliability."""

    __tablename__ = "agent_call"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"), index=True)
    cycle_id: Mapped[int | None] = mapped_column(ForeignKey("cycle.id", ondelete="CASCADE"))
    purpose: Mapped[str] = mapped_column(String(16))
    deployment: Mapped[str] = mapped_column(String(64))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cached_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    tool_calls: Mapped[int] = mapped_column(Integer, default=0)
    outcome: Mapped[str] = mapped_column(String(16))  # ok | fallback | error
    error: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChatMessage(Base):
    """Ask BOB: the conversation, stored as API messages so it can be replayed."""

    __tablename__ = "chat_message"
    __table_args__ = (Index("ix_chat_message_run_user", "run_id", "user_id", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Document(Base):
    """An uploaded document. Files are small; keeping them here lets every replica read them."""

    __tablename__ = "document"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(200))
    mime: Mapped[str] = mapped_column(String(64))
    content: Mapped[bytes] = mapped_column(LargeBinary)
    sha256: Mapped[str] = mapped_column(String(64))
    text: Mapped[str | None] = mapped_column(Text)  # read locally; None for images
    extraction: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Constraint(Base):
    """What BOB knows about a limit or hazard, as opposed to the world event that makes it real."""

    __tablename__ = "run_constraint"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("document.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(24))
    targets: Mapped[list[str]] = mapped_column(JSONB)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    value: Mapped[float | None] = mapped_column(Float)
    quote: Mapped[str] = mapped_column(String(600))
    confidence: Mapped[float] = mapped_column(Float)
    verified: Mapped[bool] = mapped_column(Boolean)  # the quote was found in the document's text
    tightens: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String(16))  # pending | active | rejected | withdrawn
    note: Mapped[str] = mapped_column(String(300), server_default="")
    decided_by: Mapped[str | None] = mapped_column(String(320))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MaintenanceTask(Base):
    """A planned job. Today's practice keeps the calendared start; BOB may move its own."""

    __tablename__ = "maintenance_task"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"), index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("asset.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(24))
    duration_blocks: Mapped[int] = mapped_column(Integer)
    earliest_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # must finish by
    calendar_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    safety_critical: Mapped[bool] = mapped_column(Boolean, default=False)
