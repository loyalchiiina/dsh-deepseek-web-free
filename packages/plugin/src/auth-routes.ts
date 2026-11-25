import type { IncomingMessage, ServerResponse } from 'node:http'
import { pluginResponseHeaders, redactSensitiveText, trustedPluginRequest } from '@dsh-deepseek-web/compat'
import type { DeepSeekWebService } from './service.ts'

export const AUTH_STATUS_PATH = '/plugins/dsh-deepseek-web/auth/status'
export const AUTH_LOGIN_PATH = '/plugins/dsh-deepseek-web/auth/login'
export const AUTH_CANCEL_PATH = '/plugins/dsh-deepseek-web/auth/cancel'
export const AUTH_LOGOUT_PATH = '/plugins/dsh-deepseek-web/auth/logout'
export const ACCOUNT_PATH = '/plugins/dsh-deepseek-web/account'
export const DOCTOR_PATH = '/plugins/dsh-deepseek-web/doctor'
/**
 * Hands the stored DeepSeek web session token to the DSH renderer so the
 * embedded web panel can seed `localStorage.userToken` inside its own guest
 * partition. Same-origin only: trustedPluginRequest() rejects anything that is
 * not a loopback request issued by the DSH app itself.
 */
export const WEBPANEL_TOKEN_PATH = '/plugins/dsh-deepseek-web/webpanel/token'
/**
 * Reverse hand-off: the embedded web panel captured a session token while the
 * user signed in inside the guest, and posts it here so the Host stores the same
 * account permanently (settings page, model list and the next restart all reuse
 * it). Same-origin only, exactly like the token hand-out above.
 */
export const AUTH_IMPORT_PATH = '/plugins/dsh-deepseek-web/auth/import'

export interface PluginWebServer {
  /**
   * `auth` is understood by DSH >=0.2.3-alpha.x (WebServer policies); older
   * kernels (<=0.2.2-rc.x) ignore unknown fields, so declaring it is downward
   * compatible. These routes are protected by hostRejection() +
   * trustedPluginRequest() in the handler, hence 'anonymous' here prevents the
   * new kernel's default `required` policy from rejecting token seeding.
   */
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    auth?: 'anonymous' | 'required' | 'deny'
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

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

/** Minimal shape of DSH's Host `connection` service (implementation-level API). */
export interface HostConnection {
  /** 0.2.2-rc.x and earlier: Host/Origin fence gate. */
  requestRejection?(req: IncomingMessage): 401 | 403 | undefined
  /**
   * 0.2.3-alpha.x and later: requestRejection was removed; WebServer owns the
   * route fence. `admit()` also performs credential verification, so plugins
   * whose routes declare `auth: 'anonymous'` must NOT call it here (that would
   * reject the webview guest, which carries no DSH API Cookie). Its presence
   * only proves the new kernel is running.
   */
  admit?(req: IncomingMessage): unknown
}

/**
 * Ask the Host Connection service for its admission decision, compatible with
 * both kernel generations:
 * - old kernel (<=0.2.2-rc.x): call requestRejection() and honour its status.
 * - new kernel (>=0.2.3-alpha.x): requestRejection was removed in favour of
 *   WebServer `auth` policies. Routes here declare `auth: 'anonymous'`, which
 *   already runs the active Connection source check in the kernel; the plugin's
 *   own trustedPluginRequest() is the second same-origin layer. Returning
 *   undefined here defers to those two layers instead of double-verifying
 *   credentials (admit() would 401 the token-seeding webview request).
 *
 * Fail closed only when neither generation's API is present: an unknown kernel
 * must never be treated as "allow".
 */
export function hostRejection(req: IncomingMessage, connection: HostConnection | undefined): number | undefined {
  if (connection === undefined || connection === null) return 503
  const gate = connection.requestRejection
  if (typeof gate === 'function') {
    try {
      return gate.call(connection, req) ?? undefined
    } catch {
      return 503
    }
  }
  // New kernel: anonymous route + kernel source fence + trustedPluginRequest.
  if (typeof connection.admit === 'function') return undefined
  return 503
}

async function readBody(req: IncomingMessage, limit = 4096): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    total += (chunk as Buffer).length
    if (total > limit) throw new Error('body too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export function registerAuthRoutes(
  webServer: PluginWebServer,
  service: DeepSeekWebService,
  connection: () => HostConnection | undefined,
): () => void {
  const handler = (method: string, fn: (req: IncomingMessage, res: ServerResponse) => Promise<void>) =>
    async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== method) {
        write(res, 405, { error: 'method not allowed' })
        return
      }
      const rejection = hostRejection(req, connection())
      if (rejection !== undefined) {
        write(res, rejection, { error: 'host authentication required' })
        return
      }
      if (!trustedPluginRequest(req)) {
        forbidden(res)
        return
      }
      try {
        await fn(req, res)
      } catch (error) {
        write(res, 500, { error: redactSensitiveText(error instanceof Error ? error.message : String(error)) })
      }
    }

  const disposers = [
    webServer.register({
      kind: 'exact',
      auth: 'anonymous',
      path: AUTH_STATUS_PATH,
      handler: handler('GET', async (_req, res) => write(res, 200, await service.status())),
    }),
    webServer.register({
      kind: 'exact',
      auth: 'anonymous',
      path: AUTH_LOGIN_PATH,
      handler: handler('POST', async (req, res) => {
        const raw = await readBody(req)
        const body = raw.length > 0 ? JSON.parse(raw) as { resetProfile?: boolean } : {}
        void service.login({ resetProfile: body.resetProfile === true }).catch(() => undefined)
        write(res, 200, await service.status())
      }),
    }),
    webServer.register({
      kind: 'exact',
      auth: 'anonymous',
      path: AUTH_IMPORT_PATH,
      handler: handler('POST', async (req, res) => {
        const raw = await readBody(req)
        const body = raw.length > 0 ? JSON.parse(raw) as { token?: unknown } : {}
        const token = typeof body.token === 'string' ? body.token : ''
        if (token.length === 0) {
          write(res, 400, { error: 'token is required' })
          return
        }
        try {
          write(res, 200, { ok: true, status: await service.importToken(token) })
        } catch (error) {
          write(res, 400, { error: redactSensitiveText(error instanceof Error ? error.message : String(error)) })
        }
      }),
    }),
    webServer.register({
      kind: 'exact',
      auth: 'anonymous',
      path: AUTH_CANCEL_PATH,
      handler: handler('POST', async (req, res) => {
        await readBody(req)
        await service.cancel()
        write(res, 200, { ok: true })
      }),
    }),
    webServer.register({
      kind: 'exact',
      auth: 'anonymous',
      path: AUTH_LOGOUT_PATH,
      handler: handler('POST', async (req, res) => {
        const raw = await readBody(req)
        const body = raw.length > 0 ? JSON.parse(raw) as { clearProfile?: boolean } : {}
        await service.logout(body.clearProfile !== false)
        write(res, 200, { ok: true })
      }),
    }),
    webServer.register({
      kind: 'exact',
      auth: 'anonymous',
      path: ACCOUNT_PATH,
      handler: handler('GET', async (_req, res) => {
        const status = await service.status()
        write(res, 200, status.status === 'signed-in' ? { account: status.account, browser: status.browser } : { status: status.status })
      }),
    }),
    webServer.register({
      kind: 'exact',
      auth: 'anonymous',
      path: DOCTOR_PATH,
      handler: handler('GET', async (_req, res) => write(res, 200, await service.doctor())),
    }),
    webServer.register({
      kind: 'exact',
      auth: 'anonymous',
      path: WEBPANEL_TOKEN_PATH,
      handler: handler('GET', async (_req, res) => {
        const token = await service.resolveToken()
        if (token === undefined || token.length === 0) {
          write(res, 200, { status: 'signed-out' })
          return
        }
        write(res, 200, { status: 'signed-in', token })
      }),
    }),
  ]
  return () => {
    for (const dispose of disposers) dispose()
  }
}
