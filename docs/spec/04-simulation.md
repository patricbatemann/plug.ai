# 04 — Simulated world and mock systems

```
 scenario (preset or edited) ── seed, regimes, events, maintenance calendar
        │
        ▼
 TRUTH generators: pure functions f(seed, block, regimes, fired world events)
   irradiance · wind speed · consumer load · DAM/RTM prices · frequency · emission factor
        │                                   │
        ▼                                   ▼
 OBSERVATIONS (what BOB sees)          FORECASTS (what BOB plans with)
   telemetry = truth + sensor noise      P50 = truth + error growing with lead time
                                         P10/P90 = P50 ∓ 1.28 σ(lead)
        │                                   │
        └──────────────► decision cycle ◄───┘
                               │ actions
                               ▼
 MOCK ADAPTERS (configurable fidelity): BMS · plant controller · RTM · consumer EMS · CMMS
                               │ acks + delivered quantities
                               ▼
 PLANT STEP (stateful): SOC, delivered DR, line flows, forced curtailment, exchange, deviation
                               │
                               ▼ asset_block / system_block / line_block for the block
```

Truth is a pure function of seed and block except for stateful pieces (battery SOC, delivered DR, shifted load), so the BOB run and its baseline twin see exactly the same weather, demand and prices. Nothing in the simulator needs memory between requests beyond the rows it writes.

## Demo portfolio (seeded)

The brief's portfolio (5 solar, 3 wind, 2 batteries, industrial consumers, grid interconnections) laid out as the screens' Andhra Pradesh sites. Capacities match the screens' portfolio cards: solar 320 MW, wind 180 MW, battery 100 MWh.

| Site (code) | Node | Assets |
| --- | --- | --- |
| Kuppam Solar Site (`KUP-SOLAR-001`) | `SOUTH` | `SOL-KUP` 45 MW; `BESS-01` Battery 1, 15 MW / 60 MWh |
| Nellore Solar Site (`NEL-SOLAR-002`) | `SOUTH` | `SOL-NEL` 55 MW |
| Chittoor Hybrid Site (`CHT-HYBRID-004`) | `SOUTH` | `SOL-CHT` 70 MW; `BESS-02` Battery 2, 10 MW / 40 MWh |
| Kadiri Solar Site (`KDR-SOLAR-005`) | `SOUTH` | `SOL-KDR` 105 MW |
| Madanapalle Solar Site (`MDP-SOLAR-006`) | `SOUTH` | `SOL-MDP` 45 MW |
| Tirupati Wind Site (`TIR-WIND-003`) | `NORTH` | `WND-TIR` 65 MW |
| Anantapur Wind Site (`ATP-WIND-007`) | `NORTH` | `WND-ATP` 60 MW; `IC-NORTH` import 20 / export 40 MW |
| Gooty Wind Site (`GTY-WIND-008`) | `NORTH` | `WND-GTY` 55 MW |
| Sri City Industrial Cluster (`SRC-IND-009`) | `HUB` | `IND-1` steel 70 MW (continuous), `IND-2` cement 35, `IND-3` textiles 25 (day shift), `IND-4` chemicals 45, `IND-5` data centre 20 (all critical), `IND-6` auto plant 30; `IC-HUB` import 250 / export 150 MW |

Lines (radial, so flows follow from node balances): `L-NORTH-HUB` 120 MW, `L-SOUTH-HUB` 260 MW. This gives net imports at night, surplus at midday, a north corridor that binds on windy afternoons, and curtailment pressure when solar peaks. Battery capacity is small relative to load (as in the screens), so battery decisions matter most at the evening peak; capacities are scenario parameters if the demo needs a larger effect.

## Truth generators

| Series | Model | Event hooks |
| --- | --- | --- |
| Solar availability | Clear-sky shape by hour (sunrise/sunset from `world.season`) × cloud factor (AR(1) on logit, regime `clear`/`mixed`/`overcast`) × capacity | `cloud_bank`: factor × (1 − depth) on plants at a node for a duration |
| Wind availability | Speed AR(1) around regime mean + diurnal term → power curve (cut-in 3, rated 12, cut-out 25 m/s) | `wind_ramp`: speed offset; `storm`: speed above cut-out → output 0 for the window |
| Consumer load | Segment profile (continuous, day shift, two shift) × (1 + AR noise) | `demand_surge`: +x % on listed consumers |
| DAM price | Daily shape: night ~₹3,500, solar trough ~₹2,500, evening peak ~₹9,000/MWh, capped at the exchange ceiling (`market.price_cap`, default ₹10,000/MWh — check current CERC cap) | — |
| RTM price | DAM × (1 + AR noise), capped | `price_spike`: × multiplier for blocks |
| Frequency | 50 Hz + AR noise (σ ≈ 0.03 Hz) | `frequency_dip`: to a value for blocks |
| Emission factor | ~0.71 tCO₂/MWh base (approximate CEA grid average), +10 % evening, −10 % midday (illustrative shape) | — |

Price, emission and frequency levels are configurable per scenario; defaults are illustrative, not market data.

## Forecasts

- Issued every block (intraday) for 96 blocks ahead; day-ahead issue at 10:00 sets `S^dam` for the next day at P50.
- Error `σ(h) = σ0 + σ1·√h` for lead `h` blocks, per series (scenario `world.noise`). Errors are drawn from the seed, so they are fixed for a run but unknown to BOB.
- A world event does not appear in forecasts until a `forecast_update` event reveals it, or it shows in telemetry. This is how "weather forecasts are updated" in the brief becomes a decision trigger.

## Plant step (end of each block)

1. Batteries: delivered = command × (1 − shortfall), 0 if tripped; SOC updated with efficiencies; clipped at limits (clipping raises an execution event).
2. Renewables: delivered = min(true availability, curtailment cap).
3. Consumers: true load − delivered DR (compliance factor drawn per call, default 0.8–1.0) ± shifted load.
4. Line flows from node balances; if a flow exceeds its true limit, the grid operator forces curtailment at the exporting node (event `forced_curtailment`).
5. Interconnection exchange = residual at each node; deviation = exchange − schedule; DSM charge and KPIs written to `system_block`.

## Mock adapters

| Adapter | Accepts | Fidelity knobs (per scenario) |
| --- | --- | --- |
| BMS | charge/discharge setpoints | rejection rate, delivery shortfall σ, trip events |
| Plant controller | curtailment caps | rejection rate |
| RTM | buy/sell bids for block `t0+G` (price-taker) | clearing ratio (default 1.0; partial clears possible) |
| Consumer EMS | DR calls, load shifts | compliance range, rejection rate |
| CMMS | maintenance moves, inspection work orders | acceptance, crew availability windows |

Each returns `{accepted, delivered, reason}`; rejections and shortfalls become `execution` events that can trigger re-planning.

## Scenario configuration

```json
{
  "code": "demo_story",
  "seed": 42,
  "start_at": "2026-11-12T05:30:00+05:30",
  "days": 1,
  "live_from": "10:45",
  "world": {
    "season": "post_monsoon",
    "solar_regime": "clear", "wind_regime": "moderate",
    "noise": {"re_avail": [0.03, 0.02], "load": [0.02, 0.01], "rtm_price": [0.05, 0.03]},
    "initial_soc_pct": {"BESS-01": 45, "BESS-02": 60},
    "adapters": {"bms": {"reject": 0.0, "shortfall_sd": 0.02}, "rtm": {"clear_ratio": 1.0}}
  },
  "events": [
    {"offset_min": 337, "kind": "cloud_bank", "payload": {"node": "SOUTH", "depth": 0.3, "minutes": 60}},
    {"offset_min": 337, "kind": "forecast_update", "payload": {"series": "re_avail"}},
    {"offset_min": 340, "kind": "price_spike", "payload": {"from_hh": 18, "to_hh": 22, "mult": 1.8}},
    {"offset_min": 342, "kind": "bess_trip", "payload": {"asset": "BESS-02", "minutes": 240}},
    {"offset_min": 344, "kind": "line_derate", "payload": {"line": "L-NORTH-HUB", "limit_mw": 70, "minutes": 120}},
    {"offset_min": 350, "kind": "document_publish", "payload": {"template": "storm_bulletin", "storm_at_offset_min": 540, "node": "NORTH"}}
  ],
  "maintenance": [
    {"asset": "WND-TIR", "kind": "preventive", "duration_blocks": 16, "earliest": "10:00", "deadline": "+3d", "scheduled": "14:00", "safety_critical": false}
  ]
}
```

## Presets

| Preset | What it shows |
| --- | --- |
| `calm_day` | Baseline economics; battery arbitrage vs the fixed clock |
| `demo_story` | The judged story (solution doc), all events in one morning |
| `storm_day` | 11:30 a storm bulletin is published (toast); BOB knows of the 14:30–17:30 north storm only once it is uploaded. Tirupati wind maintenance calendared 14:00 (inside the storm) is moved; Gooty wind keeps 60 % output after the storm, which brings an inspection proposal. |
| `evening_spike` | Delay-selling and storage valuation under the economic profile |
| `congestion` | Windy afternoon, corridor binding, curtailment as last resort, grid-support profile |

`live_from` sets when the clock starts pacing: blocks before it run back to back (BOB disabled), so a demo opens at 10:45 with a realistic battery state and history instead of waiting through the morning.

Presets are seed data; the Simulation page picks one and its seed count. Operators can also inject any event live from the header's Inject event menu; injected events are stored as `world_event` with `source = operator`.

## Sample documents

`server/app/sim/documents/` holds templates rendered with event parameters into text and PDF, plus a few pre-made images (a photographed notice, a screenshot of an email). All are marked "Simulated sample", use invented agency names and carry no real logos or letterheads.
