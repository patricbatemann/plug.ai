PYTHON ?= python3
NPM ?= npm

ifeq ($(OS),Windows_NT)
VENV_PYTHON := .venv/Scripts/python.exe
else
VENV_PYTHON := .venv/bin/python
endif

.PHONY: setup env install install-web install-server db-up db-down migrate seed web-dev server-dev test test-server check-colors build clean

setup: env install

env:
	$(PYTHON) -c "from pathlib import Path; [(Path(directory) / '.env').write_bytes((Path(directory) / '.env.example').read_bytes()) for directory in ('server', 'web') if not (Path(directory) / '.env').exists()]"

install: install-web install-server

install-web:
	cd web && $(NPM) install

install-server:
	cd server && $(PYTHON) -m venv .venv && $(VENV_PYTHON) -m pip install -r requirements.txt

db-up:
	docker compose up -d --wait

db-down:
	docker compose down

migrate:
	cd server && $(VENV_PYTHON) -m alembic upgrade head

seed:
	cd server && $(VENV_PYTHON) -m app.seed

web-dev:
	cd web && $(NPM) run dev

server-dev:
	cd server && $(VENV_PYTHON) -m uvicorn app.main:app --reload

test: test-server check-colors

test-server:
	cd server && $(VENV_PYTHON) -m pytest

check-colors:
	cd web && $(NPM) run check:colors

build:
	cd web && $(NPM) run build

clean:
	$(PYTHON) -c "from pathlib import Path; import shutil; shutil.rmtree(Path('web/dist'), ignore_errors=True)"
