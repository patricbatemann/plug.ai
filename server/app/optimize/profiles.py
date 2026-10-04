"""Objective profiles, the option variants built around them, and the reliability prices."""

BALANCED = {
    "reserve_share": 0.20,  # up-reserve held, as a share of total battery power
    "reserve_hours": 1.0,  # the reserve must be sustainable for this long
    "soc_floor_pct": 20.0,
    "lambda_carbon": 2000.0,  # ₹ per tCO2 imported
    "lambda_curtail": 1500.0,  # ₹ per MWh curtailed
    "lambda_wear": 500.0,  # ₹ per MWh discharged, on top of degradation cost
    "lambda_deviation": 500.0,  # ₹ per MWh away from schedule
    "rtm_sell_cap_share": 1.0,  # share of export capacity the plan may sell in the RTM
}

PROFILES = {
    "balanced": BALANCED,
    "economic": {**BALANCED, "reserve_share": 0.10, "soc_floor_pct": 15.0, "lambda_carbon": 1000.0,
                 "lambda_curtail": 1000.0, "lambda_wear": 300.0, "lambda_deviation": 300.0},
    "clean": {**BALANCED, "lambda_carbon": 4000.0, "lambda_curtail": 5000.0},
    "resilience": {**BALANCED, "reserve_share": 0.60, "soc_floor_pct": 50.0, "lambda_wear": 300.0,
                   "lambda_deviation": 1500.0, "rtm_sell_cap_share": 0.5},
    "grid_support": {**BALANCED, "reserve_share": 0.40, "soc_floor_pct": 30.0, "lambda_deviation": 3000.0},
}

# Options built around the chosen profile: how each changes its parameters.
VARIANTS = {
    "profile": {},
    "cost": {"scale": ("lambda_carbon", "lambda_curtail", "lambda_wear", "lambda_deviation"), "by": 0.25},
    "clean": {"scale": ("lambda_carbon", "lambda_curtail"), "by": 4.0},
    "preserve": {"scale": ("lambda_wear",), "by": 4.0},
    "secure": {"scale": ("reserve_share",), "by": 1.5},
}
VARIANT_LABELS = {
    "profile": "As the mode intends",
    "cost": "Lowest cost",
    "clean": "Cleanest",
    "preserve": "Preserve batteries",
    "secure": "Extra reserve",
}


def variant(params: dict, name: str) -> dict:
    change = VARIANTS[name]
    out = dict(params)
    for key in change.get("scale", ()):
        out[key] = params[key] * change["by"]
    out["reserve_share"] = min(out["reserve_share"], 1.0)
    return out


# Far above any market price (cap ₹10,000/MWh, ×2 in stress tests, ×1.5 beyond the band),
# so no single-stage solve ever prefers shedding load to buying power.
VOLL = 100_000.0  # ₹/MWh of non-critical load unserved
VOLL_CRITICAL = 500_000.0
VALUE_OF_RESERVE = 5_000.0  # ₹/MWh of reserve shortfall
