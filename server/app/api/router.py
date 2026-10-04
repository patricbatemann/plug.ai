from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.runs import router as runs_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(portfolio_router, tags=["portfolio"])
api_router.include_router(runs_router, tags=["runs"])
