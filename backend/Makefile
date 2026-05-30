.PHONY: help venv source dev prod migrate-up migrate-down migrate-tree db-check fixtures fixtures-all

VENV_DIR ?= .venv
PYTHON_BOOTSTRAP ?= python3.14

ifeq ($(OS),Windows_NT)
VENV_PYTHON := $(VENV_DIR)/Scripts/python.exe
else
VENV_PYTHON := $(VENV_DIR)/bin/python
endif

PYTHON ?= python
ifneq ($(wildcard $(VENV_PYTHON)),)
RUN_PYTHON := "$(VENV_PYTHON)"
else
RUN_PYTHON := $(PYTHON)
endif
ALEMBIC ?= $(RUN_PYTHON) -m alembic

APP_MODULE ?= main:app
APP_DIR ?=
HOST ?= 0.0.0.0
PORT ?= 8080
LOG_LEVEL ?= info
WORKERS ?= 4
LIFESPAN ?= auto
ACCESS_LOG ?= 1
ROOT_PATH ?=
PROXY_HEADERS ?= 0
FORWARDED_ALLOW_IPS ?=
TIMEOUT_KEEP_ALIVE ?= 5
ENV_FILE ?=
RELOAD_DIRS ?= app
RELOAD_DELAY ?=
HTTP ?=
LOOP ?=
WS ?=
UVICORN_EXTRA ?=

FIXTURE_DIR ?= fixture_data
FIXTURE ?=
BASE_URL ?= http://localhost:$(PORT)/api
AUTH_USERNAME ?= admin_hema
AUTH_PASSWORD ?= supersecretpassword123
AUTH_EMAIL ?= admin@gmail.com
SECRET_TOKEN ?= not-really-a-key

REV ?= head
DOWN ?= -1

UVICORN_BASE_ARGS := $(APP_MODULE) --host $(HOST) --port $(PORT) --log-level $(LOG_LEVEL)
ifneq ($(strip $(APP_DIR)),)
UVICORN_BASE_ARGS += --app-dir $(APP_DIR)
endif
ifneq ($(strip $(LIFESPAN)),)
UVICORN_BASE_ARGS += --lifespan $(LIFESPAN)
endif
ifneq ($(strip $(ROOT_PATH)),)
UVICORN_BASE_ARGS += --root-path $(ROOT_PATH)
endif
ifneq ($(strip $(FORWARDED_ALLOW_IPS)),)
UVICORN_BASE_ARGS += --forwarded-allow-ips $(FORWARDED_ALLOW_IPS)
endif
ifneq ($(strip $(ENV_FILE)),)
UVICORN_BASE_ARGS += --env-file $(ENV_FILE)
endif
ifneq ($(strip $(TIMEOUT_KEEP_ALIVE)),)
UVICORN_BASE_ARGS += --timeout-keep-alive $(TIMEOUT_KEEP_ALIVE)
endif
ifneq ($(strip $(HTTP)),)
UVICORN_BASE_ARGS += --http $(HTTP)
endif
ifneq ($(strip $(LOOP)),)
UVICORN_BASE_ARGS += --loop $(LOOP)
endif
ifneq ($(strip $(WS)),)
UVICORN_BASE_ARGS += --ws $(WS)
endif
ifeq ($(ACCESS_LOG),1)
UVICORN_BASE_ARGS += --access-log
else
UVICORN_BASE_ARGS += --no-access-log
endif
ifeq ($(PROXY_HEADERS),1)
UVICORN_BASE_ARGS += --proxy-headers
endif

DEV_UVICORN_ARGS := $(UVICORN_BASE_ARGS) --reload
ifneq ($(strip $(RELOAD_DIRS)),)
DEV_UVICORN_ARGS += --reload-dir $(RELOAD_DIRS)
endif
ifneq ($(strip $(RELOAD_DELAY)),)
DEV_UVICORN_ARGS += --reload-delay $(RELOAD_DELAY)
endif

PROD_UVICORN_ARGS := $(UVICORN_BASE_ARGS) --workers $(WORKERS)

help:
	@echo "Targets:"
	@echo "  venv           Create virtualenv at $(VENV_DIR)"
	@echo "  source         Open a shell with virtualenv $(VENV_DIR) activated"
	@echo "  dev            Run dev server with reload (PORT/LOG_LEVEL/etc.)"
	@echo "  prod           Run prod server (WORKERS/LOG_LEVEL/etc.)"
	@echo "  migrate-up     Alembic upgrade (REV=head)"
	@echo "  migrate-down   Alembic downgrade (DOWN=-1)"
	@echo "  migrate-tree   Show migration tree"
	@echo "  db-check       Check database connectivity"
	@echo "  fixtures       Load fixtures (FIXTURE=upload_expenses.py or empty for all)"
	@echo ""
	@echo "Vars:"
	@echo "  APP_MODULE HOST PORT LOG_LEVEL WORKERS LIFESPAN ACCESS_LOG ROOT_PATH"
	@echo "  PROXY_HEADERS FORWARDED_ALLOW_IPS TIMEOUT_KEEP_ALIVE ENV_FILE"
	@echo "  RELOAD_DIRS RELOAD_DELAY HTTP LOOP WS UVICORN_EXTRA"
	@echo "  BASE_URL AUTH_USERNAME AUTH_PASSWORD AUTH_EMAIL SECRET_TOKEN"

venv:
	$(PYTHON_BOOTSTRAP) -m venv $(VENV_DIR)

source:
ifeq ($(OS),Windows_NT)
	@if [ ! -f "$(VENV_DIR)/Scripts/activate" ]; then echo "Virtualenv not found at $(VENV_DIR). Run 'make venv' first."; exit 1; fi
	@echo "Launching a shell with $(VENV_DIR) activated. Exit the shell to return."
	@cmd.exe /K "$(VENV_DIR)\\Scripts\\activate.bat"
else
	@if [ ! -f "$(VENV_DIR)/bin/activate" ]; then echo "Virtualenv not found at $(VENV_DIR). Run 'make venv' first."; exit 1; fi
	@echo "Launching a shell with $(VENV_DIR) activated. Exit the shell to return."
	@. "$(VENV_DIR)/bin/activate" && exec "$${SHELL:-/bin/bash}" -i
endif

dev:
	$(RUN_PYTHON) -m uvicorn $(DEV_UVICORN_ARGS) $(UVICORN_EXTRA)

prod:
	$(RUN_PYTHON) -m uvicorn $(PROD_UVICORN_ARGS) $(UVICORN_EXTRA)

migrate-up:
	$(ALEMBIC) upgrade $(REV)

migrate-down:
	$(ALEMBIC) downgrade $(DOWN)

migrate-tree:
	$(ALEMBIC) history --verbose --indicate-current

db-check:
	$(RUN_PYTHON) -c "from sqlalchemy import text; from app.database import engine; conn = engine.connect(); conn.execute(text('SELECT 1')); conn.close(); print('DB connection: ok')"

fixtures:
ifeq ($(strip $(FIXTURE)),)
	$(MAKE) fixtures-all
else
	BASE_URL=$(BASE_URL) AUTH_USERNAME=$(AUTH_USERNAME) AUTH_PASSWORD=$(AUTH_PASSWORD) AUTH_EMAIL=$(AUTH_EMAIL) SECRET_TOKEN=$(SECRET_TOKEN) \
		$(RUN_PYTHON) -m fixture_data.$(patsubst %.py,%,$(notdir $(FIXTURE)))
endif

fixtures-all:
	BASE_URL=$(BASE_URL) AUTH_USERNAME=$(AUTH_USERNAME) AUTH_PASSWORD=$(AUTH_PASSWORD) AUTH_EMAIL=$(AUTH_EMAIL) SECRET_TOKEN=$(SECRET_TOKEN) \
		$(RUN_PYTHON) -m fixture_data.upload_all_data
	BASE_URL=$(BASE_URL) AUTH_USERNAME=$(AUTH_USERNAME) AUTH_PASSWORD=$(AUTH_PASSWORD) AUTH_EMAIL=$(AUTH_EMAIL) SECRET_TOKEN=$(SECRET_TOKEN) \
		$(RUN_PYTHON) -m fixture_data.upload_expenses
	BASE_URL=$(BASE_URL) AUTH_USERNAME=$(AUTH_USERNAME) AUTH_PASSWORD=$(AUTH_PASSWORD) AUTH_EMAIL=$(AUTH_EMAIL) SECRET_TOKEN=$(SECRET_TOKEN) \
		$(RUN_PYTHON) -m fixture_data.upload_shelf_instructors
	BASE_URL=$(BASE_URL) AUTH_USERNAME=$(AUTH_USERNAME) AUTH_PASSWORD=$(AUTH_PASSWORD) AUTH_EMAIL=$(AUTH_EMAIL) SECRET_TOKEN=$(SECRET_TOKEN) \
		$(RUN_PYTHON) -m fixture_data.upload_test_members_300
