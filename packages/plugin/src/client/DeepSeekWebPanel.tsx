import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { WEBPANEL_TOKEN_PATH, importTokenFromPanel, pluginFetch } from './api.ts'
import { WebPanelAuthBanner } from './WebPanelAuthBanner.tsx'
import type { DeepSeekWebSettingsKey } from './locales.ts'
import { subscribeWebPanel } from './webpanel-bus.ts'
import { WebPanelGuest } from './webpanel-guest.ts'
import type { WebPanelSnapshot } from './webpanel-guest.ts'
import {
  DEFAULT_WEBPANEL_PREFS,
  WEBPANEL_DEFAULT_URL,
  loadPrefs,
  savePrefs,
  subscribePrefs,
} from './webpanel-prefs.ts'
import type { WebPanelPoint, WebPanelPrefs, WebPanelSize } from './webpanel-prefs.ts'

export interface DeepSeekWebPanelInjected {
  t: (key: DeepSeekWebSettingsKey) => string
  /** Open the docked sidebar tab (used when the panel position preference is "sidebar"). */
  openPanelTab?: (url?: string) => void
}

export type DeepSeekWebPanelProps = Partial<DeepSeekWebPanelInjected>

const PANEL_CSS_ID = 'dsh-deepseek-web/webpanel'
const BALL_SIZE = 52
const BALL_MARGIN = 12
const WIN_WIDTH = 420
const WIN_HEIGHT = 640
const WIN_MIN_WIDTH = 320
const WIN_MIN_HEIGHT = 420
const DRAG_THRESHOLD = 4

const PANEL_CSS = [
  // The host never eats clicks: DSH stays fully usable around the ball and window.
  '.dsw-webpanel-host{position:fixed;inset:0;z-index:1200;pointer-events:none}',
  '.dsw-webpanel-ball{position:fixed;width:52px;height:52px;padding:0;border-radius:50%;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 6px 20px rgba(0,0,0,.18);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;touch-action:none;user-select:none;transition:transform .12s ease,box-shadow .12s ease}',
  '.dsw-webpanel-ball:hover{transform:translateY(-1px) scale(1.03);box-shadow:0 10px 26px rgba(0,0,0,.24)}',
  '.dsw-webpanel-ball:active{transform:scale(.97)}',
  '.dsw-webpanel-ball-icon{display:inline-flex;align-items:center;justify-content:center;pointer-events:none}',
  '.dsw-webpanel-win{position:fixed;pointer-events:auto;display:flex;flex-direction:column;overflow:hidden;border-radius:14px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);box-shadow:0 18px 48px rgba(0,0,0,.28);animation:dsw-webpanel-in .16s ease-out}',
  '@keyframes dsw-webpanel-in{from{transform:translateY(8px) scale(.985);opacity:.4}to{transform:none;opacity:1}}',
  '.dsw-webpanel-rz{position:absolute;z-index:3;touch-action:none}',
  '.dsw-webpanel-rz-e{top:0;right:0;bottom:0;width:6px;cursor:ew-resize}',
  '.dsw-webpanel-rz-s{left:0;right:0;bottom:0;height:6px;cursor:ns-resize}',
  '.dsw-webpanel-rz-se{right:0;bottom:0;width:14px;height:14px;cursor:nwse-resize}',
  '.dsw-webpanel-tab{display:flex;flex-direction:column;flex:1;min-height:0;height:100%;background:var(--dsw-alias-bg-base)}',
  '.dsw-webpanel-head{flex:none;display:flex;align-items:center;height:44px;gap:6px;padding:0 8px;border-bottom:1px solid var(--dsw-alias-border-l2);cursor:move;user-select:none;touch-action:none}',
  '.dsw-webpanel-head button,.dsw-webpanel-head input{cursor:auto}',
  '.dsw-webpanel-iconbtn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .12s ease,color .12s ease;overflow:hidden}',
  '.dsw-webpanel-iconbtn:hover{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}',
  '.dsw-webpanel-iconbtn:disabled{opacity:.35;cursor:default;background:transparent;color:var(--dsw-alias-label-secondary)}',
  '.dsw-webpanel-iconbtn-close:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent);color:var(--dsw-alias-state-error-primary)}',
  '.dsw-webpanel-address{flex:1 1 0;min-width:90px;height:28px;margin:0 2px;padding:0 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none;text-overflow:ellipsis;cursor:text}',
  '.dsw-webpanel-address:focus{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base)}',
  '.dsw-webpanel-address::placeholder{color:var(--dsw-alias-label-tertiary)}',
  '.dsw-webpanel-auth{flex:none;display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d99b1a) 12%,transparent)}',
  '.dsw-webpanel-auth-text{flex:1 1 auto;min-width:0;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}',
  '.dsw-webpanel-auth-btn{flex:none;height:24px;padding:0 10px;border:0;border-radius:999px;background:var(--dsw-alias-brand-primary,#4d6bfe);color:#fff;font:inherit;font-size:11px;cursor:pointer}',
  '.dsw-webpanel-auth-btn:disabled{opacity:.6;cursor:default}',
  '.dsw-webpanel-body{position:relative;flex:1;min-height:0;display:flex}',
  '.dsw-webpanel-frame{display:flex;flex:1;min-width:0;min-height:0}',
  '.dsw-webpanel-webview{-webkit-app-region:no-drag;border:0;flex:auto;width:100%;min-width:0;height:100%;min-height:0;display:flex}',
  '.dsw-webpanel-note{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-base)}',
  '.dsw-webpanel-error{color:var(--dsw-alias-state-error-primary)}',
].join('')

if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css=${JSON.stringify(PANEL_CSS_ID)}]`) === null) {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-deepseek-web'
  tag.dataset.pluginCss = PANEL_CSS_ID
  tag.textContent = PANEL_CSS
  document.head.appendChild(tag)
}

const EMPTY: WebPanelSnapshot = {
  phase: 'idle',
  url: '',
  title: '',
  loading: false,
  canGoBack: false,
  canGoForward: false,
}

/** One stable storage identity, so a panel always asks the host for the same workspace. */
const WORKSPACE_KEY = 'dsh-deepseek-web-panel'

/**
 * Official DeepSeek whale mark, recolored through `currentColor` so it follows the
 * host theme (black on light surfaces, white on dark ones).
 */
/** Exported so the sidebar toggle can reuse the same whale mark. */
export const WHALE_ICON = '<svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden="true"><path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45"/></svg>'

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

function viewport(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1440, height: 900 }
  return { width: window.innerWidth, height: window.innerHeight }
}

function clampPoint(point: WebPanelPoint, width: number, height: number): WebPanelPoint {
  const box = viewport()
  const maxX = Math.max(BALL_MARGIN, box.width - width - BALL_MARGIN)
  const maxY = Math.max(BALL_MARGIN, box.height - height - BALL_MARGIN)
  return {
    x: Math.min(Math.max(BALL_MARGIN, Math.round(point.x)), maxX),
    y: Math.min(Math.max(BALL_MARGIN, Math.round(point.y)), maxY),
  }
}

function winSize(): { width: number; height: number } {
  const box = viewport()
  return {
    width: Math.min(WIN_WIDTH, Math.max(320, box.width - 2 * BALL_MARGIN)),
    height: Math.min(WIN_HEIGHT, Math.max(320, box.height - 2 * BALL_MARGIN)),
  }
}

function defaultBall(): WebPanelPoint {
  const box = viewport()
  return clampPoint({ x: box.width - BALL_SIZE - 24, y: Math.round(box.height * 0.62) }, BALL_SIZE, BALL_SIZE)
}

/**
 * Right edge of the host sidebar, measured from our own footer toggle (the
 * toggle spans the sidebar footer, so its right edge is the sidebar edge).
 * Null when the toggle is not mounted or has no layout yet.
 */
function sidebarRightEdge(): number | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector('.dsw-webpanel-toggle-layer')
  if (el === null) return null
  const rect = el.getBoundingClientRect()
  return rect.width > 0 ? Math.round(rect.right) : null
}

/**
 * Park the window just to the right of the sidebar, bottom-aligned: it lands in
 * the empty lower-left corner of the main area and never covers the chat column
 * where the conversation actually renders.
 */
function defaultWin(_ball: WebPanelPoint): WebPanelPoint {
  const box = viewport()
  const size = winSize()
  const anchor = sidebarRightEdge() ?? Math.round(box.width * 0.18)
  return clampPoint(
    { x: anchor + 12, y: box.height - size.height - BALL_MARGIN },
    size.width,
    size.height,
  )
}

export function DeepSeekWebPanel(props: DeepSeekWebPanelProps): JSX.Element | null {
  const t = props.t ?? ((key: DeepSeekWebSettingsKey) => key)
  const [prefs, setPrefs] = useState<WebPanelPrefs>(() => (typeof localStorage === 'undefined'
    ? { ...DEFAULT_WEBPANEL_PREFS }
    : loadPrefs()))
  const [open, setOpen] = useState(false)
  // Once opened the window stays mounted but hidden, so the guest keeps its page,
  // scroll position and draft instead of reloading on every toggle.
  const [mounted, setMounted] = useState(false)
  const [snapshot, setSnapshot] = useState<WebPanelSnapshot>(EMPTY)
  const [address, setAddress] = useState(WEBPANEL_DEFAULT_URL)
  const [ball, setBall] = useState<WebPanelPoint>(() => prefs.ball ?? defaultBall())
  const [winOffset, setWinOffset] = useState<WebPanelPoint | null>(prefs.winOffset)
  const [winSizeState, setWinSizeState] = useState<WebPanelSize | null>(prefs.winSize)
  const containerRef = useRef<HTMLDivElement>(null)
  const guestRef = useRef<WebPanelGuest>()
  const pendingUrlRef = useRef<string>(WEBPANEL_DEFAULT_URL)

  const ensureGuest = useCallback((): WebPanelGuest => {
    if (guestRef.current === undefined) {
      guestRef.current = new WebPanelGuest({
        workspaceKey: WORKSPACE_KEY,
        resolveToken: resolvePanelToken,
        // Reverse sync: a sign-in performed inside the guest becomes the Host
        // credential, which is the permanent copy both surfaces read.
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

  const show = useCallback((url?: string) => {
    if (url !== undefined && url.length > 0) pendingUrlRef.current = url
    if (loadPrefs().position === 'sidebar' && props.openPanelTab !== undefined) {
      props.openPanelTab(url)
      return
    }
    setMounted(true)
    setOpen(true)
  }, [props.openPanelTab])

  const toggle = useCallback(() => {
    if (!loadPrefs().enabled) return
    setMounted(true)
    setOpen(current => !current)
  }, [])

  useEffect(() => subscribeWebPanel(request => {
    if (!loadPrefs().enabled) return
    if (request.toggle === true) {
      toggle()
      return
    }
    show(request.url)
  }), [show, toggle])

  // Settings edits land here so a position or geometry change applies without a reload.
  useEffect(() => subscribePrefs(next => {
    setPrefs(next)
    if (next.ball !== null) setBall(next.ball)
    setWinOffset(next.winOffset)
    setWinSizeState(next.winSize)
    if (!next.enabled) setOpen(false)
  }), [])

  // Ctrl+Shift+D toggles; Esc closes. The host lives in shell.overlay, so a plain
  // window listener is enough and needs no extra service injection.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return
      if (event.key.toLowerCase() === 'd' && event.shiftKey && (event.ctrlKey || event.metaKey)) {
        const current = loadPrefs()
        if (!current.enabled) return
        event.preventDefault()
        if (current.position === 'sidebar' && props.openPanelTab !== undefined) {
          props.openPanelTab()
          return
        }
        setMounted(true)
        setOpen(value => !value)
        return
      }
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, props.openPanelTab])

  // Attach the guest once the window exists in the DOM.
  useEffect(() => {
    if (!mounted) return
    const container = containerRef.current
    if (container === null) return
    const guest = ensureGuest()
    const unsubscribe = guest.subscribe(() => setSnapshot(guest.getSnapshot()))
    setSnapshot(guest.getSnapshot())
    void guest.attach(container, pendingUrlRef.current).then(() => setSnapshot(guest.getSnapshot()))
    return unsubscribe
  }, [mounted, ensureGuest])

  useEffect(() => {
    if (snapshot.url.length > 0 && !snapshot.url.startsWith('about:blank')) setAddress(snapshot.url)
  }, [snapshot.url])

  // The ball only exists in "ball" position; the sidebar tab handles the other mode.
  if (prefs.position !== 'ball') return null

  const size = winSizeState ?? winSize()
  // The window is derived from the ball plus an offset, so moving the ball carries the
  // window along instead of leaving it stranded where it was last dropped.
  const winPos = clampPoint(
    winOffset === null ? defaultWin(ball) : { x: ball.x + winOffset.x, y: ball.y + winOffset.y },
    size.width,
    size.height,
  )
  const offsetOf = (point: WebPanelPoint): WebPanelPoint => ({ x: point.x - ball.x, y: point.y - ball.y })

  const drag = (
    event: ReactPointerEvent<HTMLElement>,
    onMove: (dx: number, dy: number) => void,
    onEnd: () => void,
  ): void => {
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const move = (moveEvent: PointerEvent): void => onMove(moveEvent.clientX - startX, moveEvent.clientY - startY)
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      onEnd()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // A press that never passes the threshold is a click, so dragging and toggling share one gesture.
  const onBallPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const origin = ball
    let moved = false
    let latest = origin
    drag(event, (dx, dy) => {
      if (!moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) moved = true
      if (!moved) return
      latest = clampPoint({ x: origin.x + dx, y: origin.y + dy }, BALL_SIZE, BALL_SIZE)
      setBall(latest)
    }, () => {
      // Only the ball moves: the window keeps its offset, so it travels with the ball.
      if (moved) savePrefs({ ...loadPrefs(), ball: latest, win: null, winOffset })
      else toggle()
    })
  }

  const onHeadPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement | null
    if (target !== null && target.closest('button, input') !== null) return
    const origin = winPos
    let latest = offsetOf(origin)
    drag(event, (dx, dy) => {
      const next = clampPoint({ x: origin.x + dx, y: origin.y + dy }, size.width, size.height)
      latest = offsetOf(next)
      setWinOffset(latest)
    }, () => {
      savePrefs({ ...loadPrefs(), win: null, winOffset: latest })
    })
  }

  /** Edge/corner resize: width, height or both, clamped so the window stays on screen. */
  const onResizeDown = (event: ReactPointerEvent<HTMLElement>, edge: 'e' | 's' | 'se'): void => {
    event.preventDefault()
    event.stopPropagation()
    const start = size
    // The top-left corner stays put while resizing, so the ball-relative offset is fixed.
    const startOffset = offsetOf(winPos)
    let latestSize = start
    drag(event, (dx, dy) => {
      const box = viewport()
      const anchorX = ball.x + startOffset.x
      const anchorY = ball.y + startOffset.y
      const maxWidth = Math.max(WIN_MIN_WIDTH, box.width - anchorX - BALL_MARGIN)
      const maxHeight = Math.max(WIN_MIN_HEIGHT, box.height - anchorY - BALL_MARGIN)
      const width = edge === 's' ? start.width : Math.min(Math.max(WIN_MIN_WIDTH, start.width + dx), maxWidth)
      const height = edge === 'e' ? start.height : Math.min(Math.max(WIN_MIN_HEIGHT, start.height + dy), maxHeight)
      latestSize = { width: Math.round(width), height: Math.round(height) }
      setWinSizeState(latestSize)
      setWinOffset(startOffset)
    }, () => {
      savePrefs({ ...loadPrefs(), win: null, winOffset: startOffset, winSize: latestSize })
    })
  }

  const submitAddress = (): void => {
    const raw = address.trim()
    if (raw.length === 0) return
    guestRef.current?.navigate(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  }

  const unavailable = snapshot.phase === 'error' && snapshot.message === 'desktop-browser-unavailable'

  // Inline SVG glyphs: text glyphs (\u26f6 etc.) render inconsistently across host fonts.
  const ICONS = {
    back: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.8 2.8 4.6 7l4.2 4.2"/></svg>',
    forward: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.2 2.8 9.4 7l-4.2 4.2"/></svg>',
    reload: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.4 6.2a4.5 4.5 0 1 0-.9 3.4"/><path d="M11.6 2.8v3.4H8.2"/></svg>',
    stop: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3.2" y="3.2" width="7.6" height="7.6" rx="1.2"/></svg>',
    external: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3.4v7.6H11V8"/><path d="M8.2 3H11v2.8"/><path d="M11 3 6.8 7.2"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="m3.4 3.4 7.2 7.2M10.6 3.4l-7.2 7.2"/></svg>',
  }

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
    <div className="dsw-webpanel-host">
      {mounted ? (
        <div
          className="dsw-webpanel-win"
          style={{
            left: winPos.x,
            top: winPos.y,
            width: size.width,
            height: size.height,
            display: open ? 'flex' : 'none',
          }}
          role="dialog"
          aria-label={t('panelTitle')}
          aria-hidden={!open}
        >
          <div className="dsw-webpanel-head" onPointerDown={onHeadPointerDown}>
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
            {tool(t('panelClose'), ICONS.close, () => setOpen(false), { danger: true })}
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
          <div className="dsw-webpanel-rz dsw-webpanel-rz-e" onPointerDown={event => onResizeDown(event, 'e')} />
          <div className="dsw-webpanel-rz dsw-webpanel-rz-s" onPointerDown={event => onResizeDown(event, 's')} />
          <div className="dsw-webpanel-rz dsw-webpanel-rz-se" onPointerDown={event => onResizeDown(event, 'se')} />
        </div>
      ) : null}
      <button
        type="button"
        className="dsw-webpanel-ball"
        style={{ left: ball.x, top: ball.y }}
        aria-label={open ? t('panelClose') : t('panelAction')}
        title={open ? t('panelClose') : t('panelAction')}
        aria-expanded={open}
        onPointerDown={onBallPointerDown}
      >
        <span className="dsw-webpanel-ball-icon" dangerouslySetInnerHTML={{ __html: WHALE_ICON }} />
      </button>
    </div>
  )
}
