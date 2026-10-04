from datetime import date
from typing import Any

from sqlalchemy import CheckConstraint, Date, Float, ForeignKey, String, UniqueConstraint
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
