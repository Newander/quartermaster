# Quartermaster CRM

Quartermaster CRM is a full-stack management system for a HEMA (Historical European Martial Arts) club. It covers daily club operations: members, instructors, training schedules, attendance, contracts, shelves, payments, events, expenses, and finance-oriented analytics.

The repository is structured as a portfolio-grade monorepo: a FastAPI backend, a React/Vite frontend, Docker-based local demo setup, demo fixtures, OpenAPI-driven frontend types, and a CI workflow that verifies the main build path.

## Why This Project Matters

- Models a real operational domain instead of a toy CRUD example.
- Uses generated API metadata to drive reusable CRUD screens and form behavior.
- Includes role-aware backend access patterns for sensitive finance, shelf, document, event, and attendance data.
- Ships with a Docker full-stack demo path: MySQL, backend, fixtures, and static frontend.
- Keeps frontend quality gates reproducible with `pnpm install --frozen-lockfile`, TypeScript checking, and production build.

## Stack

- Backend: Python 3.14, FastAPI, SQLAlchemy 2.x, Alembic, MySQL/SQLite-compatible development setup
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui-style primitives, TanStack Table, Recharts
- Tooling: Docker Compose, pnpm, OpenAPI-generated TypeScript types, GitHub Actions CI

## Repository Layout

```text
quartermaster/
├── backend/              # FastAPI service, SQLAlchemy models, Alembic migrations
├── frontend/             # React + TypeScript + Vite SPA
├── docs/                 # Local run docs and operational SQL notes
├── docker-compose.yml    # Full-stack local demo
└── .github/workflows/    # CI quality gate
```

## Feature Overview

- Member and instructor management
- Training forms, weekly schedules, training sessions, and attendance
- Public attendance flow with device identity support
- Membership contracts, shelves/lockers, and shelf rental tracking
- Payment, expense, balance, and money category management
- Dashboard and analytics views
- Authenticated admin shell with role-aware API access

## Quick Start

The most complete local demo is Docker Compose:

```bash
docker compose up --build
```

Open:

```text
http://localhost:7777/hema-crm/
```

Demo credentials loaded by fixtures:

```text
username: admin_hema
password: supersecretpassword123
```

For more local run details, see [docs/run-local.md](docs/run-local.md).

## Development Checks

Backend:

```bash
cd backend
.venv/bin/python -m compileall -q app main.py
```

Frontend:

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm run build
```

The same core checks are captured in `.github/workflows/ci.yml`.

## Application Docs

- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)
- [Local full-stack run guide](docs/run-local.md)
- [Frontend API summary](frontend/docs/api-summary.md)
- [Frontend code patterns](frontend/docs/code-patterns.md)

## Current Status

The project is usable as a local full-stack demo and is being tightened for portfolio review. The current engineering focus is reproducibility, CI visibility, clearer documentation, and test coverage around the highest-risk business workflows.

## License

If a separate LICENSE file is added to the repository, it will govern usage. Until then, treat this project as all rights reserved by the authors.
