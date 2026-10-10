from typing import Any, Literal

from pydantic import BaseModel, Field


class WatchCondition(BaseModel):
    metric: Literal["soc_below_pct", "output_below_forecast_mw", "demand_above_mw"]
    value: float
    asset: str | None = None  # the asset whose reading it follows; none means the action's own asset


class Preferences(BaseModel):
    """Kept with the configuration and shown to people; nothing in dispatch acts on them."""
    objective: Literal["reliability", "cost", "peak", "renewable"] = "reliability"
    recovery: Literal["notify_and_hold", "request_import"] = "notify_and_hold"
    notify: list[Literal["sms", "email", "push", "slack"]] = []


class ConfigValues(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    autonomy: Literal["auto", "approval", "recommend"]
    limits: dict[str, float]
    approval: dict[str, Any]
    watch: list[WatchCondition] = []
    preferences: Preferences = Preferences()


class ConfigDraft(ConfigValues):
    asset: str
    kind: str


class ConfigOut(ConfigValues):
    id: int
    asset: str
    asset_name: str
    kind: str
    status: str
    version: int
    current: bool
    tests: dict[str, Any]
    actions_today: int
    active: ConfigValues | None = None  # the version in force, for the change review


class StatusUpdate(BaseModel):
    status: Literal["active", "paused"]


class AssetOption(BaseModel):
    code: str
    name: str
    kind: str
    capacity_mw: float
    actions: list[str]
    watch_metric: str | None
    watch_label: str | None


class ConfigOptions(BaseModel):
    assets: list[AssetOption]
    limits: dict[str, list[str]]  # the limits each kind of action takes
    protected: dict[str, Any]


class WatchStatus(BaseModel):
    asset: str
    label: str
    value: float | None
    met: bool
