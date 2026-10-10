from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, LargeBinary, String, UniqueConstraint, func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

SITE_KINDS = ("solar", "wind", "hybrid", "industrial")
ASSET_KINDS = ("solar", "wind", "bess", "consumer", "interconnection")


class Portfolio(Base):
    __tablename__ = "portfolio"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    tz: Mapped[str] = mapped_column(String(40))
    mode_code: Mapped[str] = mapped_column(String(32))
    market: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # Organisation limits no configured action can loosen (shown as locked in the setup wizard).
    protected: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")

    sites: Mapped[list["Site"]] = relationship(back_populates="portfolio", order_by="Site.id")


class Site(Base):
    __tablename__ = "site"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "code"),
        CheckConstraint(f"kind IN {SITE_KINDS}", name="site_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolio.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(16))
    location: Mapped[str] = mapped_column(String(120))
    commissioned_on: Mapped[date] = mapped_column(Date)

    portfolio: Mapped[Portfolio] = relationship(back_populates="sites")
    assets: Mapped[list["Asset"]] = relationship(back_populates="site", order_by="Asset.code")


class Node(Base):
    __tablename__ = "node"
    __table_args__ = (UniqueConstraint("portfolio_id", "code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolio.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(120))


class Line(Base):
    __tablename__ = "line"
    __table_args__ = (UniqueConstraint("portfolio_id", "code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolio.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(32))
    from_node_id: Mapped[int] = mapped_column(ForeignKey("node.id", ondelete="CASCADE"))
    to_node_id: Mapped[int] = mapped_column(ForeignKey("node.id", ondelete="CASCADE"))
    limit_mw: Mapped[float] = mapped_column(Float)


class Asset(Base):
    __tablename__ = "asset"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "code"),
        CheckConstraint(f"kind IN {ASSET_KINDS}", name="asset_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolio.id", ondelete="CASCADE"))
    site_id: Mapped[int] = mapped_column(ForeignKey("site.id", ondelete="CASCADE"), index=True)
    node_id: Mapped[int] = mapped_column(ForeignKey("node.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(120))
    capacity_mw: Mapped[float] = mapped_column(Float)
    params: Mapped[dict[str, Any]] = mapped_column(JSONB)
    active: Mapped[bool] = mapped_column(default=True)

    site: Mapped[Site] = relationship(back_populates="assets")
    node: Mapped[Node] = relationship()


CONFIG_KINDS = ("battery_charge", "battery_discharge", "curtail", "demand_response", "load_shift",
                "grid_import", "grid_export")


class ActionConfig(Base):
    """BOB's mandate for one kind of action on one asset: whether it may act, within which
    limits, and whether it acts alone, asks for approval, or only recommends."""

    __tablename__ = "action_config"
    __table_args__ = (
        CheckConstraint(f"kind IN {CONFIG_KINDS}", name="action_config_kind"),
        CheckConstraint("autonomy IN ('auto', 'approval', 'recommend')", name="action_config_autonomy"),
        CheckConstraint("status IN ('draft', 'testing', 'active', 'paused')", name="action_config_status"),
        Index("uq_action_config_current", "asset_id", "kind", unique=True, postgresql_where=text("current")),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("site.id", ondelete="CASCADE"))
    asset_id: Mapped[int] = mapped_column(ForeignKey("asset.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(24))
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(16))
    version: Mapped[int] = mapped_column(default=1)
    current: Mapped[bool] = mapped_column(default=True)
    autonomy: Mapped[str] = mapped_column(String(16))
    # auto_max_mw, max_mw, reserve_pct, min_price_inr_mwh; for a battery discharge also max_minutes,
    # max_mwh, deficit_mw, deficit_minutes (each optional)
    limits: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # approver, response_min
    approval: Mapped[dict[str, Any]] = mapped_column(JSONB)
    # [{metric, value}]: crossing one makes BOB re-plan and shows on the site's AI Actions tab
    watch: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default="[]")
    # objective, recovery, notify: recorded for people, not used by dispatch
    preferences: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
    # Last test results by scenario: {label, passed, detail}
    tests: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
    activated_by: Mapped[str | None] = mapped_column(String(320))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DataSource(Base):
    """A site's connected data (a mock): an imported CSV of telemetry history, or a live API that
    the simulator answers for. The demo stores imports but plans only on simulated telemetry."""

    __tablename__ = "data_source"
    __table_args__ = (CheckConstraint("kind IN ('csv', 'api')", name="data_source_kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("site.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(8))
    name: Mapped[str] = mapped_column(String(300))  # file name or endpoint URL
    rows: Mapped[int | None] = mapped_column(Integer)
    columns: Mapped[list[dict[str, str]]] = mapped_column(JSONB, server_default="[]")  # [{name, type}]
    content: Mapped[bytes | None] = mapped_column(LargeBinary)
    refresh_min: Mapped[int | None] = mapped_column(Integer)
    created_by: Mapped[str] = mapped_column(String(320))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
