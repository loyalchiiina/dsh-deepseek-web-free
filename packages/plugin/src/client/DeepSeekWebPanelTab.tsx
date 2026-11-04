import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { WEBPANEL_TOKEN_PATH, importTokenFromPanel, pluginFetch } from './api.ts'
import type { DeepSeekWebSettingsKey } from './locales.ts'
import { WebPanelGuest } from './webpanel-guest.ts'
import type { WebPanelSnapshot } from './webpanel-guest.ts'
import { WEBPANEL_DEFAULT_URL, WEBPANEL_WORKSPACE_KEY } from './webpanel-prefs.ts'
import { WebPanelAuthBanner } from './WebPanelAuthBanner.tsx'

export interface DeepSeekWebPanelTabInjected {
  t: (key: DeepSeekWebSettingsKey) => string
  /** Reveal the floating drawer (used when the guest asks to open a link there). */
  openFloatPanel?: (url?: string) => void
}

export interface DeepSeekWebPanelTabProps extends DeepSeekWebPanelTabInjected {
  useTabInfo?: () => { tab: { id: string; signal?: unknown; navigation?: { params?: { url?: string } }; actions?: { openTab?: (kind: string, options?: unknown) => void; close?: () => void } } }
}

async function resolvePanelToken(): Promise<string | undefined> {
  const result = await pluginFetch(WEBPANEL_TOKEN_PATH) as { status?: string; token?: string }
  if (result.status !== 'signed-in') return undefined
  const token = result.token
  return typeof token === 'string' && token.length > 0 ? token : undefined
}

function openInSystemBrowser(url: string): void {
  if (url.length === 0) return
  window.open(url, '_blank', 'noopener')
}

const ICONS = {
  back: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.8 2.8 4.6 7l4.2 4.2"/></svg>',
  forward: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.2 2.8 9.4 7l-4.2 4.2"/></svg>',
  reload: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.4 6.2a4.5 4.5 0 1 0-.9 3.4"/><path d="M11.6 2.8v3.4H8.2"/></svg>',
  stop: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3.2" y="3.2" width="7.6" height="7.6" rx="1.2"/></svg>',
  external: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3.4v7.6H11V8"/><path d="M8.2 3H11v2.8"/><path d="M11 3 6.8 7.2"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="m3.4 3.4 7.2 7.2M10.6 3.4l-7.2 7.2"/></svg>',
}

/** Docked variant of the web panel: one right-sidebar tab, chrome fills the pane. */
export function DeepSeekWebPanelTab(props: DeepSeekWebPanelTabProps): JSX.Element {
  const t = props.t ?? ((key: DeepSeekWebSettingsKey) => key)
  const tabInfo = props.useTabInfo?.()
  const tab = tabInfo?.tab
  const [snapshot, setSnapshot] = useState<WebPanelSnapshot>({ phase: 'idle', url: '', title: '', loading: false, canGoBack: false, canGoForward: false })
  const [address, setAddress] = useState(() => tab?.navigation?.params?.url ?? WEBPANEL_DEFAULT_URL)
  const containerRef = useRef<HTMLDivElement>(null)
  const guestRef = useRef<WebPanelGuest>()
  const initialUrlRef = useRef(tab?.navigation?.params?.url ?? WEBPANEL_DEFAULT_URL)

  const ensureGuest = useCallback((): WebPanelGuest => {
    if (guestRef.current === undefined) {
      guestRef.current = new WebPanelGuest({
        // Same identity as the floating window: one partition, one login session.
        workspaceKey: WEBPANEL_WORKSPACE_KEY,
        resolveToken: resolvePanelToken,
        // Reverse sync: signing in inside this tab must become the permanent
        // Host credential, otherwise the settings page keeps saying "signed out".
        onPageToken: token => {
          void importTokenFromPanel(token).catch((error: unknown) => {
            console.warn('[deepseek-web] token import failed', error)
          })
        },
        onExternalLink: url => openInSystemBrowser(url),
      })
    }
    return guestRef.current
  }, [])

  useEffect(() => () => {
    const guest = guestRef.current
    guestRef.current = undefined
    void guest?.dispose()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (container === null) return
    const guest = ensureGuest()
    const unsubscribe = guest.subscribe(() => setSnapshot(guest.getSnapshot()))
    setSnapshot(guest.getSnapshot())
    void guest.attach(container, initialUrlRef.current).then(() => setSnapshot(guest.getSnapshot()))
    return unsubscribe
  }, [ensureGuest])

  useEffect(() => {
    if (snapshot.url.length > 0 && !snapshot.url.startsWith('about:blank')) setAddress(snapshot.url)
  }, [snapshot.url])

  const submitAddress = (): void => {
    const raw = address.trim()
    if (raw.length === 0) return
    guestRef.current?.navigate(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  }

  const unavailable = snapshot.phase === 'error' && snapshot.message === 'desktop-browser-unavailable'
  const rootStyle: CSSProperties = { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }

  const tool = (
    label: string,
    icon: string,
    onClick: () => void,
    options?: { danger?: boolean; disabled?: boolean },
  ): JSX.Element => (
    <button
      type="button"
      className={options?.danger === true ? 'dsw-webpanel-iconbtn dsw-webpanel-iconbtn-close' : 'dsw-webpanel-iconbtn'}
      aria-label={label}
      title={label}
      disabled={options?.disabled === true}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: icon }}
    />
  )

  return (
    <div className="dsw-webpanel-tab" style={rootStyle}>
      <div className="dsw-webpanel-head" style={{ paddingLeft: 8 }}>
        {tool(t('panelBack'), ICONS.back, () => guestRef.current?.back(), { disabled: !snapshot.canGoBack })}
        {tool(t('panelForward'), ICONS.forward, () => guestRef.current?.forward(), { disabled: !snapshot.canGoForward })}
        {tool(
          snapshot.loading ? t('panelStop') : t('panelReload'),
          snapshot.loading ? ICONS.stop : ICONS.reload,
          () => {
            if (snapshot.loading) guestRef.current?.stop()
            else guestRef.current?.reload()
          },
        )}
        <input
          className="dsw-webpanel-address"
          value={address}
          spellCheck={false}
          placeholder={t('panelAddress')}
          onChange={event => setAddress(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            submitAddress()
          }}
        />
        {tool(t('panelExternal'), ICONS.external, () => openInSystemBrowser(snapshot.url.length > 0 ? snapshot.url : address))}
        {tool(t('panelClose'), ICONS.close, () => tab?.actions?.close?.(), { danger: true })}
      </div>
      <WebPanelAuthBanner
        t={t}
        onSignedIn={() => guestRef.current?.reload()}
        onSignedOut={() => { void guestRef.current?.clearSession() }}
        readPageToken={() => guestRef.current?.readPageToken() ?? Promise.resolve(null)}
        readPageUrl={() => guestRef.current?.currentUrl() ?? ''}
      />
      <div className="dsw-webpanel-body">
        <div ref={containerRef} className="dsw-webpanel-frame" />
        {snapshot.phase === 'attaching' ? <div className="dsw-webpanel-note">{t('panelConnecting')}</div> : null}
        {unavailable ? <div className="dsw-webpanel-note">{t('panelDesktopOnly')}</div> : null}
        {!unavailable && snapshot.phase === 'error' ? (
          <div className="dsw-webpanel-note dsw-webpanel-error">
            {t('panelLoadFailed')}{snapshot.message !== undefined ? ` (${snapshot.message})` : ''}
          </div>
        ) : null}
      </div>
    </div>
  )
}
