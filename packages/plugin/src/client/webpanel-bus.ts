/**
 * Tiny cross-component channel for the embedded DeepSeek web panel.
 *
 * The sidebar footer toggle, the settings section and the panel itself are
 * three different slots rendered in three different subtrees, so they cannot
 * share React state. A module-level listener set is the smallest thing that
 * lets any of them say "open (or toggle) the panel, optionally at this deep link".
 */
export type WebPanelSurface = 'ball' | 'sidebar'
export type WebPanelRequest = { url?: string; toggle?: boolean; close?: WebPanelSurface }

type Listener = (request: WebPanelRequest) => void

const listeners = new Set<Listener>()

function dispatch(request: WebPanelRequest): void {
  for (const listener of [...listeners]) {
    try {
      listener(request)
    } catch {
      // A broken listener must not stop the others from reacting.
    }
  }
}

export function openWebPanel(url?: string): void {
  dispatch(url === undefined ? {} : { url })
}

/** Ask the panel to flip between hidden and shown (only meaningful for the ball). */
export function toggleWebPanel(): void {
  dispatch({ toggle: true })
}

export function subscribeWebPanel(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Ask one surface to tear itself down. Only one DeepSeek webview may be alive at a
 * time: the two surfaces share one storage partition, and keeping both attached
 * makes the second guest come up blank / wedged.
 */
export function closeWebPanelSurface(surface: WebPanelSurface): void {
  dispatch({ close: surface })
}
