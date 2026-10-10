from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.configs import router as configs_router
from app.api.routes.documents import router as documents_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.runs import router as runs_router
from app.api.routes.sites import mock_router, router as sites_router
from app.api.routes.studies import router as studies_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(portfolio_router, tags=["portfolio"])
api_router.include_router(runs_router, tags=["runs"])
api_router.include_router(configs_router, tags=["configs"])
api_router.include_router(documents_router, tags=["documents"])
api_router.include_router(studies_router, tags=["simulation"])
api_router.include_router(sites_router, tags=["sites"])
api_router.include_router(mock_router, tags=["mock"])
