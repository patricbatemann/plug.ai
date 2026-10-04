from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Params(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SolarParams(Params):
    curtailable: bool
    curtail_comp_inr_mwh: float = Field(ge=0)


class WindParams(SolarParams):
    cut_in: float = Field(gt=0)
    rated: float
    cut_out: float

    @model_validator(mode="after")
    def check_power_curve(self) -> "WindParams":
        if not self.cut_in < self.rated < self.cut_out:
            raise ValueError("wind speeds must satisfy cut_in < rated < cut_out")
        return self


class BessParams(Params):
    energy_mwh: float = Field(gt=0)
    p_max_mw: float = Field(gt=0)
    eta_c: float = Field(gt=0, le=1)
    eta_d: float = Field(gt=0, le=1)
    soc_min_pct: float = Field(ge=0, le=100)
    soc_max_pct: float = Field(ge=0, le=100)
    cycles_per_day: float = Field(gt=0)
    deg_cost_inr_mwh: float = Field(ge=0)

    @model_validator(mode="after")
    def check_soc_window(self) -> "BessParams":
        if self.soc_min_pct >= self.soc_max_pct:
            raise ValueError("soc_min_pct must be below soc_max_pct")
        return self


class ConsumerParams(Params):
    segment: str
    critical_mw: float = Field(ge=0)
    dr_max_mw: float = Field(ge=0)
    dr_notice_blocks: int = Field(ge=0)
    dr_energy_mwh_day: float = Field(ge=0)
    dr_incentive_inr_mwh: float = Field(ge=0)
    shift_max_mw: float = Field(ge=0)
    shift_window: tuple[int, int] | None = None
    shift_cost_inr_mwh: float = Field(ge=0)

    @model_validator(mode="after")
    def check_shift_window(self) -> "ConsumerParams":
        if self.shift_max_mw > 0:
            if self.shift_window is None:
                raise ValueError("shift_window is required when shift_max_mw > 0")
            start, end = self.shift_window
            if not 0 <= start < end <= 24:
                raise ValueError("shift_window must be [start_hh, end_hh] within one day")
        return self


class InterconnectionParams(Params):
    import_max_mw: float = Field(ge=0)
    export_max_mw: float = Field(ge=0)


PARAMS_BY_KIND: dict[str, type[Params]] = {
    "solar": SolarParams,
    "wind": WindParams,
    "bess": BessParams,
    "consumer": ConsumerParams,
    "interconnection": InterconnectionParams,
}


def validate_params(kind: str, params: dict[str, Any]) -> dict[str, Any]:
    return PARAMS_BY_KIND[kind].model_validate(params).model_dump()


class PortfolioTotals(BaseModel):
    solar_mw: float
    wind_mw: float
    battery_mw: float
    battery_mwh: float
    demand_mw: float


class SiteSummary(BaseModel):
    code: str
    name: str
    kind: str
    location: str
    generation_mw: float
    battery_mwh: float
    asset_kinds: list[str]


class PortfolioResponse(BaseModel):
    name: str
    tz: str
    mode_code: str
    totals: PortfolioTotals
    sites: list[SiteSummary]


class AssetResponse(BaseModel):
    code: str
    name: str
    kind: str
    capacity_mw: float
    params: dict[str, Any]
    active: bool

    model_config = ConfigDict(from_attributes=True)


class SiteDetail(BaseModel):
    code: str
    name: str
    kind: str
    location: str
    commissioned_on: date
    mode_code: str
    assets: list[AssetResponse]
