from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class PresetInfo(BaseModel):
    code: str
    name: str
    description: str


class RunCreate(BaseModel):
    preset: str


class RunState(BaseModel):
    id: int
    preset: str
    name: str
    status: str
    speed: float
    sim_time: datetime
    block: int
    total_blocks: int
    live: bool


class SpeedUpdate(BaseModel):
    speed: Literal[10, 30, 60]


Minutes = Annotated[int, Field(gt=0, le=24 * 60)]


class CloudBank(BaseModel):
    kind: Literal["cloud_bank"]
    node: str
    depth: float = Field(gt=0, le=1)
    minutes: Minutes


class WindRamp(BaseModel):
    kind: Literal["wind_ramp"]
    node: str
    delta_ms: float = Field(ge=-15, le=15)
    minutes: Minutes


class Storm(BaseModel):
    kind: Literal["storm"]
    node: str
    minutes: Minutes


class PriceSpike(BaseModel):
    kind: Literal["price_spike"]
    from_hh: int = Field(ge=0, le=23)
    to_hh: int = Field(ge=1, le=24)
    mult: float = Field(gt=0, le=5)
    reveal: bool = True


class BessTrip(BaseModel):
    kind: Literal["bess_trip"]
    asset: str
    minutes: Minutes


class LineDerate(BaseModel):
    kind: Literal["line_derate"]
    line: str
    limit_mw: float = Field(ge=0)
    minutes: Minutes


class DemandSurge(BaseModel):
    kind: Literal["demand_surge"]
    assets: list[str] = Field(min_length=1)
    pct: float = Field(ge=-50, le=50)
    minutes: Minutes


class FrequencyDip(BaseModel):
    kind: Literal["frequency_dip"]
    hz: float = Field(ge=49.5, le=50.5)
    minutes: Minutes


class ForecastUpdate(BaseModel):
    kind: Literal["forecast_update"]
    lookahead_h: float = Field(default=0, ge=0, le=24)


InjectEvent = Annotated[
    CloudBank | WindRamp | Storm | PriceSpike | BessTrip | LineDerate | DemandSurge | FrequencyDip | ForecastUpdate,
    Field(discriminator="kind"),
]


class Weather(BaseModel):
    condition: str
    cloud_pct: float
    irradiance_wm2: float
    wind_ms: float
    temperature_c: float
    frequency_hz: float


class GenerationCard(BaseModel):
    actual_mw: float
    forecast_mw: float | None
    capacity_mw: float


class BatteryCard(BaseModel):
    code: str
    name: str
    soc_pct: float
    energy_mwh: float
    power_mw: float
    available: bool


class Alert(BaseModel):
    severity: Literal["info", "warning", "error"]
    title: str
    detail: str


class ChartPoint(BaseModel):
    group: str
    time: datetime
    value: float
    low: float | None = None
    high: float | None = None


class FlowItem(BaseModel):
    label: str
    mw: float


class SiteLive(BaseModel):
    sim_time: datetime
    as_of: datetime  # end of the last settled block
    block: int
    weather: Weather
    generation: GenerationCard | None
    batteries: list[BatteryCard]
    demand_mw: float | None
    grid_mw: float | None
    alerts: list[Alert]
    chart: list[ChartPoint]
    sources: list[FlowItem]
    uses: list[FlowItem]
