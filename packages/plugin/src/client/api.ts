export const STATUS_PATH = '/plugins/dsh-deepseek-web/auth/status'
export const LOGIN_PATH = '/plugins/dsh-deepseek-web/auth/login'
export const CANCEL_PATH = '/plugins/dsh-deepseek-web/auth/cancel'
export const LOGOUT_PATH = '/plugins/dsh-deepseek-web/auth/logout'
export const DOCTOR_PATH = '/plugins/dsh-deepseek-web/doctor'
export const SESSIONS_PATH = '/plugins/dsh-deepseek-web/sessions'
export const FORK_PATH = '/plugins/dsh-deepseek-web/fork'
export const WEBPANEL_TOKEN_PATH = '/plugins/dsh-deepseek-web/webpanel/token'
export const IMPORT_PATH = '/plugins/dsh-deepseek-web/auth/import'

/** Pushes a token captured inside the web panel back to the Host credential store. */
export async function importTokenFromPanel(token: string): Promise<void> {
  await pluginFetch(IMPORT_PATH, { method: 'POST', body: JSON.stringify({ token }) })
}

export class PluginApiError extends Error {
  readonly code?: string
  readonly status: number
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'PluginApiError'
    this.status = status
    this.code = code
  }
}

export function sessionsListPath(options?: { cursor?: string; limit?: number; refresh?: boolean }): string {
  const params = new URLSearchParams()
  if (options?.cursor) params.set('cursor', options.cursor)
  if (options?.limit !== undefined) params.set('limit', String(options.limit))
  if (options?.refresh === true) params.set('refresh', '1')
  const query = params.toString()
  return query.length === 0 ? SESSIONS_PATH : `${SESSIONS_PATH}?${query}`
}

export function materializePath(chatSessionId: string): string {
  return `${SESSIONS_PATH}/${encodeURIComponent(chatSessionId)}/materialize`
}

export async function pluginFetch(path: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers)
  if (!headers.has('accept')) headers.set('accept', 'application/json')
  if (init?.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const response = await fetch(path, { credentials: 'same-origin', ...init, headers })
  const text = await response.text()
  let body: unknown = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      throw new PluginApiError(`DeepSeek Web ${path} returned ${response.status}`, response.status)
    }
  }
  if (!response.ok) {
    const record = body as { error?: string; code?: string } | null
    throw new PluginApiError(
      record?.error ?? `DeepSeek Web ${path} returned ${response.status}`,
      response.status,
      record?.code,
    )
  }
  return body
}
