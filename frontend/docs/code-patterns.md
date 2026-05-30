# Frontend Code Patterns

This file captures recurring patterns found in the current codebase. Update it after refactors or when patterns change.

## Application Shell
- The active frontend is a Vite SPA built around `shadcn/ui` primitives and Tailwind CSS.
- `src/main.tsx` mounts the app and wraps it with `ThemeProvider` and `TooltipProvider`.
- `src/App.tsx` owns app-level state for the current user, the active route, auth loading, and login submission.
- The app currently renders two top-level states: the login screen and the authenticated dashboard shell.

## Data and Auth
- API access is centralized in `src/lib/api-client.ts` and uses the browser `fetch` API, not Axios.
- Resource-specific clients live in `src/lib/backend-api/*` and build on the shared `CrudResourceApi` abstraction from `src/lib/backend-api/shared.ts`.
- Request and response types come from `src/types/api.generated.ts`, which mirrors the backend OpenAPI schema.
- Authentication is token-based: the access token is stored in `localStorage`, `/auth/login` issues the token, and `/auth/me` resolves the current user.
- `src/App.tsx` checks the session on startup and guards protected views by redirecting unauthenticated users to `/login`.

## Routing
- Client-side routing is implemented in `src/lib/router.ts` with the History API and a typed `AppRoute` union.
- The current route surface is intentionally small: `/`, `/login`, `/dashboard`, and `/member`.
- Protected navigation uses helper functions such as `getRouteFromLocation`, `isProtectedRoute`, and `navigateTo` instead of a third-party router.

## Layout and Theming
- The authenticated shell lives in `src/app/dashboard/page.tsx`.
- Dashboard layout is composed from `SidebarProvider`, `AppSidebar`, `SidebarInset`, and `SiteHeader`.
- Theme tokens and global visual primitives live in `src/index.css`.
- `ThemeProvider` manages `light`, `dark`, and `system` modes and keeps theme state synchronized through `localStorage`.

## UI and Styling
- Prefer composable `shadcn/ui` components and Tailwind classes over ad-hoc markup.
- Keep global tokens, fonts, and base element styling in `src/index.css`; keep feature-specific layout in components.
- The project uses the `radix-nova` shadcn style from `components.json` and `@remixicon/react` for icons.
- Shared helpers stay in `src/lib/utils.ts`, especially `cn()` for class composition.
- Prefer semantic Tailwind tokens such as `bg-background`, `text-muted-foreground`, and the sidebar/chart token set defined in `src/index.css`.
- Forms should use the shared field primitives from `src/components/ui/field.tsx` together with composed `Card` layouts.

## Page Patterns
- Dashboard content is switched by `DashboardSection` values instead of nested route trees.
- `src/app/dashboard/panel-view.tsx` composes KPI cards, charts, and tasks into the main overview screen.
- `src/app/dashboard/members-view.tsx` wraps entity content in a `Card` and delegates the grid rendering to the shared `DataTable` component.
- `src/components/data-table.tsx` derives visible columns from backend schema metadata and pairs that schema with local row data.

## Dashboard
- Analytics visualizations use `recharts`.
- Sidebar navigation, summary cards, charts, and task tables are split into focused components under `src/components/*`.
- Keep dashboard sections modular and continue reusing shared `Card`, `Table`, `Sidebar`, and chart primitives instead of rebuilding custom layout blocks.
