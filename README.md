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

Then start the client and API in separate terminals:

```sh
make web-dev
make server-dev
```

The API runs at `http://localhost:8000` (interactive docs at `/docs`); Vite serves the client at `http://localhost:5173`. Create an account on the sign-up page, then open the portfolio.

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
  migrations/        Alembic migrations
  tests/             API tests against PostgreSQL
```
