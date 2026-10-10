from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


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
    mode: str
    mode_by: str
    bob_online: bool  # the model is configured and switched on; otherwise rules decide
    lagging: bool  # running, but the clock is overdue: no worker is advancing it


class ActivityOut(BaseModel):
    at: datetime
    category: str
    title: str | None
    detail: str
    by: str | None
    kind: str | None
    mw: float | None
    status: str | None
    asset: str | None


class CsvCheck(BaseModel):
    rows: int
    columns: list[dict]
    preview: list[list[str]]
    problems: list[str]


class CsvUpload(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    data: str = Field(max_length=7_000_000)  # base64, 5 MB


class ApiSource(BaseModel):
    endpoint: str = Field(max_length=300)
    refresh_min: int = Field(ge=1, le=60)


class DataSourceOut(BaseModel):
    id: int
    kind: str
    name: str
    rows: int | None
    columns: list[dict]
    refresh_min: int | None
    created_by: str
    created_at: datetime


class ChatAsk(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    context: str | None = Field(default=None, max_length=300)  # what the operator is looking at


class DataConnect(BaseModel):
    """The client's API data-source form. The key is neither stored nor used: the simulator answers."""
    site_id: str = Field(alias="siteId", max_length=40)
    endpoint: str = Field(max_length=300)
    refresh_min: int | None = Field(default=None, alias="refreshIntervalMin", ge=1, le=60)


class ChatItem(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    text: str
    cards: list[dict]


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
    mw: float  # + discharge, − charge, in the last settled block
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
    bob_now: list[str]  # what BOB is doing at the site in the block in progress
    connected: bool  # BOB commands the site's assets only while its telemetry API is connected
    replanned: str | None  # BOB's latest re-plan on news (an event, a watch hit, a surprise in the feed): when and why
    chart: list[ChartPoint]
    sources: list[FlowItem]
    uses: list[FlowItem]


class SiteStatus(BaseModel):
    code: str
    output_mw: float | None
    forecast_mw: float | None
    storage_pct: float | None
    battery_mw: float | None  # + discharging, - charging
    net_mw: float  # + sent to the network, - drawn from it
    status: Literal["Normal", "Below forecast", "Battery unavailable"]
    bob_now: list[str]
    pending: int


class PolicyTotals(BaseModel):
    cost_inr: float
    market_inr: float
    dsm_inr: float
    dr_inr: float
    wear_inr: float
    curtail_inr: float
    curtailed_mwh: float
    carbon_t: float
    deviation_mwh: float
    unserved_mwh: float


class RunSummary(BaseModel):
    block: int
    bob: PolicyTotals
    baseline: PolicyTotals
    saving_inr: float
    actions: int  # BOB's actions, less those replaced before they took effect
    by_people: int  # of those, the ones a person approved or declined


class ActionOut(BaseModel):
    id: int
    block: int
    time: datetime
    cycle_id: int | None
    tier: str
    deadline_at: datetime | None
    decided_by: str | None
    kind: str
    site: str | None
    asset: str | None
    mw: float
    delivered_mw: float | None
    actual_mw: float | None
    status: str
    reason: str | None


class SignalOut(BaseModel):
    code: str
    label: str
    value: str
    threshold: str
    material: bool
    mode: str


class StressResult(BaseModel):
    regret_inr: float | None
    holds: bool
    reserve_shortfall_mwh: float | None


class OptionOut(BaseModel):
    variant: str
    label: str
    chosen: bool
    actions: list[str]
    cost_inr: float
    carbon_t: float
    curtailed_mwh: float
    deviation_mwh: float
    worst_regret_inr: float | None
    stress: dict[str, StressResult]


class DecisionSummary(BaseModel):
    id: int
    time: datetime
    mode: str
    mode_by: str
    mode_reason: str
    chosen: str | None
    selected_by: str
    agent: str | None  # how BOB's turn ended, when it was asked
    rationale: str
    holds: int
    tests: int


class DecisionDetail(DecisionSummary):
    trigger: str
    trigger_detail: str
    floors: list[str]
    situation: list[SignalOut]
    scenarios: dict[str, str]
    options: list[OptionOut]


class EventOut(BaseModel):
    id: int
    kind: str
    sim_at: datetime
    source: str
    label: str


class DocumentUpload(BaseModel):
    """A sample by name, or a file as base64."""

    sample: str | None = None
    filename: str = Field(default="", max_length=200)
    data: str = Field(default="", max_length=7_000_000)  # 5 MB as base64

    @model_validator(mode="after")
    def one_source(self) -> "DocumentUpload":
        if not self.sample and not (self.filename and self.data):
            raise ValueError("Send a sample name, or a filename with its data")
        return self


class SampleOut(BaseModel):
    name: str
    title: str


class TaskOut(BaseModel):
    id: int
    asset: str
    kind: str
    hours: float
    earliest_at: datetime
    deadline_at: datetime
    calendar_at: datetime
    scheduled_at: datetime
    safety_critical: bool
    status: Literal["planned", "in progress", "done"]


class MaintenanceOut(BaseModel):
    tasks: list[TaskOut]
    proposals: list[ActionOut]


class StudyCreate(BaseModel):
    preset: str
    seeds: int = Field(ge=1, le=20)


class SeedResult(BaseModel):
    seed: int
    progress: float
    done: bool
    bob: PolicyTotals | None = None
    baseline: PolicyTotals | None = None
    saving_inr: float | None = None
    violations: list[str] = []


class Reliability(BaseModel):
    replays_done: int
    hard_limit_violations: int
    unserved_mwh: dict[str, float]
    safe_holds: int
    approvals_expired: int


class StudyOut(BaseModel):
    id: int
    preset: str
    created_at: datetime
    created_by: str
    seeds: list[SeedResult]
    metrics: dict[str, str]
    reliability: Reliability


class StudyItem(BaseModel):
    id: int
    preset: str
    seeds: int
    created_at: datetime


class BobCalls(BaseModel):
    calls: int
    ok: int
    by_purpose: dict[str, int]
    failures: dict[str, int]
    median_ms: int | None
