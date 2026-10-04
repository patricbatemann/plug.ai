from datetime import datetime
from typing import Any

from sqlalchemy import ARRAY, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

RUN_STATUSES = ("running", "paused", "done")


class Run(Base):
    __tablename__ = "run"
    __table_args__ = (
        CheckConstraint(f"status IN {RUN_STATUSES}", name="run_status"),
        Index("ix_run_clock", "status", "next_due_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolio.id", ondelete="CASCADE"))
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
    block: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("asset.id", ondelete="CASCADE"), primary_key=True)
    available_mw: Mapped[float] = mapped_column(Float)
    actual_mw: Mapped[float] = mapped_column(Float)
    soc_mwh: Mapped[float | None] = mapped_column(Float)


class SystemBlock(Base):
    __tablename__ = "system_block"

    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"), primary_key=True)
    block: Mapped[int] = mapped_column(Integer, primary_key=True)
    frequency_hz: Mapped[float] = mapped_column(Float)
    dam_price: Mapped[float] = mapped_column(Float)
    rtm_price: Mapped[float] = mapped_column(Float)
    emission_factor: Mapped[float] = mapped_column(Float)
    net_exchange_mw: Mapped[float] = mapped_column(Float)
    cost_inr: Mapped[float] = mapped_column(Float)
    carbon_t: Mapped[float] = mapped_column(Float)
    curtailed_mwh: Mapped[float] = mapped_column(Float)
    unserved_mwh: Mapped[float] = mapped_column(Float)


class LineBlock(Base):
    __tablename__ = "line_block"

    run_id: Mapped[int] = mapped_column(ForeignKey("run.id", ondelete="CASCADE"), primary_key=True)
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
