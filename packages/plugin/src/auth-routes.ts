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
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
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

export function registerAuthRoutes(webServer: PluginWebServer, service: DeepSeekWebService): () => void {
  const handler = (method: string, fn: (req: IncomingMessage, res: ServerResponse) => Promise<void>) =>
    async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== method) {
        write(res, 405, { error: 'method not allowed' })
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
      path: AUTH_STATUS_PATH,
      handler: handler('GET', async (_req, res) => write(res, 200, await service.status())),
    }),
    webServer.register({
      kind: 'exact',
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
      path: AUTH_CANCEL_PATH,
      handler: handler('POST', async (req, res) => {
        await readBody(req)
        await service.cancel()
        write(res, 200, { ok: true })
      }),
    }),
    webServer.register({
      kind: 'exact',
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
      path: ACCOUNT_PATH,
      handler: handler('GET', async (_req, res) => {
        const status = await service.status()
        write(res, 200, status.status === 'signed-in' ? { account: status.account, browser: status.browser } : { status: status.status })
      }),
    }),
    webServer.register({
      kind: 'exact',
      path: DOCTOR_PATH,
      handler: handler('GET', async (_req, res) => write(res, 200, await service.doctor())),
    }),
    webServer.register({
      kind: 'exact',
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
