"""The site Live overview: latest settled block, forecasts and active events for one site."""

from collections import defaultdict
from datetime import datetime, timedelta

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.portfolio import Asset, Site
from app.models.run import AssetBlock, Cycle, Forecast, Plan, Run, WorldEvent
from app.schemas.runs import (
    Alert, BatteryCard, ChartPoint, FlowItem, GenerationCard, SiteLive, Weather,
)
from app.services.runs import BLOCK, IST, RunContext, sim_now

CHART_BLOCKS = 48  # 12 hours back and ahead
GENERATION = ("solar", "wind")


def _condition(cloud: float) -> str:
    if cloud < 0.2:
        return "Clear"
    if cloud < 0.5:
        return "Partly cloudy"
    return "Cloudy" if cloud < 0.85 else "Overcast"


def _hhmm(at: datetime) -> str:
    return at.astimezone(IST).strftime("%H:%M")


def _alert(event: WorldEvent, site: Site, node: str, line_nodes: dict[str, set[str]], now_sim: datetime) -> Alert | None:
    p = event.payload
    until = _hhmm(event.sim_at + timedelta(minutes=p.get("minutes", 0)))
    if event.kind == "price_spike":
        day = event.sim_at.astimezone(IST).date()
        end = datetime(day.year, day.month, day.day, tzinfo=IST) + timedelta(hours=p["to_hh"])
        if now_sim >= end:
            return None
        return Alert(severity="info", title="Evening price spike",
                     detail=f"Real-time prices ×{p['mult']} between {p['from_hh']:02d}:00 and {p['to_hh']:02d}:00.")
    if now_sim >= event.sim_at + timedelta(minutes=p.get("minutes", 0)):
        return None
    codes = {a.code: a.name for a in site.assets}
    if event.kind == "cloud_bank" and p["node"] == node:
        return Alert(severity="warning", title="Cloud bank over the site",
                     detail=f"Solar output down {p['depth']:.0%} until {until}.")
    if event.kind == "storm" and p["node"] == node:
        return Alert(severity="error", title="Storm over the site",
                     detail=f"Wind turbines cut out and solar falls sharply until {until}.")
    if event.kind == "wind_ramp" and p["node"] == node:
        return Alert(severity="warning", title="Wind speed change", detail=f"{p['delta_ms']:+} m/s until {until}.")
    if event.kind == "bess_trip" and p["asset"] in codes:
        return Alert(severity="error", title=f"{codes[p['asset']]} unavailable",
                     detail=f"Tripped; expected back at {until}.")
    if event.kind == "demand_surge" and codes.keys() & set(p["assets"]):
        return Alert(severity="warning", title="Demand change", detail=f"{p['pct']:+}% until {until}.")
    if event.kind == "line_derate" and node in line_nodes[p["line"]]:
        return Alert(severity="warning", title=f"{p['line']} derated",
                     detail=f"Corridor limit {p['limit_mw']:g} MW until {until}.")
    if event.kind == "frequency_dip":
        return Alert(severity="warning", title="Grid frequency excursion", detail=f"{p['hz']} Hz until {until}.")
    return None


def site_live(db: Session, run: Run, site: Site, now: datetime) -> SiteLive:
    b = run.current_block
    ctx = RunContext.load(db, run)
    node = next(a.node for a in ctx.assets if a.code == site.assets[0].code)
    truth = ctx.world()
    time_of = lambda block: run.sim_start_at + block * BLOCK  # noqa: E731

    assets = {a.id: a for a in site.assets}
    gen_ids = [a.id for a in site.assets if a.kind in GENERATION]
    capacity = sum(a.capacity_mw for a in site.assets if a.kind in GENERATION)
    rows = db.execute(
        select(AssetBlock).where(
            AssetBlock.run_id == run.id, AssetBlock.policy == "bob", AssetBlock.asset_id.in_(assets),
            AssetBlock.block.between(b - CHART_BLOCKS + 1, b),
        )
    ).scalars().all()
    gen = defaultdict(float)
    demand = defaultdict(float)
    latest = {}
    for r in rows:
        kind = assets[r.asset_id].kind
        if kind in GENERATION:
            gen[r.block] += r.actual_mw
        elif kind == "consumer":
            demand[r.block] += r.actual_mw
        if r.block == b:
            latest[r.asset_id] = r

    def site_forecast(issued: int) -> list[tuple[float, float, float]] | None:
        issues = db.scalars(select(Forecast).where(
            Forecast.run_id == run.id, Forecast.issued_block == issued, Forecast.asset_id.in_(gen_ids)
        )).all()
        if not issues:
            return None
        return [tuple(sum(getattr(f, q)[i] for f in issues) for q in ("p10", "p50", "p90"))
                for i in range(CHART_BLOCKS)]

    chart = [ChartPoint(group="Actual generation", time=time_of(k), value=round(v, 2)) for k, v in sorted(gen.items())]
    chart += [ChartPoint(group="Demand", time=time_of(k), value=round(v, 2)) for k, v in sorted(demand.items())]
    ahead = site_forecast(b) if gen_ids else None
    for i, (low, mid, high) in enumerate(ahead or []):
        chart.append(ChartPoint(group="Forecast", time=time_of(b + 1 + i), value=round(mid, 2),
                                low=round(low, 2), high=round(high, 2)))

    # BOB's plan for the coming blocks, from the latest cycle.
    battery_codes = [a.code for a in site.assets if a.kind == "bess"]
    latest_plan = db.scalar(
        select(Plan).join(Cycle)
        .where(Cycle.run_id == run.id, Cycle.block == b + 1, Plan.role == "selected")
        .order_by(Cycle.seq.desc()).limit(1)
    )
    if latest_plan and battery_codes:
        planned = np.sum([latest_plan.schedule["battery"][c] for c in battery_codes], axis=0)[:CHART_BLOCKS]
        chart += [ChartPoint(group="Planned battery", time=time_of(b + 1 + i), value=round(float(v), 2))
                  for i, v in enumerate(planned)]

    generation = None
    alerts = []
    if gen_ids:
        actual = gen[b]
        earlier = site_forecast(b - 4) if b >= 4 else None  # issued an hour before this block
        expected = earlier[3][1] if earlier else None
        generation = GenerationCard(actual_mw=round(actual, 2), forecast_mw=expected and round(expected, 2),
                                    capacity_mw=capacity)
        if expected is not None and actual < expected - max(2.0, 0.1 * capacity):
            alerts.append(Alert(severity="warning", title="Generation is below forecast",
                                detail=f"{expected - actual:.1f} MW below the forecast made an hour ago."))

    now_sim = sim_now(run, now)
    line_nodes = {line.code: {line.leaf, line.hub} for line in ctx.lines}
    for event in ctx.events:
        if event.fired_at is not None and (alert := _alert(event, site, node, line_nodes, now_sim)):
            alerts.append(alert)

    batteries = [
        BatteryCard(code=a.code, name=a.name, mw=round(latest[a.id].actual_mw, 2), soc_pct=round(latest[a.id].soc_mwh / a.params["energy_mwh"] * 100, 1),
                    energy_mwh=a.params["energy_mwh"], power_mw=a.capacity_mw,
                    available=latest[a.id].available_mw > 0)
        for a in site.assets if a.kind == "bess"
    ]
    by_kind = lambda kind: sum(latest[a.id].actual_mw for a in site.assets if a.kind == kind)  # noqa: E731
    has = lambda kind: any(a.kind == kind for a in site.assets)  # noqa: E731
    grid = by_kind("interconnection")
    discharge = max(by_kind("bess"), 0)
    supplied = gen[b] + discharge + max(grid, 0)
    used = demand[b] + max(-by_kind("bess"), 0)
    sources = [FlowItem(label="Generation", mw=gen[b])] if gen_ids else []
    if batteries:
        sources.append(FlowItem(label="Battery discharge", mw=discharge))
    if has("interconnection"):
        sources.append(FlowItem(label="Grid import", mw=max(grid, 0)))
    uses = [FlowItem(label="Local demand", mw=demand[b])] if has("consumer") else []
    if batteries:
        uses.append(FlowItem(label="Battery charging", mw=max(-by_kind("bess"), 0)))
    uses.append(FlowItem(label="Sent to the network", mw=max(supplied - used, 0)))

    cloud = float(truth.cloud[node][b])
    return SiteLive(
        sim_time=now_sim, as_of=time_of(b + 1), block=b,
        weather=Weather(
            condition=_condition(cloud), cloud_pct=round(cloud * 100), irradiance_wm2=round(float(truth.irradiance[node][b])),
            wind_ms=round(float(truth.wind_speed[node][b]), 1), temperature_c=round(float(truth.temperature[b]), 1),
            frequency_hz=round(float(truth.frequency[b]), 2),
        ),
        generation=generation, batteries=batteries,
        demand_mw=round(demand[b], 2) if has("consumer") else None,
        grid_mw=round(grid, 2) if has("interconnection") else None,
        alerts=alerts, chart=chart,
        sources=[FlowItem(label=f.label, mw=round(f.mw, 2)) for f in sources],
        uses=[FlowItem(label=f.label, mw=round(f.mw, 2)) for f in uses],
    )
