"""Objective profiles. P2 runs balanced only; the others arrive with situation-based switching."""

BALANCED = {
    "reserve_share": 0.20,  # up-reserve held, as a share of total battery power
    "reserve_hours": 1.0,  # the reserve must be sustainable for this long
    "soc_floor_pct": 20.0,
    "lambda_carbon": 2000.0,  # ₹ per tCO2 imported
    "lambda_curtail": 1500.0,  # ₹ per MWh curtailed
    "lambda_wear": 500.0,  # ₹ per MWh discharged, on top of degradation cost
    "lambda_deviation": 500.0,  # ₹ per MWh away from schedule
}

VOLL = 20_000.0  # ₹/MWh of non-critical load unserved
VOLL_CRITICAL = 100_000.0
VALUE_OF_RESERVE = 5_000.0  # ₹/MWh of reserve shortfall
