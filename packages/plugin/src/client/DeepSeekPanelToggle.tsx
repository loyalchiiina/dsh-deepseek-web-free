import { useEffect, useRef, useState } from 'react'
import { WHALE_ICON } from './DeepSeekWebPanel.tsx'
import type { DeepSeekWebSettingsKey } from './locales.ts'
import { toggleWebPanel } from './webpanel-bus.ts'
import { loadPrefs, savePrefs, subscribePrefs } from './webpanel-prefs.ts'
import type { WebPanelPrefs, WebPanelPosition } from './webpanel-prefs.ts'

export interface DeepSeekPanelToggleInjected {
  t: (key: DeepSeekWebSettingsKey) => string
  /** Open the docked sidebar tab (used when the default mode is "sidebar"). */
  openPanelTab?: (url?: string) => void
}

export type DeepSeekPanelToggleProps = Partial<DeepSeekPanelToggleInjected> & {
  wide?: boolean
}

const PANEL_CSS_ID = 'dsh-deepseek-web/panel-toggle'
const PANEL_CSS = [
  '.dsw-webpanel-toggle-layer{flex:none;align-items:center;width:100%;height:42px;margin:8px 0 0;display:flex;position:relative}',
  '.dsw-webpanel-toggle-layer[data-wide="0"]{width:36px;height:36px;margin:0}',
  '.dsw-webpanel-toggle{width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);cursor:pointer;background:transparent;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}',
  '.dsw-webpanel-toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.dsw-webpanel-toggle-layer[data-wide="0"] .dsw-webpanel-toggle{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:0;padding:0}',
  '.dsw-webpanel-toggle-icon{flex:none;display:inline-flex;align-items:center;justify-content:center}',
  '.dsw-webpanel-toggle-icon svg{width:18px;height:18px;display:block}',
  '.dsw-webpanel-toggle-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}',
  // Hover chooser: pick which mode the plain click opens next time.
  // It is position:fixed (anchored to the button rect on open) on purpose: the
  // sidebar footer clips absolutely-positioned children, so a plain popover
  // would be invisible — same flyout behaviour as the model-fold entry.
  '.dsw-webpanel-chooser{position:fixed;z-index:1300;min-width:150px;padding:6px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);box-shadow:0 10px 30px rgba(0,0,0,.24);display:flex;flex-direction:column;gap:2px}',
  '.dsw-webpanel-chooser-title{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:4px 8px 2px;white-space:nowrap}',
  '.dsw-webpanel-chooser-item{display:flex;align-items:center;gap:8px;min-height:30px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;text-align:left;white-space:nowrap}',
  '.dsw-webpanel-chooser-item:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.dsw-webpanel-chooser-dot{width:6px;height:6px;border-radius:50%;background:transparent;flex:none}',
  '.dsw-webpanel-chooser-item.is-current .dsw-webpanel-chooser-dot{background:var(--dsw-alias-label-primary)}',
].join('')

if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css=${JSON.stringify(PANEL_CSS_ID)}]`) === null) {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-deepseek-web'
  tag.dataset.pluginCss = PANEL_CSS_ID
  tag.textContent = PANEL_CSS
  document.head.appendChild(tag)
}

const MODES: readonly WebPanelPosition[] = ['ball', 'sidebar']

/**
 * Sidebar footer toggle for the web panel. A plain click opens the default mode
 * (the position preference); hovering the button offers a small chooser that
 * switches that default between the floating ball and the docked sidebar tab.
 */
export function DeepSeekPanelToggle(props: DeepSeekPanelToggleProps): JSX.Element {
  const t = props.t ?? ((key: DeepSeekWebSettingsKey) => key)
  const wide = props.wide !== false
  const [prefs, setPrefs] = useState<WebPanelPrefs>(() => (typeof localStorage === 'undefined'
    ? { enabled: true, position: 'sidebar', ball: null, winOffset: null, win: null, winSize: null }
    : loadPrefs()))
  const [chooser, setChooser] = useState(false)
  const [anchor, setAnchor] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const layerRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number>()

  useEffect(() => subscribePrefs(setPrefs), [])

  useEffect(() => () => {
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current)
  }, [])

  const openChooser = (): void => {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = undefined
    }
    if (!wide) return
    const rect = layerRef.current?.getBoundingClientRect()
    if (rect !== undefined) {
      // Fly out to the RIGHT of the sidebar so the popup never covers the
      // session list; fall back to the left side when there is no room.
      const width = 168
      const preferred = rect.right + 8
      const left = preferred + width > window.innerWidth
        ? Math.max(8, rect.left - width - 8)
        : preferred
      setAnchor({ left, top: rect.top + rect.height / 2 })
    }
    setChooser(true)
  }

  const scheduleClose = (): void => {
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setChooser(false), 250)
  }

  // A plain click honours the saved default instead of asking every time.
  const onToggle = (): void => {
    const current = loadPrefs()
    if (!current.enabled) return
    if (current.position === 'sidebar' && props.openPanelTab !== undefined) {
      props.openPanelTab()
      return
    }
    toggleWebPanel()
  }

  const setDefault = (position: WebPanelPosition): void => {
    savePrefs({ ...loadPrefs(), position })
    setChooser(false)
  }

  return (
    <div
      ref={layerRef}
      className="dsw-webpanel-toggle-layer"
      data-wide={wide ? '1' : '0'}
      onMouseEnter={openChooser}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="dsw-webpanel-toggle"
        aria-label={t('panelAction')}
        title={t('panelAction')}
        onClick={onToggle}
      >
        <span className="dsw-webpanel-toggle-icon" aria-hidden dangerouslySetInnerHTML={{ __html: WHALE_ICON }} />
        {wide ? <span className="dsw-webpanel-toggle-label">{t('panelAction')}</span> : null}
      </button>
      {wide && chooser ? (
        <div
          className="dsw-webpanel-chooser"
          role="menu"
          aria-label={t('panelPosition')}
          style={{ left: anchor.left, top: anchor.top, transform: 'translateY(-50%)' }}
        >
          <div className="dsw-webpanel-chooser-title">{t('panelPosition')}</div>
          {MODES.map(mode => (
            <button
              key={mode}
              type="button"
              role="menuitem"
              className={'dsw-webpanel-chooser-item' + (prefs.position === mode ? ' is-current' : '')}
              onClick={() => setDefault(mode)}
            >
              <span className="dsw-webpanel-chooser-dot" aria-hidden />
              {mode === 'ball' ? t('panelPositionBall') : t('panelPositionSidebar')}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
