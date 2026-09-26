import type { ApiErrorBody } from '@domain/api.ts'

/** An API failure with the server's user-facing message (safe to show verbatim). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** Per-field messages from a 400 VALIDATION response, if any. */
  get fieldErrors(): Record<string, string[] | undefined> {
    const d = this.details as { fields?: Record<string, string[]> } | undefined
    return d?.fields ?? {}
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export async function api<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Can’t reach the server. Check your connection and try again.')
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : undefined
  if (!res.ok) {
    const err = (data as ApiErrorBody | undefined)?.error
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? `Request failed (${res.status}).`, err?.details)
  }
  return data as T
}

/** Build a query string from defined, non-empty values. */
export function qs(params: Record<string, string | number | null | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : ''
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')
