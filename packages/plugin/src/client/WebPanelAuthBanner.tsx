import { useCallback, useEffect, useRef, useState } from 'react'
import { LOGIN_PATH, LOGOUT_PATH, STATUS_PATH, importTokenFromPanel, pluginFetch } from './api.ts'
import type { DeepSeekWebSettingsKey } from './locales.ts'

export interface WebPanelAuthBannerProps {
  t: (key: DeepSeekWebSettingsKey) => string
  /** Called once the Host reports a permanent credential, so the caller can reload its guest. */
  onSignedIn?: () => void
  /** Called when the Host credential disappears (e.g. signed out in the settings page). */
  onSignedOut?: () => void
  /** Reads the token the embedded page currently holds (null when the page is signed out). */
  readPageToken?: () => Promise<string | null>
  /** Current URL of the embedded page, used to recognise the sign-in page. */
  readPageUrl?: () => string
}

const CSS_ID = 'dsh-deepseek-web/webpanel-auth4'

// Explicit colours (no theme variables) — a themed version rendered as a beige strip.
const CSS = [
  '.dsw-webpanel-auth{display:flex;flex-direction:column;gap:12px;padding:16px 16px 18px;background:#d92c2c;background-image:linear-gradient(135deg,#f0453f,#c81e2b)}',
  '.dsw-webpanel-auth-head{display:flex;align-items:center;gap:10px}',
  '.dsw-webpanel-auth-icon{flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.22);color:#fff}',
  '.dsw-webpanel-auth-text{flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;line-height:1.5;color:#fff}',
  '.dsw-webpanel-auth-btn{width:100%;height:112px;border:0;border-radius:14px;background:#fff;color:#c81e2b;font-size:56px;font-weight:800;letter-spacing:4px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);transition:filter .15s ease,transform .15s ease}',
  '.dsw-webpanel-auth-btn:hover:not(:disabled){filter:brightness(.96)}',
  '.dsw-webpanel-auth-btn:active:not(:disabled){transform:translateY(2px)}',
  '.dsw-webpanel-auth-btn:disabled{opacity:.7;cursor:default}',
]

if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_ID)}]`) === null) {
  const tag = document.createElement('style')
  tag.dataset.pluginCss = CSS_ID
  tag.textContent = CSS.join('')
  document.head.append(tag)
}

/**
 * Shown inside the panel whenever the Host has no stored credential. It exists so a
 * brand-new user learns that one sign-in is permanent, instead of signing in inside
 * the page and losing that session when the in-memory guest partition dies.
 *
 * It also closes the reverse direction: a sign-in performed inside the embedded page
 * is read back and pushed to the Host store, so the settings page and the model list
 * pick it up without any manual step.
 */
export function WebPanelAuthBanner(props: WebPanelAuthBannerProps): JSX.Element | null {
  const t = props.t
  const [state, setState] = useState<'unknown' | 'in' | 'out'>('unknown')
  const [signingIn, setSigningIn] = useState(false)
  const [failed, setFailed] = useState(false)
  const [syncError, setSyncError] = useState<string>('')
  const signedInRef = useRef<(() => void) | undefined>(props.onSignedIn)
  signedInRef.current = props.onSignedIn
  const signedOutRef = useRef<(() => void) | undefined>(props.onSignedOut)
  signedOutRef.current = props.onSignedOut
  const readTokenRef = useRef<(() => Promise<string | null>) | undefined>(props.readPageToken)
  readTokenRef.current = props.readPageToken
  const readUrlRef = useRef<(() => string) | undefined>(props.readPageUrl)
  readUrlRef.current = props.readPageUrl
  const previous = useRef<'unknown' | 'in' | 'out'>('unknown')
  const lastTried = useRef<string>('')
  /** True once this guest has been observed holding a page session (i.e. it was signed in). */
  const sawPageSession = useRef(false)
  /** Consecutive polls that found no page token — guards against reacting mid-load. */
  const signInStreak = useRef(0)

  const readStatus = useCallback(async (): Promise<boolean> => {
    try {
      const result = await pluginFetch(STATUS_PATH) as { status?: string }
      const signedIn = result?.status === 'signed-in'
      const before = previous.current
      previous.current = signedIn ? 'in' : 'out'
      setState(signedIn ? 'in' : 'out')
      // True unification is two-way:
      //  • signed out in the settings page → drop the session this panel holds;
      //  • signed IN in the settings page (or it was already in) while this guest
      //    still shows the sign-in page → re-seed the token and reload, so the
      //    floating window opens straight into the conversation like the tab does.
      if (before === 'in' && !signedIn) signedOutRef.current?.()
      if (before !== 'in' && signedIn) signedInRef.current?.()
      return signedIn
    } catch {
      setState('unknown')
      return false
    }
  }, [])

  /**
   * Poll both sides. Reading the page token on a timer (not only on navigation)
   * is what makes "sign in inside the embedded page" work reliably: DeepSeek's
   * login is a single-page flow, so no navigation event is guaranteed.
   */
  const tick = useCallback(async (): Promise<void> => {
    const signedIn = await readStatus()
    const reader = readTokenRef.current
    const token = reader === undefined ? null : await reader()
    if (token !== null && token.length > 0) {
      sawPageSession.current = true
      signInStreak.current = 0
    } else {
      signInStreak.current += 1
    }
    if (signedIn) {
      setSyncError('')
      // Reverse sign-out: the user logged out inside the embedded page (it is now
      // sitting on /sign_in with no session), but the Host still holds a stale
      // credential. Drop it, otherwise the settings page keeps claiming "signed
      // in" and every fresh panel is seeded with a dead token.
      const url = readUrlRef.current?.() ?? ''
      // Two different situations both mean "the Host credential is dead":
      //  a) we saw a page session and it vanished  -> the user logged out in the page (fast path);
      //  b) we never saw one and the page sits on /sign_in for a while -> the seeded token was
      //     rejected (e.g. logged out on the web earlier). Slow path so we never wipe a good
      //     credential while the page is still loading.
      const threshold = sawPageSession.current ? 2 : 6
      const onSignInPage = url.includes('/sign_in')
      // `url === ''` means the guest is not attached yet — never judge on that.
      const detached = url.length === 0
      const dropCredential =
        !detached &&
        token === null &&
        ((onSignInPage && signInStreak.current >= threshold) ||
          (sawPageSession.current && signInStreak.current >= 8))
      if (dropCredential) {
        sawPageSession.current = false
        signInStreak.current = 0
        try {
          await pluginFetch(LOGOUT_PATH, { method: 'POST', body: JSON.stringify({}) })
        } catch {
          // Ignore: a failed host logout must not wedge the poll loop.
        }
        await readStatus()
      }
      return
    }
    if (token === null || token.length === 0 || token === lastTried.current) return
    lastTried.current = token
    try {
      await importTokenFromPanel(token)
      setSyncError('')
      await readStatus()
    } catch (caught: unknown) {
      setSyncError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [readStatus])

  useEffect(() => {
    void tick()
    const timer = window.setInterval(() => { void tick() }, 3000)
    return () => window.clearInterval(timer)
  }, [tick])

  const signIn = useCallback(async (): Promise<void> => {
    if (signingIn) return
    setSigningIn(true)
    setFailed(false)
    setSyncError('')
    try {
      await pluginFetch(LOGIN_PATH, { method: 'POST', body: JSON.stringify({}) })
      for (let attempt = 0; attempt < 80; attempt += 1) {
        await new Promise<void>(resolve => { window.setTimeout(resolve, 1500) })
        if (await readStatus()) {
          signedInRef.current?.()
          return
        }
      }
      setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setSigningIn(false)
    }
  }, [readStatus, signingIn])

  if (state !== 'out') return null
  const text = syncError.length > 0
    ? `同步失败：${syncError}`
    : (failed ? t('panelSignInFailed') : t('panelSignInHint'))
  return (
    <div
      className="dsw-webpanel-auth"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 16px 18px', background: '#d92c2c', backgroundImage: 'linear-gradient(135deg,#f0453f,#c81e2b)' }}
    >
      <div className="dsw-webpanel-auth-head" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="dsw-webpanel-auth-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="4.2" />
            <path d="M11 11l9 9" />
            <path d="M17.5 17.5l2-2" />
            <path d="M15 15l2-2" />
          </svg>
        </span>
        <span className="dsw-webpanel-auth-text">{text}</span>
      </div>
      <button
        type="button"
        className="dsw-webpanel-auth-btn"
        disabled={signingIn}
        onClick={() => { void signIn() }}
        style={{ width: '100%', height: 112, border: 0, borderRadius: 14, background: '#fff', color: '#c81e2b', fontSize: 56, fontWeight: 800, letterSpacing: 4, cursor: signingIn ? 'default' : 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.25)', fontFamily: 'inherit' }}
      >
        {signingIn ? t('panelSigningIn') : t('panelSignInAction')}
      </button>
    </div>
  )
}
