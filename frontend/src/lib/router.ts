export const APP_SECTIONS = [
  "panel",
  "contract",
  "member",
  "instructor",
  "schedule",
  "harmonogram",
  "training-form",
  "season",
  "role",
  "user",
  "training-session",
  "training-session-attendance",
  "training-session-sheet",
  "public-device-identity",
  "attendance-change-log",
  "rack",
  "shelf",
  "shelf-rental",
  "shelf-plan",
] as const
export type AppSection = (typeof APP_SECTIONS)[number]

export const APP_ROUTES = [
  "/",
  "/dashboard",
  "/contract",
  "/member",
  "/login",
  "/me",
  "/instructor",
  "/schedule",
  "/harmonogram",
  "/training-form",
  "/season",
  "/role",
  "/user",
  "/training-session",
  "/training-session-attendance",
  "/training-session-sheet",
  "/public/attendance",
  "/public-device-identity",
  "/attendance-change-log",
  "/shelf",
  "/shelf/racks",
  "/shelf/shelves",
  "/shelf/rentals",
  "/shelf/plans",
] as const

export type AppRoute = (typeof APP_ROUTES)[number]

export const DEFAULT_AUTHENTICATED_ROUTE: AppRoute = "/dashboard"
export const DEFAULT_UNAUTHENTICATED_ROUTE: AppRoute = "/login"
export const PROTECTED_APP_ROUTES = [
  "/dashboard",
  "/contract",
  "/member",
  "/me",
  "/instructor",
  "/schedule",
  "/harmonogram",
  "/training-form",
  "/season",
  "/role",
  "/user",
  "/training-session",
  "/training-session-attendance",
  "/training-session-sheet",
  "/public-device-identity",
  "/attendance-change-log",
  "/shelf",
  "/shelf/racks",
  "/shelf/shelves",
  "/shelf/rentals",
  "/shelf/plans",
] as const

const routeSet = new Set<string>(APP_ROUTES)
const protectedRouteSet = new Set<string>(PROTECTED_APP_ROUTES)

const normalizeRoute = (value: string) => {
  if (!value) {
    return "/"
  }

  const withoutQuery = value.split("?")[0].split("#")[0]
  const withLeadingSlash = withoutQuery.startsWith("/")
    ? withoutQuery
    : `/${withoutQuery}`
  const trimmed = withLeadingSlash.replace(/\/+$/, "")

  return trimmed.length === 0 ? "/" : trimmed
}

const getBasePath = () => {
  const raw = (import.meta.env.BASE_URL as string | undefined) ?? "/"
  const normalized = raw.replace(/\/+$/, "")
  return normalized.length === 0 ? "/" : normalized
}

const fromHash = (hash: string) => {
  if (!hash.startsWith("#")) {
    return null
  }

  const raw = hash.slice(1)
  return normalizeRoute(raw.length === 0 ? "/" : raw)
}

const fromPathname = (pathname: string) => {
  const basePath = getBasePath()
  let currentPath = pathname || "/"

  if (basePath !== "/" && currentPath.startsWith(basePath)) {
    currentPath = currentPath.slice(basePath.length) || "/"
  }

  return normalizeRoute(currentPath)
}

export const toAppHref = (route: string) => {
  const basePath = getBasePath()
  if (basePath === "/") {
    return route
  }
  return route === "/" ? `${basePath}/` : `${basePath}${route}`
}

export const getPathFromLocation = (
  location: Pick<Location, "pathname" | "hash">
) => {
  const hashRoute = fromHash(location.hash)
  if (hashRoute) {
    return hashRoute
  }

  return fromPathname(location.pathname)
}

export const getBaseRoute = (route: string): AppRoute | null => {
  const normalizedRoute = normalizeRoute(route)

  if (routeSet.has(normalizedRoute)) {
    return normalizedRoute as AppRoute
  }

  const matchedRoute = [...APP_ROUTES]
    .filter((candidate) => candidate !== "/" && normalizedRoute.startsWith(`${candidate}/`))
    .sort((left, right) => right.length - left.length)[0]

  return matchedRoute ?? null
}

export const isProtectedRoute = (route: string) => {
  const baseRoute = getBaseRoute(route)
  return baseRoute ? protectedRouteSet.has(baseRoute) : false
}

export const getRouteFromLocation = (
  location: Pick<Location, "pathname" | "hash">
): AppRoute | null => getBaseRoute(getPathFromLocation(location))

export const navigateTo = (
  route: string,
  options?: { replace?: boolean }
) => {
  const nextUrl = toAppHref(route)

  if (options?.replace) {
    window.history.replaceState(null, "", nextUrl)
  } else {
    window.history.pushState(null, "", nextUrl)
  }

  window.dispatchEvent(new PopStateEvent("popstate"))
}
