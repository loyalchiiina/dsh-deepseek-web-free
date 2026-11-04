/**
 * Renderer-side preferences for the embedded DeepSeek web panel.
 *
 * These stay in localStorage rather than the Host config schema on purpose:
 * they are pure presentation choices for one renderer (which shape the panel
 * takes, where the floating ball sits, how big the ball window is), and the
 * Host never needs to read them.
 */
export type WebPanelPosition = 'sidebar' | 'ball'

export interface WebPanelPoint {
  x: number
  y: number
}

export interface WebPanelSize {
  width: number
  height: number
}

export interface WebPanelPrefs {
  enabled: boolean
  /** Where the panel lives: a docked right-sidebar tab (default) or the floating ball. */
  position: WebPanelPosition
  /** Last floating-ball position, in viewport pixels. Null means "not placed yet". */
  ball: WebPanelPoint | null
  /**
   * Chat-window position *relative to the ball*, in viewport pixels.
   *
   * Storing the offset instead of an absolute point is what keeps the window glued
   * to the ball: move the ball and the window travels with it. Null means "park the
   * window beside the ball", which also follows the ball.
   */
  winOffset: WebPanelPoint | null
  /** Legacy absolute window position (pre-1.0.15). Only read to derive `winOffset`. */
  win: WebPanelPoint | null
  /** Last chat-window size, in viewport pixels. Null means "use the default size". */
  winSize: WebPanelSize | null
}

export const WEBPANEL_DEFAULT_URL = 'https://chat.deepseek.com'

const STORAGE_KEY = 'dsh.deepseek-web.webpanel.v1'

export const DEFAULT_WEBPANEL_PREFS: WebPanelPrefs = {
  enabled: true,
  position: 'sidebar',
  ball: null,
  winOffset: null,
  win: null,
  winSize: null,
}

type Listener = (prefs: WebPanelPrefs) => void

const listeners = new Set<Listener>()

function readPoint(value: unknown): WebPanelPoint | null {
  if (value === null || typeof value !== 'object') return null
  const candidate = value as { x?: unknown; y?: unknown }
  if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') return null
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return null
  return { x: Math.round(candidate.x), y: Math.round(candidate.y) }
}

function readSize(value: unknown): WebPanelSize | null {
  if (value === null || typeof value !== 'object') return null
  const candidate = value as { width?: unknown; height?: unknown }
  if (typeof candidate.width !== 'number' || typeof candidate.height !== 'number') return null
  if (!Number.isFinite(candidate.width) || !Number.isFinite(candidate.height)) return null
  return { width: Math.round(candidate.width), height: Math.round(candidate.height) }
}

function normalizePosition(value: unknown): WebPanelPosition {
  // 'float' was the old drawer mode; it now maps onto the floating ball.
  return value === 'ball' || value === 'float' ? 'ball' : 'sidebar'
}

/** Derive a ball-relative offset from the legacy absolute window position. */
function deriveOffset(win: WebPanelPoint | null, ball: WebPanelPoint | null): WebPanelPoint | null {
  if (win === null || ball === null) return null
  return { x: win.x - ball.x, y: win.y - ball.y }
}

export function loadPrefs(): WebPanelPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null || raw.length === 0) return { ...DEFAULT_WEBPANEL_PREFS }
    const parsed = JSON.parse(raw) as Partial<WebPanelPrefs>
    const ball = readPoint(parsed.ball)
    const legacyWin = readPoint(parsed.win)
    return {
      enabled: parsed.enabled !== false,
      position: normalizePosition(parsed.position),
      ball,
      winOffset: readPoint(parsed.winOffset) ?? deriveOffset(legacyWin, ball),
      win: legacyWin,
      winSize: readSize(parsed.winSize),
    }
  } catch {
    return { ...DEFAULT_WEBPANEL_PREFS }
  }
}

export function savePrefs(next: WebPanelPrefs): void {
  const normalized: WebPanelPrefs = {
    enabled: next.enabled,
    position: normalizePosition(next.position),
    ball: readPoint(next.ball),
    winOffset: readPoint(next.winOffset),
    win: null,
    winSize: readSize(next.winSize),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Private-mode or quota failures simply leave the defaults in force.
  }
  for (const listener of [...listeners]) {
    try {
      listener(normalized)
    } catch {
      // Ignore a broken subscriber.
    }
  }
}

export function subscribePrefs(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
