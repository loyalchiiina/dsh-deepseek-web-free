import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import {
  IconFolderOpenOutlineRegular,
  Tooltip,
  useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { FORK_PATH, pluginFetch } from './api.ts'
import { HostMenuPanel } from './host-menu.tsx'
import type { DeepSeekWebSettingsKey } from './locales.ts'
import {
  POPOVER_Z_INDEX,
  positionSessionPopover,
  type PopoverPlacement,
} from './popover-position.ts'
import { workspaceMenuEntries, type WorkspaceChoice } from './WorkspaceForkPopover.tsx'

export interface ForkToWorkspaceActionInjected {
  t: (key: DeepSeekWebSettingsKey) => string
  sourceSessionId: string
  loadWorkspaces: () => Promise<WorkspaceChoice[]>
  openSession: (sessionId: string) => Promise<void>
}

export type ForkToWorkspaceActionProps = Partial<ForkToWorkspaceActionInjected> & {
  messageId?: string
  sessionId?: string
}

const FORK_CSS_ID = 'dsh-deepseek-web/fork-action'
const FORK_CSS = [
  '.dsw-web-fork-layer{position:relative;display:inline-flex;order:1;flex:none}',
  '[data-turn-tail] [class*="actions"]>span[class*="timeEnd"],[data-turn-tail] [class*="actions"]>span[class*="timeStart"]{order:2}',
  '.dsw-web-fork-action{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:6px;border:none;border-radius:28px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}',
  '.dsw-web-fork-action:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
  '.dsw-web-fork-action:disabled{opacity:.4;cursor:default}',
].join('')

if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css=${JSON.stringify(FORK_CSS_ID)}]`) === null) {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-deepseek-web'
  tag.dataset.pluginCss = FORK_CSS_ID
  tag.textContent = FORK_CSS
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

export function ForkToWorkspaceAction(props: ForkToWorkspaceActionProps): JSX.Element | null {
  const t = props.t ?? ((key: DeepSeekWebSettingsKey) => key)
  const messageId = props.messageId
  const sourceSessionId = props.sourceSessionId ?? props.sessionId
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [workspaces, setWorkspaces] = useState<WorkspaceChoice[]>([])
  const [placement, setPlacement] = useState<PopoverPlacement>()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useDismissOnOutsidePointer(rootRef, open, setOpen)

  const visibleWorkspaces = useMemo(
    () => workspaces.filter(workspace => workspace.path.length > 0),
    [workspaces],
  )
  const menu = workspaceMenuEntries(t, visibleWorkspaces, { pending, error })
  const placeNow = useCallback((): PopoverPlacement | undefined => {
    const trigger = triggerRef.current
    if (trigger === null) return undefined
    const rect = trigger.getBoundingClientRect()
    return positionSessionPopover({
      anchor: rect,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      wide: true,
      width: Math.max(rect.width, 220),
    })
  }, [])

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
  }, [open, placeNow, visibleWorkspaces.length])

  if (messageId === undefined || sourceSessionId === undefined) return null

  const prefetch = (): void => {
    if (props.loadWorkspaces === undefined) return
    void props.loadWorkspaces().then(setWorkspaces).catch(() => undefined)
  }

  const onOpen = async (): Promise<void> => {
    setError(undefined)
    const next = placeNow()
    if (next !== undefined) setPlacement(next)
    setOpen(true)
    try {
      setWorkspaces(await (props.loadWorkspaces?.() ?? Promise.resolve([])))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('forkFailed'))
    }
  }

  const onSelect = async (id: string): Promise<void> => {
    if (id === '::cancel') {
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (pending) return
    setPending(true)
    setError(undefined)
    try {
      const result = await pluginFetch(FORK_PATH, {
        method: 'POST',
        body: JSON.stringify({
          sourceSessionId,
          messageId,
          workspaceId: id,
        }),
      }) as { childSessionId?: string }
      if (typeof result.childSessionId !== 'string') throw new Error(t('forkFailed'))
      await props.openSession?.(result.childSessionId)
      setOpen(false)
      triggerRef.current?.focus()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('forkFailed'))
    } finally {
      setPending(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="dsw-web-fork-layer">
      <Tooltip label={t('forkAction')} side="bottom">
        <button
          ref={triggerRef}
          type="button"
          className="dsw-web-fork-action"
          aria-label={t('forkAction')}
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={pending}
          onMouseEnter={prefetch}
          onFocus={prefetch}
          onClick={() => {
            if (open) setOpen(false)
            else void onOpen()
          }}
        >
          <IconFolderOpenOutlineRegular />
        </button>
      </Tooltip>
      {open && placement !== undefined ? (
        <HostMenuPanel
          label={t('forkTitle')}
          items={menu.items}
          footer={menu.footer}
          onSelect={id => { void onSelect(id) }}
          onKeyDown={onKeyDown}
          style={panelStyle(placement)}
        />
      ) : null}
    </div>
  )
}
