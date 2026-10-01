# AI Energy Starter

A small full-stack starter with a React + TypeScript client and a FastAPI + SQLite API. The code is divided into presentation/routing, services, and persistence layers without introducing a larger framework than the project needs.

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- Python 3.11+

## Run locally

With GNU Make installed, create local environment files and install both sets of dependencies:

```sh
make setup
```

Start the client and API in separate terminals from the repository root:

```sh
make web-dev
make server-dev
```

The API runs at `http://localhost:8000`; interactive documentation is at `http://localhost:8000/docs`. Vite serves the client at `http://localhost:5173`.

Useful targets: `make env` creates local `.env` files from the examples without overwriting existing ones; `make install-web` and `make install-server` install dependencies separately; `make test` runs backend tests; `make build` builds the client; `make clean` removes the generated web build.

## Manual setup

Alternatively, follow these steps without GNU Make. Open two terminals from the repository root.

### API

```sh
cd server
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
copy .env.example .env
# macOS/Linux: cp .env.example .env
uvicorn app.main:app --reload
```

On first startup, SQLAlchemy creates `server/aienergy.db`. The SQLite file is local, ignored by git, and can be removed to reset local data.

### Web client

```sh
cd web
npm install
copy .env.example .env
# macOS/Linux: cp .env.example .env
npm run dev
```

Set `VITE_API_URL` in `web/.env` if the API runs somewhere other than `http://localhost:8000`.

## Configuration

- `server/.env.example` documents API settings. The API generates a random signing key when `SECRET_KEY` is omitted, which invalidates existing tokens when the process restarts. Set a stable, unique `SECRET_KEY` outside local development; never commit `.env`.
- `DATABASE_URL` accepts a SQLAlchemy URL. SQLite is the default.
- `CORS_ORIGINS` is a comma-separated list of browser origins, defaulting to `http://localhost:5173`.
- `web/.env.example` configures the API base URL.

## API

All authentication endpoints are under `/api/auth`:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/register` | Create an account; returns an access token and user |
| `POST` | `/login` | Validate email/password; returns an access token and user |
| `GET` | `/me` | Return the authenticated user (`Authorization: Bearer <token>`) |

Passwords are hashed with Argon2. Access tokens are signed JWTs with an expiry and are sent as bearer tokens. This starter keeps the token in browser local storage for a straightforward client flow; production applications should evaluate their threat model and may prefer secure, HTTP-only cookies and a CSRF strategy.

## Project layout

```text
web/
  src/api/           Typed API client and auth contract
  src/auth/          Auth state and protected-route guard
  src/components/    Shared application layout
  src/pages/         Public and authenticated pages
server/
  app/api/           HTTP routers/controllers and auth dependencies
  app/core/          Settings, database, and security primitives
  app/models/        SQLAlchemy entities
  app/schemas/       Request and response models
  app/services/      Authentication business logic
  tests/             API and persistence tests
```

## Checks

```sh
cd server
python -m pytest
cd ../web
npm run build
```
