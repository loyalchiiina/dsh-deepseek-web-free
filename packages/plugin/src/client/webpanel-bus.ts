/**
 * Tiny cross-component channel for the embedded DeepSeek web panel.
 *
 * The sidebar footer toggle, the settings section and the panel itself are
 * three different slots rendered in three different subtrees, so they cannot
 * share React state. A module-level listener set is the smallest thing that
 * lets any of them say "open (or toggle) the panel, optionally at this deep link".
 */
export type WebPanelRequest = { url?: string; toggle?: boolean }

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
