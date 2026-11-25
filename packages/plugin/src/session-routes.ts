import type { IncomingMessage, ServerResponse } from 'node:http'
import { pluginResponseHeaders, redactSensitiveText, trustedPluginRequest } from '@dsh-deepseek-web/compat'
import { hostRejection, type HostConnection } from './auth-routes.ts'
import type { PluginWebServer } from './auth-routes.ts'
import type { RemoteSessionService } from './remote-session-service.ts'
import { PluginSessionError } from './dsh-session.ts'
import { ERROR_CODES } from './errors.ts'

export const SESSIONS_PATH = '/plugins/dsh-deepseek-web/sessions'
export const FORK_PATH = '/plugins/dsh-deepseek-web/fork'

const MAX_SESSION_ID = 128
const MAX_CURSOR = 512
const MAX_BODY = 4096

function write(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  const headers = pluginResponseHeaders()
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  res.statusCode = status
  res.end(json)
}

function forbidden(res: ServerResponse): void {
  write(res, 403, { error: 'forbidden' })
}

async function readBody(req: IncomingMessage, limit = MAX_BODY): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    total += (chunk as Buffer).length
    if (total > limit) throw new PluginSessionError('body too large', ERROR_CODES.PROTOCOL)
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function parseJsonObject(raw: string): Record<string, unknown> {
  if (raw.length === 0) return {}
  try {
    const value = JSON.parse(raw) as unknown
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new PluginSessionError('invalid json', ERROR_CODES.PROTOCOL)
    }
    return value as Record<string, unknown>
  } catch (error) {
    if (error instanceof PluginSessionError) throw error
    throw new PluginSessionError('invalid json', ERROR_CODES.PROTOCOL)
  }
}

function requestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
}

function boundId(value: string, label: string): string {
  const trimmed = decodeURIComponent(value).trim()
  if (trimmed.length === 0 || trimmed.length > MAX_SESSION_ID) {
    throw new PluginSessionError(`invalid ${label}`, ERROR_CODES.PROTOCOL)
  }
  return trimmed
}

function statusFor(code: string): number {
  if (code === ERROR_CODES.MISSING_CREDENTIAL || code === ERROR_CODES.REAUTH_REQUIRED) return 401
  if (code === ERROR_CODES.REMOTE_SESSION_NOT_FOUND || code === ERROR_CODES.FORK_SOURCE_NOT_FOUND
    || code === ERROR_CODES.FORK_MESSAGE_NOT_FOUND || code === ERROR_CODES.FORK_WORKSPACE_NOT_FOUND) {
    return 404
  }
  if (code === ERROR_CODES.FORK_MESSAGE_NOT_DEEPSEEK_WEB || code === ERROR_CODES.FORK_OPEN_TURN
    || code === ERROR_CODES.FORK_INCOMPATIBLE_SESSION || code === ERROR_CODES.MIRROR_ALREADY_CONFLICTED) {
    return 409
  }
  if (code === ERROR_CODES.PROTOCOL || code === ERROR_CODES.REMOTE_HISTORY_INVALID
    || code === ERROR_CODES.REMOTE_HISTORY_INCOMPLETE) {
    return 400
  }
  return 500
}

function fail(res: ServerResponse, error: unknown): void {
  const code = error instanceof PluginSessionError ? error.code : ERROR_CODES.HTTP
  const message = redactSensitiveText(error instanceof Error ? error.message : String(error))
  write(res, statusFor(code), { error: message, code })
}

function abortFrom(req: IncomingMessage): AbortController {
  const controller = new AbortController()
  if (typeof req.once === 'function') req.once('close', () => controller.abort())
  return controller
}

export function registerSessionRoutes(
  webServer: PluginWebServer,
  service: RemoteSessionService,
  connection: () => HostConnection | undefined,
): () => void {
  const wrap = (
    mutating: boolean,
    fn: (req: IncomingMessage, res: ServerResponse, signal?: AbortSignal) => Promise<void>,
  ) =>
    async (req: IncomingMessage, res: ServerResponse) => {
      const rejection = hostRejection(req, connection())
      if (rejection !== undefined) {
        write(res, rejection, { error: 'host authentication required' })
        return
      }
      if (!trustedPluginRequest(req)) {
        forbidden(res)
        return
      }
      const controller = mutating ? undefined : abortFrom(req)
      try {
        await fn(req, res, controller?.signal)
      } catch (error) {
        if (controller?.signal.aborted) return
        fail(res, error)
      }
    }

  const dispatchSessions = async (req: IncomingMessage, res: ServerResponse, signal?: AbortSignal) => {
    const url = requestUrl(req)
    const rest = url.pathname.slice(SESSIONS_PATH.length)
    if (req.method === 'GET' && (rest === '' || rest === '/')) {
      const cursor = url.searchParams.get('cursor') ?? undefined
      if (cursor !== undefined && cursor.length > MAX_CURSOR) {
        throw new PluginSessionError('invalid cursor', ERROR_CODES.PROTOCOL)
      }
      const limitRaw = url.searchParams.get('limit')
      const limit = limitRaw === null ? undefined : Number(limitRaw)
      if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
        throw new PluginSessionError('invalid limit', ERROR_CODES.PROTOCOL)
      }
      write(res, 200, await service.listSessions({
        cursor,
        limit,
        refresh: url.searchParams.get('refresh') === '1',
        signal,
      }))
      return
    }
    const history = rest.match(/^\/([^/]+)\/history$/)
    if (req.method === 'GET' && history) {
      write(res, 200, await service.fetchHistory(boundId(history[1]!, 'session id'), {
        refresh: url.searchParams.get('refresh') === '1',
        signal,
      }))
      return
    }
    const materialize = rest.match(/^\/([^/]+)\/materialize$/)
    if (req.method === 'POST' && materialize) {
      const id = boundId(materialize[1]!, 'session id')
      await readBody(req)
      write(res, 200, await service.materialize(id))
      return
    }
    if (req.method === 'GET' || req.method === 'POST') {
      write(res, 404, { error: 'not found', code: ERROR_CODES.PROTOCOL })
      return
    }
    write(res, 405, { error: 'method not allowed' })
  }

  const sessions = async (req: IncomingMessage, res: ServerResponse) => {
    await wrap(req.method !== 'GET', dispatchSessions)(req, res)
  }

  const fork = wrap(true, async (req, res) => {
    if (req.method !== 'POST') {
      write(res, 405, { error: 'method not allowed' })
      return
    }
    const body = parseJsonObject(await readBody(req))
    if (typeof body.sourceSessionId !== 'string' || typeof body.messageId !== 'string' || typeof body.workspaceId !== 'string') {
      throw new PluginSessionError('invalid fork request', ERROR_CODES.PROTOCOL)
    }
    write(res, 200, await service.fork({
      sourceSessionId: boundId(body.sourceSessionId, 'session id'),
      messageId: boundId(body.messageId, 'message id'),
      workspaceId: boundId(body.workspaceId, 'workspace id'),
    }))
  })

  const disposers = [
    webServer.register({ kind: 'prefix', auth: 'anonymous', path: SESSIONS_PATH, handler: sessions }),
    webServer.register({ kind: 'exact', auth: 'anonymous', path: FORK_PATH, handler: fork }),
  ]
  return () => {
    for (const dispose of disposers) dispose()
  }
}
