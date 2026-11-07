/**
 * The menu shown when the user right‑clicks a piece of selected conversation text.
 *
 * The host renders the official read‑only selection menu as an Electron *native*
 * menu with a single "复制" item, which a plugin cannot extend. So the interaction
 * handler calls `preventDefault()` (suppressing the native menu) and this component
 * renders the same single official item plus "复制到 DeepSeek 网页", styled to match
 * the native menu (white rounded popup, 32 px rows).
 *
 * The component is intentionally hook‑free: the host passes `readText` / `dismiss`
 * / `clearSelection` as props.
 */
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { copyToClipboard, openPanelAndInsert, showToast } from './selection-support.ts'

export interface SelectionActionsProps {
  trigger?: string
  readText?: () => string | null
  dismiss?: () => void
  clearSelection?: () => void
}

// Windows 11 native context menu look: light surface, 8 px radius, 32 px rows.
const MENU_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0px',
  minWidth: '188px',
  padding: '4px',
  borderRadius: '8px',
  background: '#f9f9f9',
  color: '#1b1b1b',
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  fontFamily: '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif',
}

const ITEM_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: '32px',
  padding: '0 12px',
  borderRadius: '4px',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  fontSize: '13px',
  lineHeight: '32px',
  textAlign: 'left',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
}

const ITEM_HOVER_BG = '#eaeaea'

function readSelection(props: SelectionActionsProps): string | null {
  const text = props.readText?.()
  if (typeof text !== 'string' || text.trim() === '') return null
  return text
}

/** A single menu row that keeps the browser selection alive while it is pressed. */
function MenuItem(props: { label: string; onRun: () => void }): ReactElement {
  return (
    <button
      type="button"
      role="menuitem"
      style={ITEM_STYLE}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault()
      }}
      onMouseEnter={(event: ReactMouseEvent<HTMLButtonElement>) => {
        event.currentTarget.style.background = ITEM_HOVER_BG
      }}
      onMouseLeave={(event: ReactMouseEvent<HTMLButtonElement>) => {
        event.currentTarget.style.background = 'transparent'
      }}
      onClick={() => {
        props.onRun()
      }}
    >
      {props.label}
    </button>
  )
}

export function SelectionActions(props: SelectionActionsProps): ReactElement {
  const onCopy = (): void => {
    const text = readSelection(props)
    if (text === null) {
      props.dismiss?.()
      return
    }
    props.clearSelection?.()
    props.dismiss?.()
    void copyToClipboard(text).then((ok) => {
      showToast(ok ? '已复制' : '复制失败，请重试')
    })
  }

  const onCopyToWeb = (): void => {
    const text = readSelection(props)
    if (text === null) {
      props.dismiss?.()
      return
    }
    props.clearSelection?.()
    props.dismiss?.()
    showToast('正在打开 DeepSeek 网页…')
    void openPanelAndInsert(text).then((outcome) => {
      if (outcome === 'ok') {
        showToast('已复制到 DeepSeek 网页输入框')
      } else if (outcome === 'timeout') {
        showToast('打开 DeepSeek 网页超时，请先手动打开面板再试')
      } else {
        void copyToClipboard(text).then((copied) => {
          showToast(copied ? '写入失败，已复制到剪贴板，请到 DeepSeek 输入框按 Ctrl+V' : '写入 DeepSeek 网页失败，请重试')
        })
      }
    })
  }

  return (
    <div
      role="menu"
      aria-label="选中文字操作"
      data-dsw-selection-menu=""
      style={MENU_STYLE}
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault()
      }}
      onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault()
      }}
    >
      <MenuItem label="复制" onRun={onCopy} />
      <MenuItem label="复制到 DeepSeek 网页" onRun={onCopyToWeb} />
    </div>
  )
}
