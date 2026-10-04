# 00 — Runtime architecture

```
 ┌──────────────────────── web (React + Vite + TS) ─────────────────────────┐
 │ Portfolio · Sites (Live overview, AI Actions, Maintenance, Activity log) │
 │ Actions + Decision panel · Configure BOB + wizard · Simulation · Ask BOB │
 └───────────────▲─────────────────────────────────┬────────────────────────┘
      poll /feed?after=<seq> (2 s)                 │ REST (JWT bearer)
 ┌───────────────┴─────────────────────────────────▼────────────────────────┐
 │ api — FastAPI, N stateless replicas                                       │
 │ reads/writes Postgres only; never runs a cycle in the request path        │
 └───────────────┬──────────────────────────────────────────────────────────┘
                 │ SQL
 ┌───────────────▼──────────────────────────────────────────────────────────┐
 │ PostgreSQL 16 — the only stateful component                               │
 │ config · run clock · time series · decisions · actions · audit · jobs     │
 │ (FOR UPDATE SKIP LOCKED) · uploaded documents (bytea)                     │
 └───────────────▲──────────────────────────────────────────────────────────┘
                 │ claim due runs / jobs
 ┌───────────────┴──────────────────────────────────────────────────────────┐
 │ worker — `python -m app.worker`, N replicas                               │
 │ advance block: settle → observe → detect → cycle → govern → execute       │
 │ jobs: rollout seeds · document extraction · what-if                       │
 │   ├─ HiGHS (highspy, in-process, ProcessPool for scenario solves)         │
 │   └─ Azure OpenAI (BOB) — optional; every call has a rule fallback         │
 └──────────────────────────────────────────────────────────────────────────┘
```

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| API | FastAPI (existing), Pydantic v2 | Already scaffolded; one language end to end. |
| ORM / migrations | SQLAlchemy 2 + Alembic | Replace `create_all`; schema changes must be reviewable and reversible. |
| Database | PostgreSQL 16 (Docker Compose locally) | Holds all state, including the job queue; no Redis, NATS or S3 needed at demo scale. |
| Optimiser | HiGHS via `highspy` | Open-source MILP, fast on ~5k-variable models, CPU only. Confirm the modelling API version at Phase 2. |
| Agent | Azure OpenAI Responses API via the `openai` Python SDK (v1 endpoint), Entra ID auth via `azure-identity` | Provider chosen by the team; see [02-agent.md](02-agent.md). |
| Numerics | numpy | Simulator and KPI arithmetic. |
| Web | React 19 + TS (existing), TanStack Query (polling), IBM Carbon (`@carbon/react`, `@carbon/charts-react`, theme g10) | The sample screens are Carbon; tokens and motion in [07-design-tokens.md](07-design-tokens.md). |

## Server package layout

```
server/app/
  api/routes/      auth, portfolio, runs, cycles, actions, scenarios, documents, chat, config
  models/          SQLAlchemy entities (03-data-model.md)
  schemas/         Pydantic request/response + asset param models per kind
  sim/             world generators, forecasts, plant step, mock adapters, presets
  state/           observation assembly, situation features, event detection
  optimize/        model build, two-stage solve, variants, robust evaluation, baseline policy, validator
  policy/          tier rules, approvals, fallback
  agent/           BOB prompts, tools, cycle loop, document extraction, chat
  cycle.py         one decision cycle end to end
  worker.py        clock + job loop
```

## Multi-replica rules

| Concern | Rule |
| --- | --- |
| Sim clock | No timers. A run row stores `current_block` and `next_due_at`. A worker claims a due run with `SELECT … FOR UPDATE SKIP LOCKED`, processes one block, sets the next due time, commits. Exactly one replica advances a run at a time. |
| Mid-block events | `world_event` rows with `sim_at`; the worker that holds the run lock fires them. A fired event triggers an event cycle (`cycle.seq` > 0) within the same lock. |
| Jobs | `job` table, claimed with `SKIP LOCKED`, `locked_until` lease so a crashed worker's job is retried; `dedup_key` unique makes enqueue idempotent. |
| Live UI updates | Polling an append-only feed (`audit_log.id > after`). Works across replicas without pub/sub. |
| Idempotent execution | Every action has a unique `idempotency_key` (`run:block:cycle:kind:asset`); adapters ignore repeats. |
| Caches | None in process. Optimiser inputs are rebuilt from Postgres each cycle (a few thousand rows). |
| Secrets | `SECRET_KEY` required at startup outside `ENV=local`; Azure OpenAI credentials from Entra ID (managed identity) or env only. |

## Production readiness check

| Question | Answer |
| --- | --- |
| Consistency | The decision path is deterministic given state, seed and profile; the LLM only chooses among validated options. Rollouts with fixed seeds are reproducible bit for bit (except LLM-enabled runs). |
| Failure at 10x / 100x | The bottleneck is solver time: ~36 MILPs per cycle. 10x assets → larger models (still seconds). 100x → partition the portfolio by zone and shard runs across workers; the queue design already allows it. LLM calls scale with events, not blocks. |
| Blast radius | A failed cycle falls back to the previous valid plan or safe-hold; a failed LLM call falls back to rules; a failed adapter leaves the action `failed` and raises an event. Nothing executes without passing the independent validator. |
| Reversibility | Profiles and policy rules are versioned rows editable in the UI without a deploy; plans reference the versions they used. Agent can be switched off per run (`agent_enabled`). |
| Business metric | BOB vs baseline on net cost, deviation charges, curtailment, carbon, unserved energy and battery cycles, on identical simulated days (Simulation page). |
| Hidden dependencies | Azure OpenAI availability, deployment quota (TPM) and content filtering (fallback exists for all three); HiGHS build availability on the target platform; Postgres. Mocked: all OT and market systems. |

## Configuration (env)

`DATABASE_URL`, `SECRET_KEY`, `ENV`, `CORS_ORIGINS`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_KEY` (local only; Entra ID otherwise), `BOB_EFFORT_CYCLE` (default `medium`), `BOB_ENABLED` (default `true`), `WORKER_PROCESSES` (solver pool size, default 4), `SOLVER_TIME_LIMIT_S` (default 2).
