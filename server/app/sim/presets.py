"""Scenario presets. A run stores a copy of its preset, so later edits never change past runs."""

from typing import Any

BASE: dict[str, Any] = {
    "seed": 42,
    "date": "2026-11-12",
    "start": "05:30",
    "days": 1,
    "live_from": "10:45",
    "speed": 30,
    "weather": {"cloud_mean": 0.15, "wind_mean_ms": 8.5},
    # [base, growth per sqrt(hour)] of forecast error, as a fraction of capacity or value.
    "noise": {"re_avail": [0.03, 0.03], "load": [0.02, 0.01], "price": [0.05, 0.04]},
    "initial_soc_pct": {"BESS-01": 45, "BESS-02": 60},
    # Events reach forecasts only when revealed: `"reveal": True` on the event, or a later
    # forecast_update (which reveals fired events, plus those within its `lookahead_h`).
    "events": [],
    # Planned jobs: asset, kind, duration, the window it must fit and the calendared start (HH:MM).
    "maintenance": [],
}


def preset(name: str, description: str, **overrides: Any) -> dict[str, Any]:
    return {**BASE, "name": name, "description": description, **overrides}


PRESETS: dict[str, dict[str, Any]] = {
    "calm_day": preset(
        "Calm day",
        "Clear skies, moderate wind, normal prices.",
    ),
    "demo_story": preset(
        "Demo story",
        "Cloud bank over the south, evening price spike, Battery 2 trip, north corridor derate.",
        events=[
            {"at": "11:07", "kind": "cloud_bank", "payload": {"node": "SOUTH", "depth": 0.3, "minutes": 60}},
            {"at": "11:07", "kind": "forecast_update", "payload": {}},
            {"at": "11:10", "kind": "price_spike", "payload": {"from_hh": 18, "to_hh": 22, "mult": 1.5, "reveal": True}},
            {"at": "11:12", "kind": "bess_trip", "payload": {"asset": "BESS-02", "minutes": 240}},
            {"at": "11:14", "kind": "line_derate", "payload": {"line": "L-NORTH-HUB", "limit_mw": 70, "minutes": 120}},
        ],
    ),
    "evening_spike": preset(
        "Evening spike",
        "Real-time prices rise 50 % between 18:00 and 22:00.",
        events=[
            {"at": "12:00", "kind": "price_spike", "payload": {"from_hh": 18, "to_hh": 22, "mult": 1.5, "reveal": True}},
        ],
    ),
    "congestion": preset(
        "Congestion",
        "A windy afternoon pushes the north corridor to its limit.",
        weather={"cloud_mean": 0.1, "wind_mean_ms": 11.0},
        events=[
            {"at": "13:00", "kind": "line_derate", "payload": {"line": "L-NORTH-HUB", "limit_mw": 80, "minutes": 240}},
        ],
    ),
    "storm_day": preset(
        "Storm day",
        "A bulletin warns of an afternoon storm over the north wind sites, where maintenance is calendared.",
        weather={"cloud_mean": 0.35, "wind_mean_ms": 9.0},
        events=[
            # BOB learns of the storm only from the bulletin, once an operator uploads it.
            {"at": "11:30", "kind": "document_publish",
             "payload": {"document": "storm_bulletin.pdf", "title": "Storm bulletin"}},
            {"at": "14:30", "kind": "storm", "payload": {"node": "NORTH", "minutes": 180,
                                                         "after_pct": {"WND-GTY": 60}}},
        ],
        maintenance=[{"asset": "WND-TIR", "kind": "preventive", "duration_blocks": 16, "earliest": "10:00",
                      "deadline": "23:45", "at": "14:00", "safety_critical": False}],
    ),
}
