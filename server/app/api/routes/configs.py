from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.api.routes.portfolio import current_portfolio, current_site
from app.core.database import get_db
from app.models.portfolio import ActionConfig, Asset, Portfolio, Site
from app.models.run import AssetBlock, Run
from app.models.user import User
from app.schemas.configs import (
    AssetOption, ConfigDraft, ConfigOptions, ConfigOut, ConfigValues, StatusUpdate, WatchStatus,
)
from app.services import configs, policy, runs
from app.services.dispatch import latest_forecasts
from app.services.runs import RunContext

router = APIRouter(dependencies=[Depends(get_current_user)])


def _config(config_id: int, db: Session = Depends(get_db)) -> ActionConfig:
    config = db.get(ActionConfig, config_id)
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuration not found")
    return config


def _values(c: ActionConfig) -> ConfigValues:
    return ConfigValues(name=c.name, autonomy=c.autonomy, limits=c.limits, approval=c.approval, watch=c.watch,
                        preferences=c.preferences)


def _out(db: Session, c: ActionConfig, asset: Asset, actions_today: int = 0) -> ConfigOut:
    active = None
    if not c.current:
        in_force = db.scalar(select(ActionConfig).where(
            ActionConfig.asset_id == c.asset_id, ActionConfig.kind == c.kind, ActionConfig.current))
        active = _values(in_force) if in_force else None
    return ConfigOut(**_values(c).model_dump(), id=c.id, asset=asset.code, asset_name=asset.name, kind=c.kind,
                     status=c.status, version=c.version, current=c.current, tests=c.tests,
                     actions_today=actions_today, active=active)


@router.get("/sites/{code}/configs", response_model=list[ConfigOut])
def list_configs(site: Site = Depends(current_site), db: Session = Depends(get_db)) -> list[ConfigOut]:
    return [_out(db, row["config"], row["asset"], row["actions_today"])
            for row in configs.site_configs(db, site, runs.latest_live(db))]


@router.get("/sites/{code}/config-options", response_model=ConfigOptions)
def config_options(site: Site = Depends(current_site), db: Session = Depends(get_db),
                   portfolio: Portfolio = Depends(current_portfolio)) -> ConfigOptions:
    def offered(asset: Asset, kind: str) -> bool:
        holder = configs.market_asset(db, portfolio.id, kind) if kind in policy.MARKET else None
        return holder is None or holder.id == asset.id

    return ConfigOptions(
        assets=[AssetOption(code=a.code, name=a.name, kind=a.kind, capacity_mw=a.capacity_mw,
                            actions=[k for k in configs.KINDS_FOR.get(a.kind, ()) if offered(a, k)],
                            watch_metric=configs.WATCH_METRICS.get(a.kind, (None, None))[0],
                            watch_label=configs.WATCH_METRICS.get(a.kind, (None, None))[1])
                for a in site.assets],
        limits={kind: list(keys) for kind, keys in configs.LIMITS_FOR.items()},
        protected=portfolio.protected,
    )


@router.post("/sites/{code}/configs", response_model=ConfigOut, status_code=status.HTTP_201_CREATED)
def save_draft(payload: ConfigDraft, site: Site = Depends(current_site), db: Session = Depends(get_db),
               portfolio: Portfolio = Depends(current_portfolio)) -> ConfigOut:
    asset = next((a for a in site.assets if a.code == payload.asset), None)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown asset for this site")
    values = payload.model_dump(exclude={"asset", "kind"})
    try:
        draft = configs.save_draft(db, site, asset, payload.kind, values, portfolio.protected)
    except configs.ProtectedLimit as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"Protected boundary: {error}") from None
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from None
    db.commit()
    return _out(db, draft, asset)


@router.post("/configs/{config_id}/test", response_model=ConfigOut)
def test_config(config: ActionConfig = Depends(_config), db: Session = Depends(get_db)) -> ConfigOut:
    try:
        runs.test_config(db, runs.latest_live(db), config)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from None
    db.commit()
    return _out(db, config, db.get(Asset, config.asset_id))


@router.post("/configs/{config_id}/activate", response_model=ConfigOut)
def activate(config: ActionConfig = Depends(_config), db: Session = Depends(get_db),
             user: User = Depends(get_current_user)) -> ConfigOut:
    try:
        configs.activate(db, config, user.email, datetime.now(timezone.utc))
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from None
    db.commit()
    return _out(db, config, db.get(Asset, config.asset_id))


@router.patch("/configs/{config_id}", response_model=ConfigOut)
def set_status(payload: StatusUpdate, config: ActionConfig = Depends(_config), db: Session = Depends(get_db)) -> ConfigOut:
    if not config.current:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only the configuration in force can be paused")
    config.status = payload.status
    db.commit()
    return _out(db, config, db.get(Asset, config.asset_id))


@router.get("/runs/{run_id}/sites/{code}/watch", response_model=list[WatchStatus])
def watch_status(run_id: int, site: Site = Depends(current_site), db: Session = Depends(get_db)) -> list[WatchStatus]:
    run = db.get(Run, run_id)
    if run is None or run.current_block < 0:
        return []
    ctx = RunContext.load(db, run)
    made_for = latest_forecasts(db, ctx, run, run.current_block)
    p50 = {code: f.p50[0] for (series, code), f in made_for.items() if series == "re_avail"}
    rows = {r.asset_id: r for r in db.scalars(select(AssetBlock).where(
        AssetBlock.run_id == run.id, AssetBlock.policy == "bob", AssetBlock.block == run.current_block))}
    out = []
    for row in configs.site_configs(db, site, None):
        c, asset = row["config"], row["asset"]
        if not c.current:
            continue
        for w in c.watch:
            target = configs.watched(db, asset, w)
            value = configs.watch_value(w["metric"], target, rows.get(target.id), p50) if target else None
            out.append(WatchStatus(asset=target.name if target else w["asset"], label=configs.watch_label(w), value=value,
                                   met=value is not None and configs.crossed(w["metric"], value, w["value"])))
    return out
