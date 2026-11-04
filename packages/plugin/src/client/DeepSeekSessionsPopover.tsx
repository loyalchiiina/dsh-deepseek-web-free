import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import { IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostMenuRow } from './host-menu.tsx'
import type { DeepSeekWebSettingsKey } from './locales.ts'
import type { RemoteSessionsState } from './remote-session-types.ts'

export const MENU_REFRESH = '::refresh'
export const MENU_RETRY = '::retry'
export const MENU_SIGN_IN = '::signin'
export const MENU_PANEL = '::panel'

/** chat.deepseek.com deep link for one remote conversation. */
export function deepLinkFor(chatSessionId: string): string {
  return `https://chat.deepseek.com/a/chat/s/${chatSessionId}`
}

export function sessionMenuEntries(
  state: RemoteSessionsState,
  t: (key: DeepSeekWebSettingsKey) => string,
  options?: { openingId?: string; error?: string },
): { items: HostMenuRow[]; footer?: MenuEntry[] } {
  const openingId = options?.openingId
  const error = options?.error
  const items: HostMenuRow[] = []
  if (error !== undefined) {
    items.push({ type: 'label', id: 'open-error', text: error })
  }
  if (state.phase === 'signed-out') {
    items.push({ type: 'label', id: 'signed-out', text: t('sessionsSignedOut') })
  } else if ((state.phase === 'idle' || state.phase === 'loading') && state.items.length === 0) {
    items.push({ id: '::loading', label: t('sessionsLoading'), disabled: true })
  } else if (state.phase === 'error' && state.items.length === 0) {
    items.push({ type: 'label', id: 'error', text: state.error })
  } else if (state.phase === 'ready' && state.items.length === 0) {
    items.push({ type: 'label', id: 'empty', text: t('sessionsEmpty') })
  } else {
    for (const item of state.items) {
      const opening = openingId === item.chatSessionId
      items.push({
        id: item.chatSessionId,
        label: opening ? `${item.title || item.chatSessionId}  ${t('sessionsOpening')}` : (item.title || item.chatSessionId),
        disabled: openingId !== undefined,
        panelUrl: deepLinkFor(item.chatSessionId),
        panelLabel: t('panelOpenShort'),
      })
    }
    if (state.phase === 'loading-more') {
      items.push({ id: '::loading', label: t('sessionsLoading'), disabled: true })
    }
  }

  const footer: MenuEntry[] = []
  if (state.phase === 'signed-out') {
    footer.push({ id: MENU_SIGN_IN, label: t('sessionsSignIn') })
  } else if (state.phase === 'error' && state.items.length === 0) {
    footer.push({ id: MENU_RETRY, label: t('sessionsRetry') })
  } else if (state.phase === 'ready' || state.phase === 'loading-more') {
    footer.push({
      id: MENU_REFRESH,
      label: t('sessionsRefresh'),
      icon: <IconRefreshOutline16 />,
    })
  }
  if (state.phase !== 'signed-out') {
    footer.push({ id: MENU_PANEL, label: t('panelAction') })
  }

  return footer.length > 0 ? { items, footer } : { items }
}
