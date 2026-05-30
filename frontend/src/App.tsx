import * as React from "react"

import { LoginForm } from "@/components/login-form"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { checkAuth, loginUser, logoutUser, type AuthUser } from "@/lib/auth"
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

function LoginScreen({
  error,
  isSubmitting,
  onLogin,
}: {
  error: string | null
  isSubmitting: boolean
  onLogin: (values: { identifier: string; password: string }) => Promise<void>
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <LoginForm
        className="w-full max-w-sm"
        error={error}
        isSubmitting={isSubmitting}
        onLogin={onLogin}
      />
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

  React.useEffect(() => {
    const handlePopState = () => setRoute(routeFromWindow())
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  React.useEffect(() => {
    let isMounted = true

    const resolveUser = async () => {
      const currentUser = await checkAuth()
      if (!isMounted) {
        return
      }
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

    void resolveUser()

    return () => {
      isMounted = false
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
          error instanceof Error ? error.message : "Nie udało się zalogować."
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
