/**
 * Registers the "right‑click a selection" menu with the host.
 *
 * The host exposes `uiConversation.interactions` for exactly this gesture: a plugin
 * supplies a synchronous handler keyed by an id, and the host renders a matching
 * keyed Slot entry of the same id when the handler calls `open()`. We only open on
 * the `contextmenu` trigger and call `preventDefault()` so the host's native
 * single-item "复制" menu is replaced by one menu that also carries our
 * "复制到 DeepSeek 网页" row (a native menu cannot be extended by a plugin).
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { SelectionActions } from './SelectionActions.tsx'

/** Stable id shared by the interaction handler and its keyed Slot renderer. */
export const SELECTION_INTERACTION_ID = 'deepseek-web-selection-copy'

const TEXT_INTERACTION_SLOT = 'conversation.chat.text-interaction'

interface InteractionRequest {
  trigger?: string
  sessionId?: string
  hasSelection?: boolean
  readText?: () => string | null
  open?: () => void
  preventDefault?: () => void
}

interface InteractionsService {
  register?: (definition: { id: string; onInteraction: (request: InteractionRequest) => void }) => () => void
}

/**
 * Wire the selection menu into the given client root context.
 * Safe to call when the conversation service is absent (older host): it no-ops.
 */
export function registerSelectionActions(ctx: ClientContext): void {
  const context = ctx as unknown as {
    uiConversation?: { interactions?: InteractionsService }
    slots?: {
      inject?: (name: string, factory: () => unknown) => unknown
      register?: (definition: unknown, component: unknown) => unknown
    }
  }

  const interactions = context.uiConversation?.interactions
  const slots = context.slots
  if (interactions?.register === undefined || slots?.inject === undefined || slots.register === undefined) {
    return
  }

  ctx.effect(
    () =>
      interactions.register!({
        id: SELECTION_INTERACTION_ID,
        onInteraction(request: InteractionRequest): void {
          // Only the right‑click gesture belongs to this menu.
          if (request.trigger !== 'contextmenu') return
          const text = request.readText?.()
          if (typeof text !== 'string' || text.trim() === '') return
          // The host's native read-only menu offers only "复制"; suppress it so the
          // single web menu (复制 + 复制到 DeepSeek 网页) replaces it instead of
          // overlapping it.
          request.preventDefault?.()
          request.open?.()
        },
      }),
    'dsh-deepseek-web-free: selection copy interaction',
  )

  slots.inject(TEXT_INTERACTION_SLOT, () =>
    slots.register!(
      {
        name: TEXT_INTERACTION_SLOT,
        key: SELECTION_INTERACTION_ID,
      },
      SelectionActions,
    ),
  )
}
