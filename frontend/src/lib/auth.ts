import {
  api,
  DEFAULT_TOKEN_STORAGE_KEY,
  setApiRefreshAuthTokenHandler,
} from "@/lib/api-client"
import type { components } from "@/types/api.generated"

export type Role = components["schemas"]["RoleResponse"]

export type AuthUser = components["schemas"]["UserResponse"]

type LoginRequest =
  components["schemas"]["Body_login_for_access_token_api_auth_login_post"]

export type LoginPayload = Pick<LoginRequest, "username" | "password"> &
  Partial<Pick<LoginRequest, "scope" | "client_id" | "client_secret">>

type TokenResponse = components["schemas"]["Token"] & {
  refresh_token?: string | null
}
type RefreshTokenPayload = {
  refresh_token: string
}

const AUTH_TOKEN_KEY = DEFAULT_TOKEN_STORAGE_KEY
const AUTH_REFRESH_TOKEN_KEY =
  (import.meta.env.VITE_AUTH_REFRESH_TOKEN_KEY as string | undefined) ??
  "refresh_token"
const AUTH_EVENT = "auth-changed"
let refreshInFlightPromise: Promise<string | null> | null = null

export const AUTH_CHECK_INTERVAL_MS = 5 * 60 * 1000

export function getToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

function getRefreshToken() {
  return window.localStorage.getItem(AUTH_REFRESH_TOKEN_KEY)
}

function setToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

function setRefreshToken(token: string) {
  window.localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, token)
}

function clearStoredTokens() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
  window.localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY)
}

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function subscribeAuthChanged(handler: () => void) {
  window.addEventListener(AUTH_EVENT, handler)
  return () => window.removeEventListener(AUTH_EVENT, handler)
}

export async function fetchCurrentUser(token: string) {
  return api.get<AuthUser>("/auth/me", {
    authToken: token,
  })
}

export async function loginUser({ username, password }: LoginPayload) {
  const formData = new URLSearchParams()
  formData.append("username", username.trim())
  formData.append("password", password)
  formData.append("scope", "")

  const data = await api.post<TokenResponse>("/auth/login", formData, {
    auth: false,
    allowRefresh: false,
  })
  if (!data.access_token) {
    throw new Error("Missing token")
  }

  setToken(data.access_token)
  if (data.refresh_token) {
    setRefreshToken(data.refresh_token)
  } else {
    window.localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY)
  }
  notifyAuthChanged()
  return fetchCurrentUser(data.access_token)
}

async function runRefreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearStoredTokens()
    notifyAuthChanged()
    return null
  }

  try {
    const data = await api.post<TokenResponse, RefreshTokenPayload>(
      "/auth/refresh",
      { refresh_token: refreshToken },
      {
        auth: false,
        allowRefresh: false,
      }
    )
    if (!data.access_token) {
      clearStoredTokens()
      notifyAuthChanged()
      return null
    }

    setToken(data.access_token)
    if (data.refresh_token) {
      setRefreshToken(data.refresh_token)
    } else {
      window.localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY)
    }
    notifyAuthChanged()
    return data.access_token
  } catch {
    clearStoredTokens()
    notifyAuthChanged()
    return null
  }
}

export async function refreshAccessToken() {
  if (!refreshInFlightPromise) {
    refreshInFlightPromise = runRefreshAccessToken().finally(() => {
      refreshInFlightPromise = null
    })
  }

  return refreshInFlightPromise
}

export async function checkAuth() {
  const token = getToken()
  if (!token) {
    return null
  }

  try {
    return await fetchCurrentUser(token)
  } catch {
    clearStoredTokens()
    notifyAuthChanged()
    return null
  }
}

export function logoutUser() {
  clearStoredTokens()
  notifyAuthChanged()
}

setApiRefreshAuthTokenHandler(refreshAccessToken)
