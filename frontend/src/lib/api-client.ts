export const DEFAULT_TOKEN_STORAGE_KEY = "access_token"

export type QueryParamValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryParamValue>

type RequestOptions = {
  auth?: boolean
  allowRefresh?: boolean
  authToken?: string
  headers?: HeadersInit
  query?: QueryParams
  params?: QueryParams
  signal?: AbortSignal
  responseType?: "json" | "blob" | "text"
}

type RefreshAuthTokenHandler = () => Promise<string | null>

export class ApiError extends Error {
  status: number
  data: unknown
  detail: any

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
    this.detail =
      data && typeof data === "object" && "detail" in data
        ? (data as { detail: unknown }).detail
        : undefined
  }
}

export class ApiValidationError extends ApiError {}

let refreshAuthTokenHandler: RefreshAuthTokenHandler | null = null

export function setApiRefreshAuthTokenHandler(
  handler: RefreshAuthTokenHandler | null
) {
  refreshAuthTokenHandler = handler
}

const getBaseUrl = () => {
  const explicitBaseUrl = import.meta.env.VITE_API_BASE_URL as
    | string
    | undefined
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, "")
  }

  return `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/api`
}

const isAbsoluteUrl = (path: string) => /^https?:\/\//i.test(path)

const appendQuery = (url: URL, query?: QueryParams) => {
  if (!query) {
    return
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return
    }
    url.searchParams.set(key, String(value))
  })
}

const getStoredToken = () =>
  typeof window === "undefined"
    ? null
    : window.localStorage.getItem(DEFAULT_TOKEN_STORAGE_KEY)

const getErrorMessage = (data: unknown, fallback: string) => {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === "string") {
      return detail
    }
  }
  return fallback
}

export class ApiClient {
  readonly baseUrl: string

  constructor(baseUrl = getBaseUrl()) {
    this.baseUrl = baseUrl
  }

  private resolveUrl(path: string, options: RequestOptions = {}) {
    const base = isAbsoluteUrl(path)
      ? path
      : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`
    const url = new URL(base, window.location.origin)
    appendQuery(url, options.query ?? options.params)
    return url
  }

  private async parseResponse(response: Response, responseType = "json") {
    if (response.status === 204) {
      return null
    }
    if (responseType === "blob") {
      return response.blob()
    }
    if (responseType === "text") {
      return response.text()
    }

    const text = await response.text()
    return text ? JSON.parse(text) : null
  }

  private buildRequestInit<TPayload>(
    method: string,
    payload?: TPayload,
    options: RequestOptions = {}
  ): RequestInit {
    const headers = new Headers(options.headers)
    const authEnabled = options.auth ?? true
    const token = options.authToken ?? (authEnabled ? getStoredToken() : null)

    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }

    let body: BodyInit | undefined
    if (payload instanceof URLSearchParams) {
      body = payload
      headers.set("Content-Type", "application/x-www-form-urlencoded")
    } else if (payload instanceof FormData) {
      body = payload
    } else if (payload !== undefined) {
      body = JSON.stringify(payload)
      headers.set("Content-Type", "application/json")
    }

    return {
      method,
      headers,
      body,
      signal: options.signal,
    }
  }

  async request<TResponse, TPayload = unknown>(
    method: string,
    path: string,
    payload?: TPayload,
    options: RequestOptions = {}
  ): Promise<TResponse> {
    const url = this.resolveUrl(path, options)
    const response = await fetch(
      url,
      this.buildRequestInit(method, payload, options)
    )

    if (response.status === 401 && options.allowRefresh !== false) {
      const refreshedToken = await refreshAuthTokenHandler?.()
      if (refreshedToken) {
        const retryResponse = await fetch(
          url,
          this.buildRequestInit(method, payload, {
            ...options,
            authToken: refreshedToken,
            allowRefresh: false,
          })
        )
        return this.handleResponse<TResponse>(retryResponse, options)
      }
    }

    return this.handleResponse<TResponse>(response, options)
  }

  private async handleResponse<TResponse>(
    response: Response,
    options: RequestOptions
  ): Promise<TResponse> {
    const data = await this.parseResponse(response, options.responseType)
    if (!response.ok) {
      const ErrorClass = response.status === 422 ? ApiValidationError : ApiError
      throw new ErrorClass(
        getErrorMessage(data, response.statusText),
        response.status,
        data
      )
    }
    return data as TResponse
  }

  get<TResponse>(path: string, options?: RequestOptions) {
    return this.request<TResponse>("GET", path, undefined, options)
  }

  post<TResponse, TPayload = unknown>(
    path: string,
    payload?: TPayload,
    options?: RequestOptions
  ) {
    return this.request<TResponse, TPayload>("POST", path, payload, options)
  }

  put<TResponse, TPayload = unknown>(
    path: string,
    payload?: TPayload,
    options?: RequestOptions
  ) {
    return this.request<TResponse, TPayload>("PUT", path, payload, options)
  }

  patch<TResponse, TPayload = unknown>(
    path: string,
    payload?: TPayload,
    options?: RequestOptions
  ) {
    return this.request<TResponse, TPayload>("PATCH", path, payload, options)
  }

  delete<TResponse>(path: string, options?: RequestOptions) {
    return this.request<TResponse>("DELETE", path, undefined, options)
  }
}

export const api = new ApiClient()

const axiosCompat = {
  get: async <TResponse>(path: string, options?: RequestOptions) => ({
    data: await api.get<TResponse>(path, options),
  }),
  post: async <TResponse, TPayload = unknown>(
    path: string,
    payload?: TPayload,
    options?: RequestOptions
  ) => ({
    data: await api.post<TResponse, TPayload>(path, payload, options),
  }),
  put: async <TResponse, TPayload = unknown>(
    path: string,
    payload?: TPayload,
    options?: RequestOptions
  ) => ({
    data: await api.put<TResponse, TPayload>(path, payload, options),
  }),
  patch: async <TResponse, TPayload = unknown>(
    path: string,
    payload?: TPayload,
    options?: RequestOptions
  ) => ({
    data: await api.patch<TResponse, TPayload>(path, payload, options),
  }),
  delete: async <TResponse>(path: string, options?: RequestOptions) => ({
    data: await api.delete<TResponse>(path, options),
  }),
}

export default axiosCompat
