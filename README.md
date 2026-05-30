# HEMA Garden CRM (Gym Management System)

A monorepo for managing a HEMA (Historical European Martial Arts) gym: members, instructors, training schedules, attendance, memberships, payments, events, storage rentals, and finances.

This repository contains two applications:
- backend — FastAPI-based REST API with SQLite/SQLAlchemy
- frontend — React + TypeScript (Vite) web UI

For detailed documentation of each app, see:
- backend/README.md
- frontend/README.md

## Repository Structure

```
hema-garden-crm/
├── backend/      # FastAPI service (Python 3.13)
├── frontend/     # React + TypeScript (Vite)
├── processes.md  # High-level processes (ru)
└── ignored/      # Project notes (ru), not part of the app runtime
```

## Feature Overview

- Member and instructor management
- Training forms, weekly schedules, and attendance tracking
- Membership plans and payment tracking
- Events (workshops, tournaments) with registrations and expenses
- Storage rental (shelves/lockers) management
- Financial tracking (income, expenses, payouts) and analytics

## Roadmap & Status

The following list tracks major capabilities and their status.

### Member Management
- [x] Add new club members
- [x] Assign instructors

### Shelf Management
- [x] Add shelves
- [x] Group shelves by location
- [x] Assign shelves to club members
- [ ] Display shelves with filtering by status:
  - [x] Occupied / Vacant
  - [x] With contract / Without contract
  - [x] Paid / Unpaid
  - [ ] With expired contract
- [x] Attach contracts to shelves (membership)

### Payment Tracking
- [x] Record payment facts (completed and pending) for:
  - [x] Contracts (monthly / yearly)
  - [x] Shelves (monthly / yearly)

### Balance Management
- [x] Record current club balance (daily)

### Expense Tracking
- [x] Add expenses manually
- [ ] Set up recurring payments (fixed monthly amounts)

### Analytics & Statistics
- [ ] Active club members over time and by seasons
  - [x] Filter by start date
- [ ] First-time visits over time and by seasons
  - [ ] Breakdown by age groups
- [ ] Financial income and expenses by months and seasons
  - [ ] Breakdown by categories
- [ ] Number of training sessions over time and by seasons
  - [ ] Breakdown by type, instructor, and participant count

### Removes
- [ ] Remove members (nominal)
- [ ] Remove shelves (nominal)
- [ ] Remove contracts (nominal)
- [ ] Remove expenses (absolute)
- [ ] Remove payments (absolute)
- [ ] Remove storage rentals

## Prerequisites

- Backend: Python 3.13, pip
- Frontend: Node.js ≥ 18, npm

## Quick Start

### 1) Backend (FastAPI)

From the backend folder:

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

The API will be available at:
- http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

More details: backend/README.md

### 2) Frontend (React + Vite)

From the frontend folder:

```bash
cd frontend
npm install
npm run dev
```

The app will be available at: http://localhost:5173

More details: frontend/README.md

## Configuration

### Backend

- Environment variables are managed via `.env` (loaded by Pydantic Settings):
  - `APP_NAME` (default: "HEMA Garden Management System")
  - `APP_VERSION` (default: `1.0.0`)
  - `API_PREFIX` (default: `/api`)
  - `DATABASE_URL` (default: `sqlite:///./hema_gym.db`)
  - `BACKEND_CORS_ORIGINS` (default: `[*]`)
- OpenAPI schema: `/openapi.json`
- Interactive docs: `/docs` and `/redoc`

### Frontend

- API base URL is configured in `frontend/src/lib/api-client.ts` (default: `http://localhost:8000/api`). Adjust if the backend runs on a different host/port.

## Development Notes

- This repository includes Russian-language process descriptions in `processes.md` and additional notes in `ignored/project_info.md` that outline business workflows and analytics expectations.
- Prefer updating the per-app READMEs for deep technical details; use this file for top-level guidance.

## Troubleshooting

- Ports:
  - Backend: 8000 (FastAPI/Uvicorn)
  - Frontend: 5173 (Vite dev server)
- CORS: If the frontend cannot reach the backend due to CORS, set `BACKEND_CORS_ORIGINS` in backend `.env` (e.g., `["http://localhost:5173"]`).
- Database: The default SQLite database file `hema_gym.db` is created in the `backend/` working directory. Ensure the process has write permissions.

## License

If a separate LICENSE file is added to the repository, it will govern usage. Until then, treat this project as “all rights reserved” by the authors.

## Support

For issues and questions, please open an issue in this repository.

— Last updated: 2025-11-12 15:22
