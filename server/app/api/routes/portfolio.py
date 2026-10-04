from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.portfolio import Portfolio
from app.schemas.portfolio import PortfolioResponse, SiteDetail
from app.services.portfolio import get_portfolio, portfolio_overview, site_detail

router = APIRouter(dependencies=[Depends(get_current_user)])


def current_portfolio(db: Session = Depends(get_db)) -> Portfolio:
    portfolio = get_portfolio(db)
    if portfolio is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No portfolio yet. Run `make seed`.",
        )
    return portfolio


@router.get("/portfolio", response_model=PortfolioResponse)
def read_portfolio(
    db: Session = Depends(get_db), portfolio: Portfolio = Depends(current_portfolio)
) -> PortfolioResponse:
    return portfolio_overview(db, portfolio)


@router.get("/sites/{code}", response_model=SiteDetail)
def read_site(code: str, portfolio: Portfolio = Depends(current_portfolio)) -> SiteDetail:
    site = site_detail(portfolio, code)
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    return site
