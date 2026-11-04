import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { IconQueueOutline14, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  MENU_PANEL,
  MENU_REFRESH,
  MENU_RETRY,
  MENU_SIGN_IN,
  sessionMenuEntries,
} from './DeepSeekSessionsPopover.tsx'
import { HostMenuPanel } from './host-menu.tsx'
import type { DeepSeekWebSettingsKey } from './locales.ts'
import {
  POPOVER_Z_INDEX,
  positionSessionPopover,
  type PopoverPlacement,
} from './popover-position.ts'
import { RemoteSessionsController } from './RemoteSessionsController.ts'
import { openWebPanel } from './webpanel-bus.ts'
import { loadPrefs } from './webpanel-prefs.ts'

export interface DeepSeekSidebarActionInjected {
  t: (key: DeepSeekWebSettingsKey) => string
  openSession: (sessionId: string) => Promise<void>
  /** Open the docked sidebar tab (used when the panel position preference is "sidebar"). */
  openPanelTab?: (url?: string) => void
}

/** Route a panel-open request to the docked tab or the floating drawer. */
function openPanelPreferred(
  openPanelTab: ((url?: string) => void) | undefined,
  url?: string,
): void {
  if (loadPrefs().position === 'sidebar' && openPanelTab !== undefined) {
    openPanelTab(url)
    return
  }
  openWebPanel(url)
}

export type DeepSeekSidebarActionProps = Partial<DeepSeekSidebarActionInjected> & {
  wide?: boolean
}

const SIDEBAR_CSS_ID = 'dsh-deepseek-web/sidebar-action'
const SIDEBAR_CSS = [
  '.dsw-web-sessions-layer{flex:none;align-items:center;width:100%;height:42px;margin:8px 0 0;display:flex;position:relative}',
  '.dsw-web-sessions-layer[data-wide="0"]{width:36px;height:36px;margin:0}',
  '.dsw-web-sessions-badge{width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);cursor:pointer;background:transparent;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}',
  '.dsw-web-sessions-badge:hover,.dsw-web-sessions-badge[data-active]{background:var(--dsw-alias-interactive-bg-hover)}',
  '.dsw-web-sessions-layer[data-wide="0"] .dsw-web-sessions-badge{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:0;padding:0}',
  '.dsw-web-sessions-icon{flex:none;display:inline-flex;align-items:center}',
  '.dsw-web-sessions-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}',
].join('')

if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css=${JSON.stringify(SIDEBAR_CSS_ID)}]`) === null) {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-deepseek-web'
  tag.dataset.pluginCss = SIDEBAR_CSS_ID
  tag.textContent = SIDEBAR_CSS
  document.head.appendChild(tag)
}

function panelStyle(placement: PopoverPlacement): CSSProperties {
  return {
    position: 'fixed',
    left: placement.left,
    width: placement.width,
    maxHeight: placement.maxHeight,
    zIndex: POPOVER_Z_INDEX,
    ...(placement.bottom !== undefined ? { bottom: placement.bottom } : { top: placement.top }),
  }
}

export function DeepSeekSidebarAction(props: DeepSeekSidebarActionProps): JSX.Element {
  const t = props.t ?? ((key: DeepSeekWebSettingsKey) => key)
  const wide = props.wide !== false
  const [open, setOpen] = useState(false)
  const [openingId, setOpeningId] = useState<string | undefined>()
  const [openError, setOpenError] = useState<string | undefined>()
  const [placement, setPlacement] = useState<PopoverPlacement>()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const controllerRef = useRef<RemoteSessionsController>()
  if (controllerRef.current === undefined) controllerRef.current = new RemoteSessionsController()
  const controller = controllerRef.current
  const state = useSyncExternalStore(
    listener => controller.subscribe(listener),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  )

  useDismissOnOutsidePointer(rootRef, open, setOpen)

  const placeNow = useCallback((): PopoverPlacement | undefined => {
    const trigger = triggerRef.current
    if (trigger === null) return undefined
    const rect = trigger.getBoundingClientRect()
    return positionSessionPopover({
      anchor: rect,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      wide,
      width: Math.max(rect.width, 220),
    })
  }, [wide])

  useEffect(() => {
    controller.startBackgroundSync()
    void controller.ensureLoaded()
  }, [controller])

  useEffect(() => {
    if (!open) {
      setOpeningId(undefined)
      return
    }
    setOpenError(undefined)
    void controller.ensureLoaded()
  }, [open, controller])

  useLayoutEffect(() => {
    if (!open) return
    const update = (): void => {
      const next = placeNow()
      if (next !== undefined) setPlacement(next)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, placeNow, state.items.length, state.phase])

  useEffect(() => () => controller.dispose(), [controller])

  const menu = sessionMenuEntries(state, t, { openingId, error: openError })

  const onSelect = (id: string): void => {
    if (id === MENU_REFRESH) {
      void controller.refresh()
      return
    }
    if (id === MENU_RETRY) {
      void controller.retry()
      return
    }
    if (id === MENU_SIGN_IN) {
      void controller.beginLogin()
      return
    }
    if (id === MENU_PANEL) {
      setOpen(false)
      openWebPanel()
      return
    }
    if (id.startsWith('::')) return
    void openRemote(id)
  }

  const onPanel = (url: string): void => {
    setOpen(false)
    triggerRef.current?.focus()
    openWebPanel(url)
  }

  const openRemote = async (chatSessionId: string): Promise<void> => {
    if (openingId !== undefined) return
    setOpeningId(chatSessionId)
    setOpenError(undefined)
    try {
      const result = await controller.openRemote(chatSessionId)
      await props.openSession?.(result.sessionId)
      setOpen(false)
      triggerRef.current?.focus()
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : t('sessionsOpenFailed'))
    } finally {
      setOpeningId(undefined)
    }
  }

  const onReachEnd = useCallback((): void => {
    void controller.loadMore()
  }, [controller])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="dsw-web-sessions-layer" data-wide={wide ? '1' : '0'}>
      <button
        ref={triggerRef}
        type="button"
        className="dsw-web-sessions-badge"
        data-active={open ? '' : undefined}
        aria-label={t('sessionsAction')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (open) {
            setOpen(false)
            return
          }
          const next = placeNow()
          if (next !== undefined) setPlacement(next)
          setOpen(true)
        }}
      >
        <span className="dsw-web-sessions-icon" aria-hidden>
          <IconQueueOutline14 size={wide ? 14 : 18} />
        </span>
        {wide ? <span className="dsw-web-sessions-label">{t('sessionsAction')}</span> : null}
      </button>
      {open && placement !== undefined ? (
        <HostMenuPanel
          label={t('sessionsTitle')}
          items={menu.items}
          footer={menu.footer}
          onSelect={onSelect}
          onPanel={onPanel}
          onKeyDown={onKeyDown}
          onReachEnd={state.phase === 'ready' && state.nextCursor !== undefined ? onReachEnd : undefined}
          style={panelStyle(placement)}
        />
      ) : null}
    </div>
  )
}
