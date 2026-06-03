# Quartermaster CRM Frontend

React + TypeScript + Vite frontend for the Quartermaster HEMA club management system.

## What It Does

- Authenticated dashboard shell for daily club administration
- CRUD resource pages backed by OpenAPI-generated TypeScript types
- Member, instructor, schedule, session, attendance, contract, shelf, user, and role screens
- Public attendance flow for training check-ins
- Reusable data table, detail sheet, date/month pickers, and shadcn-style UI primitives
- Dashboard charts and operational summaries

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui-style component primitives
- TanStack Query and TanStack Table
- Recharts
- pnpm

## Prerequisites

- Node.js 22 or newer
- pnpm 11.3.0

## Install

```bash
pnpm install --frozen-lockfile
```

The project intentionally uses `pnpm` only. Do not add `package-lock.json`.

## Run Locally

```bash
pnpm run dev
```

The Vite dev server is configured for:

```text
http://localhost:8123/hema-crm/
```

The backend proxy target defaults to:

```text
http://127.0.0.1:8080
```

Override it with `VITE_API_PROXY_TARGET` if needed.

## Build And Checks

```bash
pnpm exec tsc --noEmit
pnpm run build
```

Optional lint check:

```bash
pnpm run lint
```

## Project Structure

```text
frontend/
├── src/
│   ├── components/       # Reusable components and shadcn-style primitives
│   ├── hooks/            # Shared React hooks
│   ├── lib/              # API client, auth, router, table helpers
│   ├── pages/            # App pages and feature screens
│   ├── types/            # Generated and shared TypeScript types
│   ├── App.tsx           # App state, route mapping, auth gate
│   └── main.tsx          # React entry point
├── docs/                 # Generated API docs and code pattern notes
├── public/               # Static assets
├── dist/                 # Production output
└── pnpm-workspace.yaml   # pnpm workspace and build-script policy
```

## API Types

Generated API types live in `src/types/api.generated.ts` and are based on the backend OpenAPI schema. API documentation artifacts live in `docs/api-index.json` and `docs/api-summary.md`.

## Troubleshooting

If install or build scripts are blocked, check `pnpm-workspace.yaml`. The repo allows `esbuild` postinstall scripts explicitly because Vite depends on the native esbuild binary.

If the frontend cannot reach the backend, confirm that the backend is running on port `8080` or set `VITE_API_PROXY_TARGET`.
