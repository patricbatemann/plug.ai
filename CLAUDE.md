# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

PlugAI is a hackathon demo of BOB, an AI agent that orchestrates a renewable energy portfolio in 15-minute blocks. Client: React 19 + TypeScript + Vite + IBM Carbon in `web/`. API: FastAPI + SQLAlchemy 2 on PostgreSQL in `server/`. The design lives in `docs/spec/00`–`07`; the Figma exports are in `docs/LaGo- Main Version/`; the operator guide is `docs/user-manual.md`. Work proceeded in the phases of `docs/spec/06-delivery-plan.md` (all built).

## Commands

Run from the repository root (GNU Make; server targets use `server/.venv`):

```sh
make setup        # .env from examples (no overwrite), npm install, venv + pip install
make db-up        # PostgreSQL 16 via docker compose (databases bob and bob_test)
make migrate      # alembic upgrade head
make seed         # demo portfolio (idempotent)
make server-dev   # uvicorn --reload -> http://localhost:8000 (docs at /docs)
make worker       # simulation clock; safe to run several
make web-dev      # vite -> http://localhost:5173
make test         # backend pytest (needs db-up) + colour-literal check on web/src
make build        # tsc -b && vite build (the only frontend type check)
```

Single test: `cd server && .venv/bin/python -m pytest tests/test_portfolio.py::test_portfolio_overview_matches_seeded_capacities`.

New migration: change models, then `cd server && .venv/bin/alembic revision --autogenerate -m "..."` and review the file (autogenerate emits `Text()` without the `sa.` prefix for JSONB).

## Architecture

```text
web/src  pages ─> TanStack Query ─> api/client.ts ─HTTP─> server/app
server/app  main.py ─> api/router.py (/api) ─> api/routes/*.py ─> services/*.py ─> models/*.py
                       api/dependencies.py (get_current_user)          core/{config,database,security}
```

**Server layering.** Routes handle HTTP concerns and delegate to `services/`, which take a `Session`. `schemas/` holds Pydantic models, separate from SQLAlchemy `models/`. Asset parameters are one JSONB column validated per asset kind by `schemas/portfolio.py::validate_params` on every write path.

**Simulation.** `app/sim/world.py` computes the truth for every block as pure numpy functions of (preset config, seed, assets, world events), so any replica can rebuild it. `forecast.py` builds forecasts from a World containing only *revealed* events (truth vs knowledge). `plant.py` settles a block on the radial network. `services/runs.py::advance` settles the next block, issues forecasts and moves the clock; the worker claims due runs with `FOR UPDATE SKIP LOCKED`. Sim time is derived from `block_started_at` and speed, never from timers. Presets live in `sim/presets.py`; a run stores a copy of its preset.

**Dispatch.** `optimize/model.py` is a vectorised builder over highspy (never per-term expressions: ~1000x slower). `optimize/dispatch.py::plan` solves stage A (reliability) then stage B (cost + profile shadow prices) over a rolling 96-block horizon; only index 0 (plus RTM at the gate and DR at its notice) is executed. Daily limits (battery cycles, DR energy, load-shift balance) carry today's usage as state, because the horizon rolls. `services/dispatch.py` builds inputs from the latest forecasts, validates each action (`optimize/validator.py`, independent of the optimiser), sends it through `sim/adapters.py`, and settles every block twice (`policy` = `bob` / `baseline`). Live blocks run `optimize/situation.py` (signals → mode → guard floors), five variants (`profiles.py`), and `robust.py` (stress scenarios, regret, least worst-case regret) through a forkserver process pool (`SOLVER_PROCESSES`); fast-forwarded blocks plan one option. Tiers come from `services/policy.py` (configs in `action_config`, `portfolio.protected`); gated actions get a fallback plan (`plan(..., forbid=...)`). `runs.replan_for_events` re-plans the block in progress on visible events; a re-plan supersedes earlier cycles' uncommitted decisions for that block. `services/configs.py` drafts, validates (protected limits), tests (three scenarios against the live run) and activates configs as new versions; watch conditions are checked in `dispatch.plan_block`. `services/deliberation.py` holds one cycle's decisions in order (mode → scenarios → options → choice); the rules make them, or BOB does through tools in `agent/cycle.py`, and `Deliberation.finish` lets the rules complete whatever BOB left open. `agent/llm.py` is the Azure OpenAI tool loop (Chat Completions with `reasoning_effort="none"`, since the deployment's Responses API fails); every turn writes an `agent_call` row and any failure falls back to rules. Documents (`services/documents.py`, `agent/extract.py`) become `run_constraint` rows via one structured-output call and a validator (tightening + confident + quote found → active; otherwise pending for Apply/Reject); everything BOB knows limits its plan through `dispatch.knowledge` (fired events, active constraints, its own maintenance schedule). `services/maintenance.py` proposes job moves (storm windows, ₹1 lakh saving) and inspections, settled per policy (BOB's schedule vs the calendar). Replays (`services/studies.py`) are runs with a `study_id`, every block fast-forwarded and advanced by the same worker clock; live-run lookups use `runs.latest_live`. Site views: `services/activity.py` (activity log merging cycles, notable actions, events, constraints, config activations), `services/datasources.py` (CSV and simulated API data sources, a mock). `services/whatif.py` serves the Simulation page and the chat tool. `tests/test_reliability.py` replays 3 seeds (~55 s) and asserts no hard-limit violation. `agent/chat.py` is Ask BOB (read-only, what-if and draft-config tools; never activates); history lives in `chat_message`, and answers stream to the UI as server-sent events from their own session (`core/database.py::get_session_factory`). Tests force `bob_enabled=False` and mock the client via `llm._client`.

**Database.** Alembic owns the schema (`server/migrations/`); there is no `create_all`. The demo assumes a single portfolio (`services/portfolio.py::get_portfolio`). Server code must be safe with multiple replicas: no in-process state, timers or caches.

**Config.** `core/config.py` reads `server/.env` relative to the working directory, so start the server from `server/`. Empty env values are ignored. Outside `ENV=local`, `SECRET_KEY` is required.

**Client.** `api/client.ts` is the single fetch wrapper and owns the token (`tokenStore`, key `bob.accessToken`); it attaches the bearer token to every request. A 401 from any query clears the token and returns to `/login` (`main.tsx`). There is no Vite proxy, so the API's `CORS_ORIGINS` must include the client origin.

**UI rules.** Use Carbon components and theme tokens (`g10`, `web/src/styles/app.scss`). No colour literals in `web/src` (`npm run check:colors` enforces it). The nav only shows pages that exist.

**Tests.** `server/tests/conftest.py` migrates the `bob_test` database once per session, truncates all tables per test, and overrides `get_db`. Use the `client`, `db` and `auth_headers` fixtures.
