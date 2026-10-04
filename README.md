# PLUG.AI — Renewable Energy Orchestrator

A demo of BOB, an AI agent that orchestrates a renewable energy portfolio (solar, wind, batteries, industrial demand, grid and market) in 15-minute blocks. The client is React + TypeScript with IBM Carbon; the API is FastAPI on PostgreSQL.

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- Python 3.11+
- Docker (for PostgreSQL)

## Run locally

With GNU Make installed, from the repository root:

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

The API runs at `http://localhost:8000` (interactive docs at `/docs`); Vite serves the client at `http://localhost:5173`. Create an account on the sign-up page, then start a run from the header (**New run** → a preset). Runs fast-forward to 10:45, then advance one 15-minute block every 30 s at 30×. Every block, BOB plans the next 24 hours with a mixed-integer optimiser (HiGHS) and executes the first block's actions through mock adapters; the same day is also settled with today's rule-based practice, and the portfolio page compares the two. Open a site to see its Live overview; pause, step, change speed or inject events from the header. The worker can run as several processes; each block is settled exactly once.

Other targets: `make test` runs backend tests (needs `make db-up`) and the colour-token check; `make build` builds the client; `make db-down` stops PostgreSQL; `make clean` removes the web build.

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
