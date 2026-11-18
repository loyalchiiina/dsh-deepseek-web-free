import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import * as dshSettings from '@deepseek-ai/dsh-settings'
import { registerAuthRoutes, type HostConnection } from './auth-routes.ts'
import {
  SETTINGS_NS,
  resolveConfig,
  type Config as PluginConfig,
  type ResolvedConfig,
} from './config.ts'
import { DeepSeekWebService } from './service.ts'

export const name = 'llm-deepseek-web'
export const inject: string[] = []

export type Config = PluginConfig
// The schema value is annotated explicitly so declaration emit stays portable.
// Without it the inferred type carries a pnpm-scoped sneaky-reference to the
// physical schemastery location under .pnpm/, which TypeScript cannot name in a
// .d.ts and rejects with TS2742 on Node 24 (2026-11-05 CI failure). The public
// config type is still `export type Config = PluginConfig` above; only the
// runtime schema binding loses its structural type, which callers do not read.
export const Config: any = z.object({
  tokenEnv: z.string().role('credential-ref').default('DEEPSEEK_WEB_TOKEN'),
  browser: z.object({
    preferred: z.union(['auto', 'chrome', 'edge', 'brave', 'chromium', 'managed']),
    allowManagedDownload: z.boolean(),
  }),
})

/**
 * Settings namespace. 0.1.x routed this through settingsNamespace(); the 0.2.0
 * line removed that helper and consumes the plain string, so fall back to the
 * constant when the helper is absent.
 */
const NS =
  typeof (dshSettings as { settingsNamespace?: unknown }).settingsNamespace === 'function'
    ? (dshSettings as { settingsNamespace: (ns: string) => unknown }).settingsNamespace(SETTINGS_NS)
    : SETTINGS_NS

type CredentialService = {
  resolve(ref: string): Promise<{ value: string } | undefined>
  set(ref: string, value: string): Promise<void>
  unset(ref: string): Promise<void>
}

export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config
  let lastRaw: Config | undefined
  let lastGood: ResolvedConfig | undefined
  const options = (): ResolvedConfig => {
    const raw = current()
    if (raw === lastRaw && lastGood !== undefined) return lastGood
    try {
      lastRaw = raw
      lastGood = resolveConfig(raw)
      return lastGood
    } catch (error) {
      if (lastGood === undefined) throw error
      lastRaw = raw
      ctx.logger.error('dsh-deepseek-web: keeping last good configuration after invalid settings')
      ctx.logger.error(error)
      return lastGood
    }
  }
  options()

  const resolveCredential = async (): Promise<string> => {
    const ref = credentialRef(options().tokenEnv)
    const credentials = ctx.get('credentials') as CredentialService | undefined
    if (credentials !== undefined) {
      const hit = await credentials.resolve(ref)
      if (hit !== undefined && hit.value.length > 0) return hit.value.replace(/^Bearer\s+/i, '')
    }
    throw new Error('dsh-deepseek-web: missing credential for the web panel')
  }

  const storeCredential = async (token: string): Promise<void> => {
    const credentials = ctx.get('credentials') as CredentialService | undefined
    if (credentials === undefined) throw new Error('credentials service unavailable')
    await credentials.set(credentialRef(options().tokenEnv), token)
  }

  const clearCredential = async (): Promise<void> => {
    const credentials = ctx.get('credentials') as CredentialService | undefined
    if (credentials === undefined) return
    await credentials.unset(credentialRef(options().tokenEnv))
  }

  const service = new DeepSeekWebService({
    resolveHome: () => resolveDshHome(),
    resolveCredential: async () => {
      try {
        return await resolveCredential()
      } catch {
        return undefined
      }
    },
    storeCredential,
    clearCredential,
    validateCredential: async (token: string, _signal?: AbortSignal) => ({
      accountHash: createHash('sha256').update(token).digest('hex').slice(0, 16),
    }),
    config: options,
    onSignOut: () => undefined,
  })
  ctx.provide('deepSeekWeb', service)

  ctx.inject(['webServer'], injected => {
    injected.effect(() => {
      // Exact webServer.register() routes bypass DSH's /api admission fence, so
      // every handler asks the Host Connection service for the same decision.
      // Read it lazily per request: the service may not exist on older kernels,
      // and a missing gate must fail closed (see hostRejection in auth-routes).
      const connection = (): HostConnection | undefined => {
        try {
          return ctx.get('connection') as HostConnection | undefined
        } catch {
          return undefined
        }
      }
      const auth = registerAuthRoutes(injected.webServer, service, connection)
      return () => {
        auth()
      }
    }, 'dsh-deepseek-web: host routes')
  })

  // Keep the settings namespace helper reachable for 0.1.x hosts that still
  // expose it. The 0.2.x line derives settings from the composed entry config.
  void NS
}
