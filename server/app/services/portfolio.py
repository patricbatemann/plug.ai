from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.portfolio import Asset, Line, Node, Portfolio, Site
from app.schemas.portfolio import (
    AssetRef, NetworkItem, PortfolioResponse, PortfolioTotals, SiteDetail, SiteSummary,
)


def _capacity(assets: list[Asset], kind: str) -> float:
    return sum(a.capacity_mw for a in assets if a.kind == kind)


def _battery_mwh(assets: list[Asset]) -> float:
    return sum(a.params["energy_mwh"] for a in assets if a.kind == "bess")


def get_portfolio(db: Session) -> Portfolio | None:
    # The demo runs a single portfolio.
    return db.scalar(
        select(Portfolio)
        .options(selectinload(Portfolio.sites).selectinload(Site.assets))
        .order_by(Portfolio.id)
        .limit(1)
    )


def portfolio_overview(db: Session, portfolio: Portfolio) -> PortfolioResponse:
    assets = [a for site in portfolio.sites for a in site.assets]
    nodes = db.scalars(select(Node).where(Node.portfolio_id == portfolio.id).order_by(Node.code)).all()
    lines = db.scalars(select(Line).where(Line.portfolio_id == portfolio.id).order_by(Line.code)).all()
    return PortfolioResponse(
        name=portfolio.name,
        tz=portfolio.tz,
        mode_code=portfolio.mode_code,
        protected=portfolio.protected,
        totals=PortfolioTotals(
            solar_mw=_capacity(assets, "solar"),
            wind_mw=_capacity(assets, "wind"),
            battery_mw=_capacity(assets, "bess"),
            battery_mwh=_battery_mwh(assets),
            demand_mw=_capacity(assets, "consumer"),
        ),
        sites=[
            SiteSummary(
                code=site.code,
                name=site.name,
                kind=site.kind,
                location=site.location,
                generation_mw=_capacity(site.assets, "solar") + _capacity(site.assets, "wind"),
                battery_mwh=_battery_mwh(site.assets),
                asset_kinds=sorted({a.kind for a in site.assets}),
            )
            for site in portfolio.sites
        ],
        nodes=[NetworkItem(code=n.code, name=n.name) for n in nodes],
        lines=[NetworkItem(code=line.code, name=f"{line.code} ({line.limit_mw:g} MW)") for line in lines],
        assets=[AssetRef(code=a.code, name=a.name, kind=a.kind) for a in assets],
    )


def site_detail(portfolio: Portfolio, code: str) -> SiteDetail | None:
    site = next((s for s in portfolio.sites if s.code == code), None)
    if site is None:
        return None
    return SiteDetail(
        code=site.code,
        name=site.name,
        kind=site.kind,
        location=site.location,
        commissioned_on=site.commissioned_on,
        mode_code=portfolio.mode_code,
        assets=site.assets,
    )
