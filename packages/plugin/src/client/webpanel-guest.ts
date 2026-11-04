/**
 * Electron <webview> host for the embedded DeepSeek web panel.
 *
 * Why a hand-rolled webview instead of the official Sidebar Browser tab:
 * chat.deepseek.com answers with `content-security-policy: frame-ancestors
 * 'none'`, so an iframe can never load it, and the official browser tab keeps
 * its guest private — no plugin can call `executeJavaScript` on it. Owning the
 * element is what makes the免登录 token seeding below possible.
 *
 * The Desktop main process only attaches a guest whose `src` is
 * `about:blank#<lease>`, whose `partition` equals the lease partition, and whose
 * lease was acquired by this window, so the attribute order below matters.
 */

export interface DesktopBrowserBridge {
  acquire(workspace: string): Promise<{ lease: string; partition: string }>
  release(lease: string): Promise<void>
  onOpenRequested(lease: string, listener: (url: string) => void): () => void
}

export interface WebPanelSnapshot {
  phase: 'idle' | 'attaching' | 'loading' | 'ready' | 'error'
  url: string
  title: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  message?: string
}

const EMPTY_SNAPSHOT: WebPanelSnapshot = {
  phase: 'idle',
  url: '',
  title: '',
  loading: false,
  canGoBack: false,
  canGoForward: false,
}

/** The Electron webview tag as much as this module needs it. */
interface GuestElement extends HTMLElement {
  loadURL(url: string): Promise<void>
  getURL(): string
  getTitle(): string
  isLoading(): boolean
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  reload(): void
  stop(): void
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>
}

export function desktopBrowserBridge(): DesktopBrowserBridge | undefined {
  const carrier = (globalThis as { dshDesktop?: { protocolVersion?: number; browser?: DesktopBrowserBridge } }).dshDesktop
  if (carrier === undefined || carrier === null) return undefined
  if (carrier.protocolVersion !== 1) return undefined
  const bridge = carrier.browser
  if (bridge === undefined || typeof bridge.acquire !== 'function') return undefined
  return bridge
}

/**
 * Seeds `localStorage.userToken` before the SPA boots.
 *
 * chat.deepseek.com persists its session as
 * `userToken = {"value":"<token>","__version":"0"}` in localStorage; writing
 * that value and reloading makes the page sign itself in without a second
 * interactive login. PoW, WebSocket and every API call then run natively inside
 * the guest, which is why no HTTP proxy is needed.
 */
function seedScript(token: string): string {
  const payload = JSON.stringify(JSON.stringify({ value: token, __version: '0' }))
  return [
    '(function () {',
    '  try {',
    '    var wanted = ' + payload + ';',
    '    var current = localStorage.getItem("userToken");',
    '    if (current === wanted) return "unchanged";',
    '    localStorage.setItem("userToken", wanted);',
    '    return "seeded";',
    '  } catch (error) {',
    '    return "failed:" + (error && error.message ? error.message : String(error));',
    '  }',
    '})()',
  ].join('\n')
}

/**
 * Reads the session the page itself established, if any. Returns the bare token
 * string (never the JSON envelope) so it can be validated by the Host.
 */
const HARVEST_SCRIPT = [
  '(function () {',
  '  function unwrap(raw) {',
  '    if (typeof raw !== "string" || raw.length === 0) return null;',
  '    if (raw.charAt(0) !== "{") return raw;',
  '    try {',
  '      var parsed = JSON.parse(raw);',
  '      if (parsed && typeof parsed.value === "string") return parsed.value;',
  '      if (parsed && typeof parsed.token === "string") return parsed.token;',
  '      return null;',
  '    } catch (error) {',
  '      return null;',
  '    }',
  '  }',
  '  function looksLikeToken(value) {',
  '    return typeof value === "string" && value.length >= 24 && /[A-Za-z0-9._-]{24,}/.test(value);',
  '  }',
  '  try {',
  '    // The page normally keeps its session here; accept both the JSON envelope and a bare string.',
  '    var direct = unwrap(localStorage.getItem("userToken"));',
  '    if (looksLikeToken(direct)) return direct;',
  '    // Fallbacks: any localStorage entry whose key mentions a token, plus a JWT-looking value.',
  '    var best = null;',
  '    for (var i = 0; i < localStorage.length; i += 1) {',
  '      var key = String(localStorage.key(i) || "");',
  '      var value = unwrap(localStorage.getItem(key));',
  '      if (!looksLikeToken(value)) continue;',
  '      if (key.toLowerCase().indexOf("token") >= 0) return value;',
  '      if (best === null && value.indexOf("eyJ") === 0) best = value;',
  '    }',
  '    return best;',
  '  } catch (error) {',
  '    return null;',
  '  }',
  '})()',
].join('\n')

export interface WebPanelGuestOptions {
  /** Storage identity handed to the Desktop browser host (partition key). */
  workspaceKey: string
  /** Resolves the Host-side token, or undefined when the account is signed out. */
  resolveToken: () => Promise<string | undefined>
  /** Receives a token the visitor created by signing in inside the guest. */
  onPageToken?: (token: string) => void
  /** Receives window.open() targets the guest is not allowed to open itself. */
  onExternalLink: (url: string) => void
}

export class WebPanelGuest {
  private readonly options: WebPanelGuestOptions
  private element?: GuestElement
  private lease?: string
  private releaseOpenRequest?: () => void
  private readonly seeded = new Set<string>()
  private snapshot: WebPanelSnapshot = { ...EMPTY_SNAPSHOT }
  private readonly listeners = new Set<() => void>()
  private pendingUrl?: string
  private disposed = false
  /** Self-heal for the "blank window" case: retry a navigation that never left about:blank. */
  private loadRetries = 0
  private watchdog?: number
  /** Reverse sync bookkeeping: tokens already handed back to the Host. */
  private readonly harvested = new Set<string>()
  private harvestRetries = 0

  constructor(options: WebPanelGuestOptions) {
    this.options = options
  }

  getSnapshot = (): WebPanelSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private update(patch: Partial<WebPanelSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of [...this.listeners]) listener()
  }

  private readGuest(): void {
    const element = this.element
    if (element === undefined) return
    try {
      this.update({
        url: element.getURL(),
        title: element.getTitle(),
        loading: element.isLoading(),
        canGoBack: element.canGoBack(),
        canGoForward: element.canGoForward(),
      })
    } catch {
      // A destroyed guest throws; the destroyed handler resets state anyway.
    }
  }

  /** Creates the guest element and mounts it into `container`. */
  async attach(container: HTMLElement, url: string): Promise<void> {
    if (this.disposed) return
    if (this.element !== undefined) {
      this.pendingUrl = url
      this.navigate(url)
      return
    }
    const bridge = desktopBrowserBridge()
    if (bridge === undefined) {
      this.update({ phase: 'error', message: 'desktop-browser-unavailable' })
      return
    }
    this.pendingUrl = url
    this.update({ phase: 'attaching' })
    let reservation: { lease: string; partition: string }
    try {
      reservation = await bridge.acquire(this.options.workspaceKey)
    } catch (error) {
      this.update({
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
      return
    }
    if (this.disposed) {
      void bridge.release(reservation.lease).catch(() => undefined)
      return
    }
    this.lease = reservation.lease
    const element = document.createElement('webview') as GuestElement
    element.className = 'dsw-webpanel-webview'
    element.dataset.deepseekWebpanelFrame = 'webview'
    element.setAttribute('name', reservation.lease)
    element.setAttribute('partition', reservation.partition)
    element.setAttribute('allowpopups', '')
    element.setAttribute('src', 'about:blank#' + reservation.lease)
    this.element = element

    this.releaseOpenRequest = bridge.onOpenRequested(reservation.lease, (target) => {
      this.options.onExternalLink(target)
    })

    element.addEventListener('dom-ready', () => {
      if (this.disposed) return
      const current = element.getURL()
      this.update({ phase: 'loading' })
      if (current.startsWith('about:blank')) {
        const target = this.pendingUrl
        if (target !== undefined) void this.navigate(target)
        return
      }
      this.loadRetries = 0
      this.disarmWatchdog()
      this.readGuest()
      void this.seedToken(current)
      void this.harvestToken(current)
    })
    element.addEventListener('did-navigate', () => {
      // A real navigation succeeded: stop the blank-page watchdog and retry counter.
      const current = element.getURL()
      if (current.length > 0 && !current.startsWith('about:')) {
        this.loadRetries = 0
        this.disarmWatchdog()
        this.harvestRetries = 0
      }
      this.readGuest()
    })
    element.addEventListener('did-navigate-in-page', () => {
      // Single-page routing (which is what a DeepSeek login looks like) must also
      // re-arm the harvester, or the token created during login is never read.
      this.harvestRetries = 0
      this.readGuest()
      void this.harvestToken(element.getURL())
    })
    element.addEventListener('did-navigate-in-page', () => this.readGuest())
    element.addEventListener('did-start-loading', () => this.update({ loading: true }))
    element.addEventListener('did-stop-loading', () => {
      this.update({ loading: false })
      if (this.snapshot.phase !== 'error') this.update({ phase: 'ready' })
      this.readGuest()
      void this.harvestToken(element.getURL())
    })
    element.addEventListener('page-title-updated', () => this.readGuest())
    element.addEventListener('did-fail-load', (event) => {
      const detail = event as unknown as { errorCode?: number; isMainFrame?: boolean; errorDescription?: string }
      if (detail.isMainFrame === false) return
      if (detail.errorCode === -3) return
      this.update({
        phase: 'error',
        message: detail.errorDescription ?? 'load-failed',
      })
    })
    element.addEventListener('destroyed', () => {
      this.element = undefined
      this.disarmWatchdog()
      this.update({ ...EMPTY_SNAPSHOT, phase: 'idle' })
    })

    container.appendChild(element)
  }

  /**
   * Sometimes the guest never leaves about:blank (attach race, a swallowed
   * renderer error, a stale lease): a watchdog re-issues the navigation a few
   * times so the window self-heals instead of staying blank until manually
   * reloaded.
   */
  private armWatchdog(): void {
    this.disarmWatchdog()
    this.watchdog = window.setTimeout(() => {
      this.watchdog = undefined
      const element = this.element
      if (this.disposed || element === undefined) return
      let current = ''
      try {
        current = element.getURL()
      } catch {
        return
      }
      if (current.length > 0 && !current.startsWith('about:')) return
      if (this.loadRetries >= 3) return
      this.loadRetries += 1
      const target = this.pendingUrl
      if (target !== undefined) void this.navigate(target)
    }, 6000)
  }

  private disarmWatchdog(): void {
    if (this.watchdog !== undefined) window.clearTimeout(this.watchdog)
    this.watchdog = undefined
  }

  private async seedToken(url: string): Promise<void> {
    const element = this.element
    if (element === undefined) return
    if (!url.startsWith('https://chat.deepseek.com')) return
    if (this.seeded.has(url)) return
    this.seeded.add(url)
    let token: string | undefined
    try {
      token = await this.options.resolveToken()
    } catch {
      return
    }
    if (token === undefined || token.length === 0) return
    if (this.element !== element) return
    let outcome: unknown
    try {
      outcome = await element.executeJavaScript(seedScript(token), true)
    } catch {
      return
    }
    if (outcome === 'seeded' && this.element === element) element.reload()
  }

  /**
   * Reverse sync: when the user signs in inside the guest, the page owns the
   * session (`localStorage.userToken`) while the Host credential store knows
   * nothing about it — and this guest partition is in-memory, so that session
   * dies with the window. Read it back so one sign-in inside the panel becomes a
   * permanent Host credential (settings page + model list + next restart).
   */
  private async harvestToken(url: string): Promise<void> {
    const element = this.element
    if (element === undefined) return
    if (!url.startsWith('https://chat.deepseek.com')) return
    if (this.harvestRetries >= 8) return
    this.harvestRetries += 1
    let value: unknown
    try {
      value = await element.executeJavaScript(HARVEST_SCRIPT, true)
    } catch {
      return
    }
    if (typeof value !== 'string' || value.length < 16) return
    if (this.harvested.has(value)) return
    let hostToken: string | undefined
    try {
      hostToken = await this.options.resolveToken()
    } catch {
      hostToken = undefined
    }
    if (hostToken === value) return
    this.harvested.add(value)
    this.options.onPageToken?.(value)
  }

  navigate(url: string): void {
    this.pendingUrl = url
    const element = this.element
    if (element === undefined) return
    this.update({ phase: 'loading', url })
    this.armWatchdog()
    void element.loadURL(url).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ERR_ABORTED')) return
      this.update({ phase: 'error', message })
    })
  }

  back(): void {
    this.element?.goBack()
  }

  forward(): void {
    this.element?.goForward()
  }

  reload(): void {
    const element = this.element
    if (element === undefined) return
    this.seeded.clear()
    element.reload()
  }

  /**
   * Drops the page-side session so this surface follows a Host-side sign-out.
   * Without this the guest keeps its own cookie/localStorage login and looks
   * signed in while the settings page already shows "signed out".
   */
  async clearSession(): Promise<void> {
    const element = this.element
    if (element === undefined) return
    this.seeded.clear()
    this.harvested.clear()
    this.harvestRetries = 0
    try {
      await element.executeJavaScript(
        '(function () { try { localStorage.removeItem("userToken"); return "ok" } catch (error) { return "err" } })()',
        true,
      )
    } catch {
      // Best effort: a reload below still drops any in-memory page state.
    }
    element.reload()
  }

  stop(): void {
    this.element?.stop()
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.disarmWatchdog()
    this.releaseOpenRequest?.()
    this.releaseOpenRequest = undefined
    const element = this.element
    const lease = this.lease
    this.element = undefined
    this.lease = undefined
    if (element !== undefined && element.parentNode !== null) element.parentNode.removeChild(element)
    const bridge = desktopBrowserBridge()
    if (bridge !== undefined && lease !== undefined) {
      await bridge.release(lease).catch(() => undefined)
    }
    this.update({ ...EMPTY_SNAPSHOT, phase: 'idle' })
  }
}
