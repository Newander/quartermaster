import * as React from "react"

import { LoginForm } from "@/components/login-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  checkAuth,
  getToken,
  loginUser,
  logoutUser,
  subscribeAuthChanged,
  type AuthUser,
} from "@/lib/auth"
import {
  DEFAULT_AUTHENTICATED_ROUTE,
  DEFAULT_UNAUTHENTICATED_ROUTE,
  getBaseRoute,
  getPathFromLocation,
  isProtectedRoute,
  navigateTo,
  type AppRoute,
  type AppSection,
} from "@/lib/router"
import {
  getRouteForSection,
  getSectionFromRoute,
  getTitleFromRoute,
} from "@/lib/main-navigation"
import Shell from "@/pages/layout/shell"
import ContractPage from "@/pages/contract"
import DashboardPage from "@/pages/dashboard"
import HarmonogramPage from "@/pages/harmonogram"
import InstructorsPage from "@/pages/instructors"
import MePage from "@/pages/me"
import MembersPage from "@/pages/members"
import PublicAttendancePage from "@/pages/public-attendance"
import RolePage from "@/pages/role"
import SchedulePage from "@/pages/schedule"
import SeasonPage from "@/pages/season"
import ShelfPage from "@/pages/shelf"
import TrainingFormPage from "@/pages/training-form"
import TrainingSessionPage from "@/pages/training-session"
import TrainingSessionAttendancePage from "@/pages/training-session-attendance"
import TrainingSessionSheetPage from "@/pages/training-session-sheet"
import UserPage from "@/pages/user"
import CrudResourcePage from "@/pages/crud-resource-page"

const routeFromWindow = () => getPathFromLocation(window.location)
const AUTH_STORAGE_POLL_INTERVAL_MS = 1_000

function LoginScreen({
  error,
  isSubmitting,
  onLogin,
}: {
  error: string | null
  isSubmitting: boolean
  onLogin: (values: { identifier: string; password: string }) => Promise<void>
}) {
  const logoSrc = `${import.meta.env.BASE_URL}favicon.png`

  return (
    <main className="min-h-svh bg-background">
      <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(28rem,34rem)]">
        <section className="flex min-h-[42svh] flex-col justify-between border-b bg-sidebar p-6 text-sidebar-foreground lg:min-h-svh lg:border-r lg:border-b-0 lg:p-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-primary/10 shadow-xs">
                <img
                  src={logoSrc}
                  alt="Quartermaster logo"
                  className="size-8 object-contain"
                />
              </span>
              <div>
                <p className="text-sm font-medium text-sidebar-foreground/70">
                  Quartermaster CRM
                </p>
                <h1 className="text-xl font-semibold tracking-tight">
                  Club operations console
                </h1>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <div className="max-w-2xl py-10 lg:py-0">
            <p className="text-sm font-medium text-sidebar-foreground/65">
              Demo environment
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-sidebar-border bg-background/45 p-4">
                <p className="text-2xl font-semibold tabular-nums">300+</p>
                <p className="mt-1 text-sm text-sidebar-foreground/65">
                  seeded members
                </p>
              </div>
              <div className="rounded-lg border border-sidebar-border bg-background/45 p-4">
                <p className="text-2xl font-semibold tabular-nums">90d</p>
                <p className="mt-1 text-sm text-sidebar-foreground/65">
                  dashboard window
                </p>
              </div>
              <div className="rounded-lg border border-sidebar-border bg-background/45 p-4">
                <p className="text-2xl font-semibold tabular-nums">API</p>
                <p className="mt-1 text-sm text-sidebar-foreground/65">
                  resource views
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-sidebar-foreground/55">
            Local demo stack ready for review.
          </p>
        </section>

        <section className="flex items-center justify-center p-6 lg:p-10">
          <LoginForm
            className="w-full max-w-md"
            error={error}
            isSubmitting={isSubmitting}
            onLogin={onLogin}
          />
        </section>
      </div>
    </main>
  )
}

function NotFoundPage({ route }: { route: string }) {
  return (
    <div className="p-6">
      <div className="rounded-lg border bg-card p-6 text-card-foreground">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No Quartermaster view is registered for {route}.
        </p>
      </div>
    </div>
  )
}

function renderPage(route: string, user: AuthUser, onUserUpdate: (user: AuthUser) => void) {
  const baseRoute = getBaseRoute(route)

  switch (baseRoute) {
    case "/":
    case "/dashboard":
      return <DashboardPage />
    case "/contract":
      return <ContractPage currentRoute={route} />
    case "/member":
      return <MembersPage currentRoute={route} />
    case "/me":
      return <MePage user={user} onUserUpdate={onUserUpdate} />
    case "/instructor":
      return <InstructorsPage currentRoute={route} />
    case "/schedule":
      return <SchedulePage currentRoute={route} />
    case "/harmonogram":
      return <HarmonogramPage currentRoute={route} />
    case "/training-form":
      return <TrainingFormPage currentRoute={route} />
    case "/season":
      return <SeasonPage currentRoute={route} />
    case "/role":
      return <RolePage currentRoute={route} />
    case "/user":
      return <UserPage currentRoute={route} />
    case "/training-session":
      return <TrainingSessionPage currentRoute={route} />
    case "/training-session-attendance":
      return <TrainingSessionAttendancePage currentRoute={route} />
    case "/training-session-sheet":
      return <TrainingSessionSheetPage currentRoute={route} />
    case "/public-device-identity":
      return (
        <CrudResourcePage
          currentRoute={route}
          baseRoute="/public-device-identity"
          schemaRoute="/public-device-identity"
          entityLabel="Public device"
          emptyMessage="No public devices to display."
          detailTitleFields={["id", "assigned_member_id"]}
        />
      )
    case "/attendance-change-log":
      return (
        <CrudResourcePage
          currentRoute={route}
          baseRoute="/attendance-change-log"
          schemaRoute="/attendance-change-log"
          entityLabel="Attendance change"
          emptyMessage="No attendance change log records to display."
          detailTitleFields={["session_id", "member_id"]}
        />
      )
    case "/shelf":
    case "/shelf/racks":
    case "/shelf/shelves":
    case "/shelf/rentals":
    case "/shelf/plans":
      return <ShelfPage currentRoute={route} />
    default:
      return <NotFoundPage route={route} />
  }
}

export default function App() {
  const [route, setRoute] = React.useState(routeFromWindow)
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [isAuthLoading, setIsAuthLoading] = React.useState(true)
  const [isLoginSubmitting, setIsLoginSubmitting] = React.useState(false)
  const [loginError, setLoginError] = React.useState<string | null>(null)
  const lastAuthTokenRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const handlePopState = () => setRoute(routeFromWindow())
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  React.useEffect(() => {
    let isMounted = true
    let syncRequestId = 0

    const resolveUser = async () => {
      const requestId = ++syncRequestId
      lastAuthTokenRef.current = getToken()
      const currentUser = await checkAuth()
      if (!isMounted || requestId !== syncRequestId) {
        return
      }
      lastAuthTokenRef.current = getToken()
      setUser(currentUser)
      setIsAuthLoading(false)

      const currentRoute = routeFromWindow()
      if (currentUser && currentRoute === DEFAULT_UNAUTHENTICATED_ROUTE) {
        navigateTo(DEFAULT_AUTHENTICATED_ROUTE, { replace: true })
      }
      if (!currentUser && isProtectedRoute(currentRoute)) {
        navigateTo(DEFAULT_UNAUTHENTICATED_ROUTE, { replace: true })
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage) {
        void resolveUser()
      }
    }

    const handleFocus = () => {
      void resolveUser()
    }

    const authTokenPoll = window.setInterval(() => {
      const token = getToken()
      if (token !== lastAuthTokenRef.current) {
        void resolveUser()
      }
    }, AUTH_STORAGE_POLL_INTERVAL_MS)
    const unsubscribeAuthChanged = subscribeAuthChanged(() => {
      void resolveUser()
    })

    window.addEventListener("storage", handleStorage)
    window.addEventListener("focus", handleFocus)
    void resolveUser()

    return () => {
      isMounted = false
      window.clearInterval(authTokenPoll)
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("focus", handleFocus)
      unsubscribeAuthChanged()
    }
  }, [])

  const handleLogin = React.useCallback(
    async ({ identifier, password }: { identifier: string; password: string }) => {
      setIsLoginSubmitting(true)
      setLoginError(null)
      try {
        const nextUser = await loginUser({
          username: identifier,
          password,
        })
        setUser(nextUser)
        navigateTo(DEFAULT_AUTHENTICATED_ROUTE, { replace: true })
      } catch (error) {
        setLoginError(
          error instanceof Error ? error.message : "Unable to sign in."
        )
      } finally {
        setIsLoginSubmitting(false)
      }
    },
    []
  )

  const handleLogout = React.useCallback(() => {
    logoutUser()
    setUser(null)
    navigateTo(DEFAULT_UNAUTHENTICATED_ROUTE, { replace: true })
  }, [])

  const handleSectionChange = React.useCallback((section: AppSection) => {
    navigateTo(getRouteForSection(section))
  }, [])

  const baseRoute = getBaseRoute(route)
  const isPublicRoute = baseRoute === "/public/attendance"

  let content: React.ReactNode
  if (isPublicRoute) {
    content = <PublicAttendancePage />
  } else if (isAuthLoading) {
    content = <div className="p-6 text-sm text-muted-foreground">Loading...</div>
  } else if (!user || route === DEFAULT_UNAUTHENTICATED_ROUTE) {
    content = (
      <LoginScreen
        error={loginError}
        isSubmitting={isLoginSubmitting}
        onLogin={handleLogin}
      />
    )
  } else {
    const activeSection = getSectionFromRoute(route)
    const title = getTitleFromRoute(route)
    content = (
      <Shell
        user={{ email: user.email, name: user.username }}
        onLogout={handleLogout}
        title={title}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      >
        {renderPage(route as AppRoute, user, setUser)}
      </Shell>
    )
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="quartermaster-theme">
      <TooltipProvider>
        {content}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
