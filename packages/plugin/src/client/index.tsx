import type { ClientContext, HarnessWorkspacesLike } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { DeepSeekWebSettings } from './DeepSeekWebSettings.tsx'
import type { DeepSeekWebSettingsInjected } from './DeepSeekWebSettings.tsx'
import { DeepSeekPanelToggle } from './DeepSeekPanelToggle.tsx'
import type { DeepSeekPanelToggleInjected } from './DeepSeekPanelToggle.tsx'
import { DeepSeekWebPanel } from './DeepSeekWebPanel.tsx'
import type { DeepSeekWebPanelInjected } from './DeepSeekWebPanel.tsx'
import { DeepSeekWebPanelTab } from './DeepSeekWebPanelTab.tsx'
import type { DeepSeekWebPanelTabInjected } from './DeepSeekWebPanelTab.tsx'
import { ForkToWorkspaceAction } from './ForkToWorkspaceAction.tsx'
import { en, zh } from './locales.ts'
import type { DeepSeekWebSettingsKey } from './locales.ts'
import {
  PANEL_TAB_KIND,
  FORK_ACTION_ID,
  FORK_ACTION_ORDER,
  FORK_ACTION_SLOT,
  PANEL_ID,
  PANEL_ORDER,
  PANEL_SLOT,
  SIDEBAR_ACTION_ID,
  SIDEBAR_ACTION_ORDER,
  SIDEBAR_ACTION_SLOT,
} from './slot-ids.ts'
import { openHarnessSession } from './wait-for-session.ts'
import { openWebPanel } from './webpanel-bus.ts'
import type { WorkspaceChoice } from './WorkspaceForkPopover.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.deepseek-web': DeepSeekWebSettingsKey
  }
}

export const name = 'dsh-deepseek-web-client'
export const inject = ['slots', 'locale', 'sessions', 'workspaces', 'sidebarRight', 'sidebarRightTabs']

function workspaceChoices(workspaces: HarnessWorkspacesLike | undefined): WorkspaceChoice[] {
  const items = workspaces?.list?.getSnapshot()?.items ?? []
  const choices = items.flatMap(item => {
    const id = item.workspaceId ?? item.id
    if (id === undefined || typeof item.path !== 'string') return []
    return [{ id, title: item.title ?? item.path, path: item.path }]
  })
  return choices.sort((left, right) => {
    if (left.title === 'DeepSeek Chat') return -1
    if (right.title === 'DeepSeek Chat') return 1
    return 0
  })
}

export function apply(ctx: ClientContext): void {
  const namespace = 'settings.deepseek-web'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-deepseek-web: settings copy')
  const t = ctx.locale.bind(namespace) as DeepSeekWebSettingsInjected['t']
  const openSession = (sessionId: string) => openHarnessSession(ctx.sessions, sessionId)
  // Docked variant: one tab inside the right sidebar (better-sidebar renders official
  // tab types, so this surfaces next to its built-in browser tab).
  const openPanelTab = (url?: string) => {
    try {
      ctx.sidebarRight?.openTab?.(PANEL_TAB_KIND, url !== undefined && url.length > 0 ? { params: { url } } : {})
    } catch {
      // sidebarRight can be absent when no session surface is mounted yet.
    }
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'deepseek-web',
    order: 16,
    label: () => t('nav'),
    inject: (): DeepSeekWebSettingsInjected => ({ t, openPanelTab }),
  }, DeepSeekWebSettings))

  ctx.slots.inject(SIDEBAR_ACTION_SLOT, () => ctx.slots.register({
    name: SIDEBAR_ACTION_SLOT,
    id: SIDEBAR_ACTION_ID,
    order: SIDEBAR_ACTION_ORDER,
    locale: namespace,
    inject: (): DeepSeekPanelToggleInjected => ({ t, openPanelTab }),
  }, DeepSeekPanelToggle))

  ctx.slots.inject(FORK_ACTION_SLOT, () => ctx.slots.register({
    name: FORK_ACTION_SLOT,
    id: FORK_ACTION_ID,
    order: FORK_ACTION_ORDER,
    locale: namespace,
    inject: (sessionId: string) => ({
      t,
      sourceSessionId: sessionId,
      openSession,
      loadWorkspaces: async () => {
        await ctx.workspaces?.refresh?.()
        return workspaceChoices(ctx.workspaces)
      },
    }),
  }, ForkToWorkspaceAction))

  ctx.slots.inject(PANEL_SLOT, () => ctx.slots.register({
    name: PANEL_SLOT,
    id: PANEL_ID,
    order: PANEL_ORDER,
    locale: namespace,
    inject: (): DeepSeekWebPanelInjected => ({ t, openPanelTab }),
  }, DeepSeekWebPanel))

  ctx.effect(() => ctx.sidebarRightTabs?.register?.({
    id: PANEL_TAB_KIND,
    kind: PANEL_TAB_KIND,
    priority: 'builtin',
    title: () => t('panelTitle'),
    multiple: true,
    keepMounted: true,
  }), 'dsh-deepseek-web-free: panel tab type')

  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: PANEL_TAB_KIND,
    locale: namespace,
    inject: (): DeepSeekWebPanelTabInjected => ({ t, openFloatPanel: openWebPanel }),
  }, DeepSeekWebPanelTab))
}
