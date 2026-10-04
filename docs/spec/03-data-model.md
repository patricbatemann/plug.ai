# 03 — Data model

```
 CONFIG (rarely changes)               RUN (one simulated day or rollout)          DECISIONS (append-mostly)
 ───────────────────────               ─────────────────────────────────          ─────────────────────────
 portfolio ─┬─ site ─── asset ─┐      scenario ──► run ─┬─ world_event (truth)     cycle ─┬─ plan
            ├─ node ───────────┘                         ├─ constraint (knowledge)        └─ action ── audit_log
            └─ line                                      ├─ asset_block   ┐                 
 site ─── action_config (versioned)                      ├─ system_block  ├ time series    document ──► constraint
 profile (versioned)                                     ├─ line_block    ┘               agent_call
 user                                                    ├─ forecast (arrays)             chat_message
                                                         ├─ maintenance_task              job
                                                         └─ event ──► cycle
```

Two separations drive the design:

- **Truth vs knowledge.** `world_event` changes what really happens in the simulator. `constraint` is what the agent knows (from documents, operators or detected events). A storm can be real before BOB knows about it.
- **Hot arrays vs rows.** Data always read and written whole (a forecast curve, a plan schedule) is stored as arrays or JSONB in one row. Data queried by block or asset (telemetry) is stored as narrow rows.

All timestamps are `timestamptz` in UTC; the UI shows IST (`portfolio.tz = 'Asia/Kolkata'`). Blocks are integers counted from `run.sim_start_at`.

## Config

| Table | Columns | Notes |
| --- | --- | --- |
| `user` | existing | Add `role` (`operator`, `admin`). |
| `portfolio` | `id`, `name`, `tz`, `mode_code`, `market jsonb`, `protected jsonb` | `mode_code`: the operator's default operating mode (a `profile.code`). `market`: `gate_blocks`, `band_pct`, `band_mw`, `dsm_alpha`, `dsm_beta`, `dsm_beyond_mult`, `price_cap`, `carbon_shadow_default`. `protected`: organisation limits no configuration can loosen, e.g. `min_reserve_pct` 30, `approval_above_mw` 6 (seed data, shown as locked in the wizard). |
| `site` | `id`, `portfolio_id`, `code`, `name`, `kind`, `location`, `commissioned_on` | What the screens are organised around (e.g. `KUP-SOLAR-001`, Kuppam Solar Site). `kind` ∈ `solar`, `wind`, `hybrid`, `industrial`. Unique `(portfolio_id, code)`. |
| `node` | `id`, `portfolio_id`, `code`, `name` | Unique `(portfolio_id, code)`. |
| `line` | `id`, `portfolio_id`, `code`, `from_node_id`, `to_node_id`, `limit_mw` | Base limit; derates arrive as constraints or world events. |
| `asset` | `id`, `portfolio_id`, `site_id`, `node_id`, `code`, `kind`, `name`, `capacity_mw`, `params jsonb`, `active` | One table for all kinds. `kind` ∈ `solar`, `wind`, `bess`, `consumer`, `interconnection`. `params` validated on write by a Pydantic model per kind (below). Unique `(portfolio_id, code)`. |
| `profile` | `id`, `code`, `version`, `name`, `params jsonb`, `current bool` | Unique `(code, version)`; partial unique index on `code where current`. Edits create a new version. |
| `action_config` | `id`, `site_id`, `asset_id`, `kind`, `name`, `status`, `version`, `current bool`, `autonomy`, `limits jsonb`, `approval jsonb`, `watch jsonb`, `recovery jsonb`, `notify jsonb`, `tests jsonb`, `created_by`, `activated_by`, `activated_at` | One configured action from the setup wizard (BOB's mandate for that asset and action). `kind` ∈ `battery_discharge`, `battery_charge`, `grid_import`, `grid_export`, `curtail`, `demand_response`, `load_shift`, `maintenance`. `status` ∈ `draft`, `testing`, `active`, `paused`. `autonomy` ∈ `recommend`, `approval`, `auto`. `limits`: `auto_max_mw`, `max_mw`, `max_energy_mwh`, `max_duration_min`, `cooldown_min`, `max_per_day`, `reserve_pct`, `min_price_inr_mwh`. `approval`: exception list, approver, response minutes, escalation. `watch`: list of `{metric, op, value, for_min}`. `tests`: last scenario results. Saving validates against `portfolio.protected`. Edits create a new version; partial unique index on `(asset_id, kind) where current`. |

`asset.params` by kind:

| Kind | Fields |
| --- | --- |
| `solar`, `wind` | `curtailable`, `curtail_comp_inr_mwh` (κ: PPA tariff for contracted plants, 0 for owned); wind: `cut_in`, `rated`, `cut_out` (m/s). Weather events target an asset's node. |
| `bess` | `energy_mwh`, `p_max_mw`, `eta_c`, `eta_d`, `soc_min_pct`, `soc_max_pct`, `cycles_per_day`, `deg_cost_inr_mwh` |
| `consumer` | `segment`, `critical_mw`, `dr_max_mw`, `dr_notice_blocks`, `dr_energy_mwh_day`, `dr_incentive_inr_mwh`, `shift_max_mw`, `shift_window` (`[start_hh, end_hh]`), `shift_cost_inr_mwh` |
| `interconnection` | `import_max_mw`, `export_max_mw` |

Why one asset table: the optimiser reads all assets of a portfolio in one query, and five kind-specific tables would add joins without adding queries anyone runs. The trade-off (no DB-level checks on params) is covered by Pydantic validation on every write path.

## Scenario and run

| Table | Columns | Notes |
| --- | --- | --- |
| `scenario` | *(not built in P1)* | Presets live in code (`app/sim/presets.py`); each run stores a copy of its preset in `run.config`. A table is added only if presets become editable. |
| `run` | `id`, `portfolio_id`, `scenario_id`, `kind`, `status`, `config jsonb`, `sim_start_at`, `speed`, `current_block`, `block_started_at`, `next_due_at`, `profile_code`, `agent_enabled`, `twin_run_id`, `results jsonb`, `created_by`, `created_at` | `kind` ∈ `live`, `baseline`, `rollout`. A live run gets a `baseline` twin on the same seed. `status` ∈ `ready`, `running`, `paused`, `done`, `failed`. `results` holds rollout summaries. Index `(status, next_due_at)` for the clock claim. |
| `world_event` | `id`, `run_id`, `sim_at`, `kind`, `payload jsonb`, `document_id`, `source`, `fired_at` | Copied from the scenario at run start, plus operator injections. Index `(run_id, fired_at, sim_at)`. |
| `run_constraint` | `id`, `run_id`, `document_id`, `kind`, `targets jsonb`, `start_at`, `end_at`, `value`, `quote`, `confidence`, `verified`, `tightens`, `status`, `note`, `decided_by`, `decided_at` | Named to avoid the SQL keyword. `status` ∈ `pending`, `active`, `rejected`, `withdrawn`; expiry is by window. BOB's inputs read `active` rows, alongside fired events and its own maintenance schedule (`services/dispatch.py::knowledge`). |
| `maintenance_task` | `id`, `run_id`, `asset_id`, `kind`, `duration_blocks`, `earliest_at`, `deadline_at`, `safety_critical`, `scheduled_start_at`, `status`, `source`, `work_order_ref` | Copied from the scenario at run start. |

## Time series

| Table | Primary key | Columns | Volume (live day) |
| --- | --- | --- | --- |
| `asset_block` | `(run_id, policy, block, asset_id)` | `available_mw`, `setpoint_mw`, `actual_mw`, `soc_mwh`, `scheduled_mw` (`real`, nullable by kind) | 96 × 18 assets ≈ 1.7k rows |
| `system_block` | `(run_id, policy, block)` | `frequency_hz`, `dam_price`, `rtm_price`, `emission_factor`, `schedule_mw`, `net_exchange_mw`, `deviation_mw`, `dsm_inr`, `cost_inr`, `carbon_t`, `curtailed_mwh`, `unserved_mwh` | 96 rows |
| `line_block` | `(run_id, policy, block, line_id)` | `limit_mw`, `flow_mw` | 192 rows |
| `forecast` | `id`; index `(run_id, series, asset_id, issued_block desc)` | `run_id`, `issued_block`, `series`, `asset_id` (null for system series), `start_block`, `p10 real[]`, `p50 real[]`, `p90 real[]` | ~25 series × 96 issues ≈ 2.4k rows of 3 × 96 floats |

`policy` ∈ `bob`, `baseline`: every run is settled twice on the same world, once with BOB's actions and once with today's practice (replaces the separate baseline twin run). `series` ∈ `re_avail`, `load`, `rtm_price`, `dam_price`. Telemetry rows are written by the plant step; KPI columns on `system_block` make the portfolio and site running totals a single `SUM`.

## Decisions

| Table | Columns | Notes |
| --- | --- | --- |
| `event` | `id`, `run_id`, `block`, `sim_at`, `kind`, `severity`, `source`, `asset_id`, `payload jsonb`, `material`, `cycle_id` | Detected by `state/` (`telemetry`, `forecast`, `execution`, `document`, `operator`). |
| `cycle` | `id`, `run_id`, `block`, `seq`, `trigger`, `event_id`, `situation jsonb`, `profile_code`, `profile_version`, `profile_by`, `params jsonb`, `scenarios jsonb`, `regret jsonb`, `selected_plan_id`, `selected_by`, `rationale`, `status`, `timings jsonb`, `created_at` | Unique `(run_id, block, seq)`. `trigger` ∈ `tick`, `event`, `whatif`. `*_by` ∈ `bob`, `rule`. `regret` = K × S matrix. |
| `plan` | `id`, `cycle_id`, `variant`, `role`, `kpis jsonb`, `schedule jsonb`, `solver jsonb` | `role` ∈ `candidate`, `selected`, `fallback`. `schedule` is columnar: `{asset_code: {setpoint: [...], soc: [...]}, market: {rtm_buy: [...], rtm_sell: [...], schedule: [...]}, lines: {...}}`, ~20 KB, read whole by the chart. |
| `action` | `id`, `run_id`, `cycle_id`, `plan_id`, `block`, `kind`, `asset_id`, `mw`, `params jsonb`, `action_config_id`, `tier`, `status`, `idempotency_key`, `deadline_at`, `fallback_action_id`, `decided_by`, `decided_at`, `note`, `sent_at`, `ack jsonb`, `actual_mw`, `verified_at` | Unique `idempotency_key`. Index `(run_id, status)` for the approvals inbox. Replaces the baseline document's separate ApprovalRequest and ExecutionRecord: one row follows the action from proposal to verification. |
| `document` | `id`, `run_id`, `filename`, `mime`, `content bytea`, `sha256`, `uploaded_by`, `status`, `extraction jsonb`, `created_at` | Files are small; bytea keeps them in the one durable store every replica sees. |
| `agent_call` | `id`, `run_id`, `cycle_id`, `purpose`, `deployment`, `input_tokens`, `output_tokens`, `cached_tokens`, `latency_ms`, `tool_calls`, `outcome`, `error` | `purpose` ∈ `cycle`, `extract`, `chat`. |
| `chat_message` | `id`, `run_id`, `user_id`, `role`, `content jsonb`, `created_at` | `{message, text?, cards?}`: the Chat Completions message replayed as is, the operator's own text, and the cards shown with an answer. A failed turn stores only an apology, so replay never breaks. `cycle.selected_by` records who chose the option. |
| `audit_log` | `id bigserial`, `at`, `run_id`, `actor`, `verb`, `entity`, `entity_id`, `detail jsonb` | Append-only (a trigger rejects UPDATE and DELETE). Also the UI's live feed cursor. |
| `job` | `id`, `kind`, `run_id`, `payload jsonb`, `status`, `attempts`, `run_after`, `locked_until`, `locked_by`, `error`, `dedup_key`, `created_at` | `kind` ∈ `rollout_seed`, `extract_document`, `whatif`. Unique `dedup_key`. |

### Enumerations

| Enum | Values |
| --- | --- |
| `action.kind` | `bess_charge`, `bess_discharge`, `reserve_hold`, `rtm_buy`, `rtm_sell`, `curtail`, `dr_call`, `load_shift`, `maintenance_schedule`, `maintenance_delay`, `inspection_dispatch` |
| `action.tier` | `auto`, `approval`, `recommend`, `prohibited` (derived from the asset's active `action_config` and `portfolio.protected`) |
| `action.status` | `proposed` → `awaiting_approval` → `approved` / `rejected` / `expired`; `approved` or `auto` → `sent` → `acked` / `failed` → `verified` |
| `world_event.kind` | `cloud_bank`, `wind_ramp`, `storm`, `price_spike`, `bess_trip`, `bess_restore`, `line_derate`, `demand_surge`, `frequency_dip`, `forecast_update`, `document_publish`, `maintenance_notice` |

## Volumes and retention

A live run day writes ~5k telemetry rows, ~2.4k forecast rows, ~100–150 cycles, ~600 plans (~12 MB of JSONB) and ~1–2k actions. Rollouts store only `run.results`. No partitioning or TimescaleDB is needed at this scale; `DELETE FROM run` cascades for cleanup.

## Migration from the starter

- Replace `init_db()`/`create_all` with Alembic (`alembic upgrade head` at deploy; tests use the same migrations against a throwaway Postgres database).
- Keep `users`; add `role`.
- SQLite support is dropped (arrays, JSONB, `SKIP LOCKED`).
