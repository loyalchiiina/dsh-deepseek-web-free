import { useCallback, useEffect, useRef, useState } from 'react'
import { LOGIN_PATH, STATUS_PATH, pluginFetch } from './api.ts'
import type { DeepSeekWebSettingsKey } from './locales.ts'

export interface WebPanelAuthBannerProps {
  t: (key: DeepSeekWebSettingsKey) => string
  /** Called once the Host reports a permanent credential, so the caller can reload its guest. */
  onSignedIn?: () => void
  /** Called when the Host credential disappears (e.g. signed out in the settings page). */
  onSignedOut?: () => void
}

const CSS_ID = 'dsh-deepseek-web/webpanel-auth'

const CSS = [
  '.dsw-webpanel-auth{flex:none;display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d99b1a) 12%,transparent)}',
  '.dsw-webpanel-auth-text{flex:1 1 auto;min-width:0;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}',
  '.dsw-webpanel-auth-btn{flex:none;height:24px;padding:0 10px;border:0;border-radius:999px;background:var(--dsw-alias-brand-primary,#4d6bfe);color:#fff;font:inherit;font-size:11px;cursor:pointer}',
  '.dsw-webpanel-auth-btn:disabled{opacity:.6;cursor:default}',
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
 */
export function WebPanelAuthBanner(props: WebPanelAuthBannerProps): JSX.Element | null {
  const t = props.t
  const [state, setState] = useState<'unknown' | 'in' | 'out'>('unknown')
  const [signingIn, setSigningIn] = useState(false)
  const [failed, setFailed] = useState(false)
  const signedInRef = useRef<(() => void) | undefined>(props.onSignedIn)
  signedInRef.current = props.onSignedIn
  const signedOutRef = useRef<(() => void) | undefined>(props.onSignedOut)
  signedOutRef.current = props.onSignedOut
  const previous = useRef<'unknown' | 'in' | 'out'>('unknown')

  const readStatus = useCallback(async (): Promise<boolean> => {
    try {
      const result = await pluginFetch(STATUS_PATH) as { status?: string }
      const signedIn = result?.status === 'signed-in'
      const before = previous.current
      previous.current = signedIn ? 'in' : 'out'
      setState(signedIn ? 'in' : 'out')
      // True unification is two-way: signing out in the settings page must also
      // drop the session this panel holds in its own browser partition.
      if (before === 'in' && !signedIn) signedOutRef.current?.()
      return signedIn
    } catch {
      setState('unknown')
      return false
    }
  }, [])

  // Poll while mounted: the credential can change from the settings page or from
  // the other panel surface (they share one Host store).
  useEffect(() => {
    void readStatus()
    const timer = window.setInterval(() => { void readStatus() }, 4000)
    return () => window.clearInterval(timer)
  }, [readStatus])

  const signIn = useCallback(async (): Promise<void> => {
    if (signingIn) return
    setSigningIn(true)
    setFailed(false)
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
  return (
    <div className="dsw-webpanel-auth">
      <span className="dsw-webpanel-auth-text">
        {failed ? t('panelSignInFailed') : t('panelSignInHint')}
      </span>
      <button
        type="button"
        className="dsw-webpanel-auth-btn"
        disabled={signingIn}
        onClick={() => { void signIn() }}
      >
        {signingIn ? t('panelSigningIn') : t('panelSignInAction')}
      </button>
    </div>
  )
}
