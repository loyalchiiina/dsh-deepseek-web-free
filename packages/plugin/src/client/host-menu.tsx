import type { CSSProperties, KeyboardEvent, ReactNode, Ref } from 'react'
import { useEffect, useRef } from 'react'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * A menu row may carry an extra deep link that opens the same conversation in
 * the embedded DeepSeek web panel instead of materializing a harness session.
 */
export type HostMenuRow = MenuEntry & { panelUrl?: string; panelLabel?: string }

export interface HostMenuPanelProps {
  items: readonly HostMenuRow[]
  footer?: readonly HostMenuRow[]
  onSelect: (id: string) => void
  onPanel?: (url: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  onReachEnd?: () => void
  style?: CSSProperties
  label?: string
  panelRef?: Ref<HTMLDivElement>
}

const HOST_MENU_CSS_ID = 'dsh-deepseek-web/host-menu'
const HOST_MENU_CSS = [
  // Opaque layer background: the menu floats over chat content and must never bleed through.
  '.dsw-web-menu{z-index:1100;box-sizing:border-box;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-alias-bg-layer-3);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);border-radius:12px;flex-direction:column;padding:4px;display:flex;overflow:hidden}',
  '.dsw-web-menu-viewport{flex:1 1 auto;flex-direction:column;min-height:0;display:flex;overflow-y:auto}',
  '.dsw-web-menu-footer{flex:none;flex-direction:column;margin-top:4px;padding-top:4px;border-top:1px solid var(--dsw-alias-border-l2);display:flex}',
  '.dsw-web-menu-item{cursor:pointer;width:100%;min-height:40px;color:var(--dsw-alias-label-primary);text-align:left;background:transparent;border:none;border-radius:10px;align-items:center;gap:8px;padding:8px 10px;font:inherit;font-size:14px;line-height:22px;display:flex}',
  '.dsw-web-menu-item:hover:not(:disabled),.dsw-web-menu-item:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
  '.dsw-web-menu-item:disabled{opacity:.4;cursor:default}',
  '.dsw-web-menu-item-icon{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-secondary)}',
  '.dsw-web-menu-item-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}',
  '.dsw-web-menu-label{color:var(--dsw-alias-label-tertiary);padding:8px 10px;font-size:12px;line-height:18px}',
  '.dsw-web-menu-separator{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l2);border:none}',
  '.dsw-web-menu-sentinel{flex:none;height:1px;width:100%;pointer-events:none}',
  '.dsw-web-menu-row{align-items:center;gap:4px;display:flex}',
  '.dsw-web-menu-row>.dsw-web-menu-item{flex:1 1 auto;min-width:0}',
  '.dsw-web-menu-side{flex:none;height:28px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px;line-height:18px}',
  '.dsw-web-menu-side:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
].join('')

if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css=${JSON.stringify(HOST_MENU_CSS_ID)}]`) === null) {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-deepseek-web'
  tag.dataset.pluginCss = HOST_MENU_CSS_ID
  tag.textContent = HOST_MENU_CSS
  document.head.appendChild(tag)
}

export function HostMenuPanel(props: HostMenuPanelProps): JSX.Element {
  const footer = props.footer
  const viewportRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onReachEnd = props.onReachEnd
  const onReachEndRef = useRef(onReachEnd)
  onReachEndRef.current = onReachEnd

  useEffect(() => {
    if (onReachEnd === undefined) return
    const root = viewportRef.current
    const sentinel = sentinelRef.current
    if (root === null || sentinel === null) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onReachEndRef.current?.()
    }, { root, rootMargin: '48px 0px', threshold: 0 })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [onReachEnd, props.items.length])

  return (
    <div
      ref={props.panelRef}
      className="dsw-web-menu"
      role="menu"
      aria-label={props.label}
      style={props.style}
      onKeyDown={props.onKeyDown}
      onClick={event => event.stopPropagation()}
    >
      <div ref={viewportRef} className="dsw-web-menu-viewport" role="presentation">
        {props.items.map(entry => (
          <HostMenuEntryView key={entry.id} entry={entry} onSelect={props.onSelect} onPanel={props.onPanel} />
        ))}
        {onReachEnd !== undefined ? <div ref={sentinelRef} className="dsw-web-menu-sentinel" aria-hidden /> : null}
      </div>
      {footer !== undefined && footer.length > 0 ? (
        <div className="dsw-web-menu-footer" role="presentation">
          {footer.map(entry => (
            <HostMenuEntryView key={entry.id} entry={entry} onSelect={props.onSelect} onPanel={props.onPanel} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function HostMenuEntryView(props: {
  entry: HostMenuRow
  onSelect: (id: string) => void
  onPanel?: (url: string) => void
}): JSX.Element {
  const { entry, onSelect, onPanel } = props
  if ('type' in entry && entry.type === 'separator') {
    return <hr className="dsw-web-menu-separator" />
  }
  if ('type' in entry && entry.type === 'label') {
    return (
      <div className="dsw-web-menu-label" role="presentation">
        {entry.text}
      </div>
    )
  }
  const row = (
    <button
      type="button"
      role="menuitem"
      className="dsw-web-menu-item"
      disabled={entry.disabled === true}
      onClick={() => onSelect(entry.id)}
    >
      {entry.icon !== undefined ? <span className="dsw-web-menu-item-icon" aria-hidden>{entry.icon}</span> : null}
      <span className="dsw-web-menu-item-label">{entry.label as ReactNode}</span>
    </button>
  )
  if (entry.panelUrl === undefined || onPanel === undefined) return row
  return (
    <div className="dsw-web-menu-row">
      {row}
      <button
        type="button"
        className="dsw-web-menu-side"
        title={entry.panelLabel}
        aria-label={entry.panelLabel}
        onClick={() => onPanel(entry.panelUrl as string)}
      >
        {entry.panelLabel}
      </button>
    </div>
  )
}
