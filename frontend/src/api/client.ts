/**
 * The single place HTTP happens. Attaches the JWT, unwraps the backend's error shape into
 * a typed {@link ApiError}, and routes 401s to one handler so no caller has to think about
 * an expired token.
 */

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

let authToken: string | null = null
let unauthorizedHandler: ((reason?: string) => void) | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

/**
 * Registered by AuthProvider. Lives here rather than in a component because a token can
 * expire during any request, and every one of them needs the same response.
 */
export function setUnauthorizedHandler(handler: ((reason?: string) => void) | null): void {
  unauthorizedHandler = handler
}

/** Mirrors the backend's GlobalExceptionHandler body. */
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }

  /** The first field-level message, for forms that show a single error line. */
  get firstFieldError(): string | undefined {
    return Object.values(this.fieldErrors)[0]
  }
}

/**
 * The backend's own message when there is one, and a fixed fallback otherwise — a raw
 * `Error.message` from fetch or a JSON parse is never something to put in front of a user.
 */
export function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback
}

export type QueryValue = string | number | boolean | undefined | null | (string | number)[]

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, QueryValue>
}

function buildQuery(query: Record<string, QueryValue> | undefined): string {
  if (!query) return ''

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      // Repeated key, e.g. ?status=SUBMITTED&status=DRAFT - which is what the backend binds.
      value.forEach((entry) => params.append(key, String(entry)))
    } else {
      params.append(key, String(value))
    }
  }

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // fetch only rejects on a transport failure, so this is genuinely "server unreachable".
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?')
  }

  if (response.status === 204) {
    return undefined as T
  }

  const raw = await response.text()
  const payload: unknown = raw ? safeParse(raw) : null

  if (!response.ok) {
    if (response.status === 401) {
      /*
       * The server's own message is passed on, because the two situations that reach a 401
       * need different words: an expired session, and access that a manager changed under
       * the user. Being dropped at the login screen with no explanation reads as a bug -
       * especially when it was deliberate.
       */
      unauthorizedHandler?.(toApiError(response.status, payload).message)
    }
    throw toApiError(response.status, payload)
  }

  return payload as T
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  if (payload && typeof payload === 'object') {
    const body = payload as { message?: unknown; fieldErrors?: unknown }
    const message = typeof body.message === 'string' ? body.message : defaultMessage(status)
    const fieldErrors =
      body.fieldErrors && typeof body.fieldErrors === 'object'
        ? (body.fieldErrors as Record<string, string>)
        : {}
    return new ApiError(status, message, fieldErrors)
  }
  return new ApiError(status, defaultMessage(status))
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have access to this.'
  if (status === 404) return 'Not found.'
  return 'Something went wrong.'
}
