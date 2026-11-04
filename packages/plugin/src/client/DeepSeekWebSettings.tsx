import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { CANCEL_PATH, DOCTOR_PATH, LOGIN_PATH, LOGOUT_PATH, pluginFetch, STATUS_PATH } from './api.ts'
import type { DeepSeekWebSettingsKey } from './locales.ts'
import type { ClientAuthState } from './state.ts'
import { openWebPanel } from './webpanel-bus.ts'
import type { WebPanelPosition } from './webpanel-prefs.ts'
import { DEFAULT_WEBPANEL_PREFS, loadPrefs, savePrefs, subscribePrefs } from './webpanel-prefs.ts'
import type { WebPanelPrefs } from './webpanel-prefs.ts'

export interface DeepSeekWebSettingsInjected {
  t: (key: DeepSeekWebSettingsKey) => string
  /** Open the docked sidebar tab or the floating drawer, honoring the position preference. */
  openPanelTab?: (url?: string) => void
}

export type DeepSeekWebSettingsProps = Partial<DeepSeekWebSettingsInjected>

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  maxWidth: 720,
  color: 'var(--dsw-alias-label-primary)',
}
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  lineHeight: '24px',
  fontWeight: 500,
  color: 'var(--dsw-alias-label-primary)',
}
const introStyle: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 14,
  lineHeight: '22px',
  color: 'var(--dsw-alias-label-tertiary)',
}
const rowsStyle: CSSProperties = {
  listStyle: 'none',
  margin: '12px 0 0',
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}
const rowCardStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 12,
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}
const rowHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}
const rowIdentityStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
}
const rowNameStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: '22px',
  fontWeight: 500,
  color: 'var(--dsw-alias-label-primary)',
}
const rowTagStyle: CSSProperties = {
  flex: 'none',
  padding: '1px 6px',
  border: '1px solid var(--dsw-alias-border-l3)',
  borderRadius: 4,
  fontSize: 11,
  lineHeight: '16px',
  color: 'var(--dsw-alias-label-secondary)',
}
const rowActionsStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  marginLeft: 'auto',
}
const metaStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary)',
}
const errorStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--dsw-alias-state-error-primary)',
}
const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: '22px',
  fontWeight: 500,
  color: 'var(--dsw-alias-label-primary)',
}
const cardIntroStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-tertiary)',
}
const editorActionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
}
const outputStyle: CSSProperties = {
  margin: 0,
  padding: '12px 14px',
  borderRadius: 12,
  background: 'var(--dsw-alias-bg-module-platform)',
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: 12,
  lineHeight: '18px',
  whiteSpace: 'pre-wrap',
  overflow: 'auto',
  maxHeight: 240,
}

function isSigningIn(status: ClientAuthState['status']): boolean {
  return status === 'detecting-browser'
    || status === 'installing-browser'
    || status === 'launching-browser'
    || status === 'waiting-for-login'
    || status === 'validating'
}

function statusCopy(t: (key: DeepSeekWebSettingsKey) => string, state: ClientAuthState): string {
  switch (state.status) {
    case 'signed-in':
      return t('signedIn')
    case 'signed-out':
      return t('signedOut')
    case 'loading':
      return t('loadingAccount')
    case 'detecting-browser':
      return t('detectingBrowser')
    case 'installing-browser':
      return state.progress === undefined
        ? t('installingBrowser')
        : `${t('installingBrowser')} ${Math.round(state.progress * 100)}%`
    case 'launching-browser':
      return t('launchingBrowser')
    case 'waiting-for-login':
      return t('waitingForLogin')
    case 'validating':
      return t('validating')
    case 'error':
      return t('requestFailed')
  }
}

function statusDot(status: ClientAuthState['status']): 'done' | 'warning' | 'ongoing' | 'error' {
  if (status === 'signed-in') return 'done'
  if (status === 'error') return 'error'
  if (isSigningIn(status) || status === 'loading') return 'ongoing'
  return 'warning'
}

export function DeepSeekWebSettings(props: DeepSeekWebSettingsProps): JSX.Element {
  const t = props.t ?? ((key: DeepSeekWebSettingsKey) => key)
  const [state, setState] = useState<ClientAuthState>({ status: 'loading' })
  const [doctor, setDoctor] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [prefs, setPrefs] = useState<WebPanelPrefs>(() => (typeof localStorage === 'undefined'
    ? { ...DEFAULT_WEBPANEL_PREFS }
    : loadPrefs()))
  const signingIn = isSigningIn(state.status)

  useEffect(() => subscribePrefs(next => setPrefs(next)), [])

  const updatePrefs = (next: WebPanelPrefs): void => {
    setPrefs(next)
    savePrefs(next)
  }

  const refresh = useCallback(async () => {
    const next = await pluginFetch(STATUS_PATH) as ClientAuthState
    if (typeof next?.status === 'string') setState(next)
  }, [])

  useEffect(() => {
    void refresh().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    })
    const timer = setInterval(() => {
      void refresh().catch(() => undefined)
    }, 1000)
    return () => clearInterval(timer)
  }, [refresh, t])

  const run = async (fn: () => Promise<void>, allowDuringBusy = false): Promise<void> => {
    if (busy && !allowDuringBusy) return
    setBusy(true)
    setError('')
    try {
      await fn()
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={sectionStyle}>
      <div>
        <h2 style={titleStyle}>{t('title')}</h2>
        <p style={introStyle}>{t('intro')}</p>
        <p style={introStyle}>{t('introPermanent')}</p>
      </div>
      <ul style={rowsStyle}>
        <li style={rowCardStyle}>
          <div style={rowHeadStyle}>
            <span style={rowIdentityStyle} role="status">
              <StateDot state={statusDot(state.status)} />
              <span style={rowNameStyle}>{statusCopy(t, state)}</span>
              {state.status === 'signed-in' && state.browser
                ? <span style={rowTagStyle}>{state.browser.kind}</span>
                : null}
            </span>
            <span style={rowActionsStyle}>
              {signingIn
                ? (
                  <Button variant="outline" size="sm" disabled={busy && !signingIn} onClick={() => void run(async () => {
                    await pluginFetch(CANCEL_PATH, { method: 'POST', body: '{}' })
                  }, true)}
                  >
                    {t('cancel')}
                  </Button>
                )
                : null}
              {state.status === 'signed-in'
                ? (
                  <>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => {
                      await pluginFetch(LOGIN_PATH, { method: 'POST', body: JSON.stringify({ resetProfile: false }) })
                    })}
                    >
                      {busy ? t('working') : t('reconnect')}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(async () => {
                      await pluginFetch(LOGOUT_PATH, { method: 'POST', body: JSON.stringify({ clearProfile: true }) })
                    })}
                    >
                      {t('signOut')}
                    </Button>
                  </>
                )
                : null}
              {state.status === 'signed-out' || state.status === 'error' || state.status === 'loading'
                ? (
                  <Button variant="primary" size="sm" disabled={busy || signingIn} onClick={() => void run(async () => {
                    await pluginFetch(LOGIN_PATH, { method: 'POST', body: JSON.stringify({ resetProfile: true }) })
                  })}
                  >
                    {busy ? t('working') : state.status === 'error' ? t('loginAgain') : t('signIn')}
                  </Button>
                )
                : null}
            </span>
          </div>
          {state.status === 'signed-in' && state.account
            ? <p style={metaStyle}>{t('account')} {state.account.accountHash.slice(0, 8)}…</p>
            : null}
          {state.status === 'error' ? <p style={errorStyle}>{state.message}</p> : null}
          {error ? <p style={errorStyle}>{error}</p> : null}
        </li>
        <li style={rowCardStyle}>
          <div>
            <h3 style={cardTitleStyle}>{t('diagnostics')}</h3>
            <p style={cardIntroStyle}>{t('diagnosticsIntro')}</p>
          </div>
          <div style={editorActionsStyle}>
            <Button variant="outline" disabled={busy} onClick={() => void run(async () => {
              const result = await pluginFetch(DOCTOR_PATH)
              setDoctor(JSON.stringify(result, null, 2))
            })}
            >
              {busy ? t('working') : t('doctor')}
            </Button>
          </div>
          {doctor ? <pre style={outputStyle}>{doctor}</pre> : null}
        </li>
        <li style={rowCardStyle}>
          <div>
            <h3 style={cardTitleStyle}>{t('panelSection')}</h3>
            <p style={cardIntroStyle}>{t('panelSectionIntro')}</p>
          </div>
          <div style={rowHeadStyle}>
            <span style={rowIdentityStyle}>
              <StateDot state={prefs.enabled ? 'done' : 'warning'} />
              <span style={rowNameStyle}>{t('panelEnable')}</span>
            </span>
            <span style={rowActionsStyle}>
              <Button variant="outline" size="sm" onClick={() => updatePrefs({ ...prefs, enabled: !prefs.enabled })}>
                {prefs.enabled ? t('panelOn') : t('panelOff')}
              </Button>
            </span>
          </div>
          <p style={metaStyle}>{t('panelEnableHint')}</p>
          <div style={rowHeadStyle}>
            <span style={rowNameStyle}>{t('panelPosition')}</span>
            <span style={rowActionsStyle}>
              {([
                ['sidebar', t('panelPositionSidebar')],
                ['ball', t('panelPositionBall')],
              ] as [WebPanelPosition, string][]).map(([value, label]) => (
                <Button
                  key={value}
                  variant={prefs.position === value ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => updatePrefs({ ...prefs, position: value })}
                >
                  {label}
                </Button>
              ))}
            </span>
          </div>
          <p style={metaStyle}>{t('panelPositionHint')}</p>
          <div style={editorActionsStyle}>
            <Button
              variant="primary"
              size="sm"
              disabled={!prefs.enabled}
              onClick={() => {
                if (prefs.position === 'sidebar' && props.openPanelTab !== undefined) props.openPanelTab()
                else openWebPanel()
              }}
            >
              {t('panelOpenNow')}
            </Button>
          </div>
          <p style={metaStyle}>{t('panelShortcut')}</p>
        </li>
      </ul>
    </div>
  )
}
