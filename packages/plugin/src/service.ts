import { BrowserAuthCoordinator, PowWorkerPool, loadProtocolCore, PROTOCOL_ABI_VERSION, type BrowserAuthState, type PublicAccountInfo } from '@dsh-deepseek-web/compat'
import type { ResolvedConfig } from './config.ts'

export class DeepSeekWebService {
  readonly auth: BrowserAuthCoordinator

  constructor(private readonly options: {
    resolveHome: () => string
    resolveCredential: () => Promise<string | undefined>
    storeCredential: (token: string) => Promise<void>
    clearCredential: () => Promise<void>
    validateCredential: (token: string, signal?: AbortSignal) => Promise<PublicAccountInfo>
    config: () => ResolvedConfig
    onSignOut?: () => void
  }) {
    this.auth = new BrowserAuthCoordinator({
      resolveHome: options.resolveHome,
      storeCredential: options.storeCredential,
      clearCredential: options.clearCredential,
      validateCredential: options.validateCredential,
      readStoredAccount: async () => {
        try {
          const token = await options.resolveCredential()
          if (token === undefined) return undefined
          return options.validateCredential(token)
        } catch {
          return undefined
        }
      },
    })
  }

  status(): Promise<BrowserAuthState> {
    return this.auth.status()
  }

  resolveToken(): Promise<string | undefined> {
    return this.options.resolveCredential()
  }

  login(options?: { resetProfile?: boolean }): Promise<BrowserAuthState> {
    const browser = this.options.config().browser
    return this.auth.signIn({
      preferred: browser.preferred,
      allowManagedDownload: browser.allowManagedDownload,
      resetProfile: options?.resetProfile === true,
    })
  }

  async logout(clearProfile = true): Promise<void> {
    await this.auth.signOut({ clearProfile })
    this.options.onSignOut?.()
  }

  cancel(): Promise<void> {
    return this.auth.cancel()
  }

  /**
   * Imports a token captured inside the embedded web panel: the guest page owns
   * the session (`localStorage.userToken`), the Host owns the permanent
   * credential. Validating first means a stale or forged value never lands in
   * the credential store, so signing in on either surface keeps both in sync.
   */
  async importToken(token: string): Promise<BrowserAuthState> {
    const normalized = token.trim()
    if (normalized.length < 16) throw new Error('token is too short')
    await this.options.validateCredential(normalized)
    await this.options.storeCredential(normalized)
    return this.status()
  }

  async doctor(): Promise<{ ok: boolean; checks: Array<{ name: string; ok: boolean; detail: string }> }> {
    const checks = []
    const status = await this.status()
    checks.push({
      name: 'auth',
      ok: status.status === 'signed-in',
      detail: status.status,
    })
    const pool = new PowWorkerPool()
    try {
      const kind = await pool.solverKind()
      checks.push({
        name: 'pow',
        ok: kind === 'wasm',
        detail: kind,
      })
    } catch (error) {
      checks.push({
        name: 'pow',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      })
    } finally {
      await pool.dispose()
    }
    try {
      const core = await loadProtocolCore()
      checks.push({
        name: 'Protocol core ABI',
        ok: core.abiVersion === PROTOCOL_ABI_VERSION,
        detail: String(core.abiVersion),
      })
      checks.push({ name: 'Protocol WASM', ok: true, detail: 'OK' })
      const text = core.pathlessFixture()
      checks.push({
        name: 'SSE pathless fixture',
        ok: text === '<dsh_tool_calls>',
        detail: text === '<dsh_tool_calls>' ? 'OK' : text,
      })
    } catch (error) {
      checks.push({
        name: 'Protocol WASM',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      })
    }
    return { ok: checks.every(check => check.ok), checks }
  }
}
