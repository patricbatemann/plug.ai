# PlugAI — Renewable Energy Orchestrator

A demo of BOB, an AI agent that orchestrates a renewable energy portfolio (solar, wind, batteries, industrial demand, grid and market) in 15-minute blocks. The client is React + TypeScript with IBM Carbon; the API is FastAPI on PostgreSQL.

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- Python 3.12+
- Docker, or a local PostgreSQL 16

## Run locally

On Windows without Make or Docker, see [Windows](#windows-without-make-or-docker). With GNU Make installed, from the repository root:

```sh
make setup      # .env files from the examples, npm install, Python venv
make db-up      # PostgreSQL 16 in Docker (databases bob and bob_test)
make migrate    # apply database migrations
make seed       # demo portfolio: 9 sites, 18 assets in Andhra Pradesh
```

Then start the client, the API and the simulation worker in separate terminals:

```sh
make web-dev
make server-dev
make worker
```

The API runs at `http://localhost:8000` (interactive docs at `/docs`); Vite serves the client at `http://localhost:5173`. Create an account on the sign-up page, then start a run from the header (**New run** → a preset). Runs fast-forward to 10:45, then advance one 15-minute block every 30 s at 30×. Every block, BOB reads the situation, picks an operating mode (balanced, economic, clean, resilience or grid support), builds up to five options with a mixed-integer optimiser (HiGHS), stress-tests their committed actions against scenarios such as renewables at P10 or the largest battery out, and chooses the least worst-case regret. It plans the next 24 hours and executes the first block's actions through mock adapters; the same day is also settled with today's rule-based practice, and the portfolio page compares the two. Each action is automatic, needs approval, or is only a recommendation, according to its asset's configured action and the organisation's protected limits; gated actions wait on the Actions page while a fallback plan runs. Events BOB can see (a battery trip, a derate, an announced price spike, new forecasts) re-plan the block in progress. Open a site to see its Live overview; pause, step, change speed or inject events from the header. The worker can run as several processes; each block is settled exactly once.

Other targets: `make test` runs backend tests (needs `make db-up`) and the colour-token check; `make build` builds the client; `make db-down` stops PostgreSQL; `make clean` removes the web build.

### Windows without Make or Docker

```text
winget ──> Python 3.12, Node LTS, PostgreSQL 16
psql   ──> role bob + databases bob, bob_test
server ──> .env, .venv, migrate, seed ──> API :8000 + worker
web    ──> .env, npm install ──> Vite :5173
```

Use PowerShell from the repository root. Install the tools (the PostgreSQL installer asks for a password for the `postgres` superuser), then open a new terminal so they are on `PATH`:

```powershell
winget install Python.Python.3.12 OpenJS.NodeJS.LTS PostgreSQL.PostgreSQL.16
```

If PowerShell reports that running scripts is disabled when you call `npm`, allow local scripts once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Create the role and databases that Docker Compose would otherwise create:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres `
  -c "CREATE ROLE bob LOGIN PASSWORD 'bob'" `
  -c "CREATE DATABASE bob OWNER bob" `
  -c "CREATE DATABASE bob_test OWNER bob"
```

Set up the API and the client:

```powershell
cd server
Copy-Item .env.example .env
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m alembic upgrade head
.venv\Scripts\python -m app.seed
cd ..\web
Copy-Item .env.example .env
npm install
```

Then run each of these in its own terminal from the repository root:

```powershell
cd server; .venv\Scripts\python -m uvicorn app.main:app --reload   # API
cd server; .venv\Scripts\python -m app.worker                      # simulation clock
cd web; npm run dev                                                # client
```

Tests: `cd server; .venv\Scripts\python -m pytest`, and `cd web; npm run check:colors`. Build: `cd web; npm run build`.

## Configuration

- `server/.env.example` documents API settings. With `ENV=local` and no `SECRET_KEY`, the API generates a signing key per process, so tokens stop working after a restart. Any other `ENV` requires a stable `SECRET_KEY` of at least 32 characters.
- `DATABASE_URL` is a SQLAlchemy URL for PostgreSQL (`postgresql+psycopg://…`). Tests use `TEST_DATABASE_URL`, defaulting to the `bob_test` database.
- `CORS_ORIGINS` is a comma-separated list of browser origins, defaulting to `http://localhost:5173`.
- `web/.env.example` sets `VITE_API_URL`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account; returns an access token and user |
| `POST` | `/api/auth/login` | Validate email/password; returns an access token and user |
| `GET` | `/api/auth/me` | The authenticated user |
| `GET` | `/api/portfolio` | Portfolio totals and site summaries |
| `GET` | `/api/sites/{code}` | One site with its assets and parameters |
| `GET` | `/api/runs/presets` | Scenario presets |
| `GET` / `POST` | `/api/runs/current`, `/api/runs` | Latest run; start a run from a preset |
| `POST` | `/api/runs/{id}/pause`, `/play`, `/step` | Clock controls (step only while paused) |
| `PATCH` | `/api/runs/{id}` | Speed (10, 30 or 60×) |
| `POST` | `/api/runs/{id}/events` | Inject a world event |
| `GET` | `/api/runs/{id}/sites/{code}/live` | Site live overview |
| `GET` | `/api/runs/{id}/summary` | BOB vs today's practice totals |
| `GET` | `/api/runs/{id}/actions` | BOB's latest actions |
| `GET` | `/api/runs/{id}/decisions/latest`, `/api/runs/decisions/{cycle}` | Latest decision; full decision record |
| `POST` | `/api/runs/{id}/actions/{action}/approve`, `/decline` | Decide a gated action before its deadline |
| `GET` | `/api/runs/{id}/events?after=` | Fired world events (for notifications) |
| `GET` / `POST` | `/api/sites/{code}/configs`, `/api/sites/{code}/config-options` | Configured actions; save a draft |
| `POST` / `PATCH` | `/api/configs/{id}/test`, `/activate`; `/api/configs/{id}` | Test and activate a draft; pause or resume |

All endpoints except register and login need `Authorization: Bearer <token>`.

## Project layout

```text
web/
  src/api/           Typed API client and token store
  src/auth/          Auth state and protected-route guard
  src/components/    Carbon app shell
  src/pages/         Portfolio, site and sign-in pages
  src/styles/        Carbon theme (g10) and page layout
server/
  app/api/           HTTP routes and auth dependencies
  app/core/          Settings, database and security
  app/models/        SQLAlchemy entities
  app/schemas/       Request/response models and asset parameter validation
  app/services/      Business logic
  app/seed.py        Demo portfolio seed
  app/sim/           Simulated world: presets, truth, forecasts, plant settlement, market rules, mock adapters
  app/optimize/      Dispatch optimiser, validator, today's-practice rules
  app/worker.py      Simulation clock worker
  migrations/        Alembic migrations
  tests/             API tests against PostgreSQL
```
