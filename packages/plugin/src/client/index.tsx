import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { DeepSeekPanelToggle } from './DeepSeekPanelToggle.tsx'
import type { DeepSeekPanelToggleInjected } from './DeepSeekPanelToggle.tsx'
import { DeepSeekWebPanel } from './DeepSeekWebPanel.tsx'
import type { DeepSeekWebPanelInjected } from './DeepSeekWebPanel.tsx'
import { DeepSeekWebPanelTab } from './DeepSeekWebPanelTab.tsx'
import type { DeepSeekWebPanelTabInjected } from './DeepSeekWebPanelTab.tsx'
import { en, zh } from './locales.ts'
import type { DeepSeekWebSettingsKey } from './locales.ts'
import {
  PANEL_TAB_KIND,
  PANEL_ID,
  PANEL_ORDER,
  PANEL_SLOT,
  SIDEBAR_ACTION_ID,
  SIDEBAR_ACTION_ORDER,
  SIDEBAR_ACTION_SLOT,
} from './slot-ids.ts'
import { openWebPanel } from './webpanel-bus.ts'
import { registerSelectionActions } from './selection-actions.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.deepseek-web': DeepSeekWebSettingsKey
  }
}

export const name = 'dsh-deepseek-web-client'
export const inject = ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs', 'uiConversation']

export function apply(ctx: ClientContext): void {
  const namespace = 'settings.deepseek-web'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'dsh-deepseek-web: settings copy')
  const t = ctx.locale.bind(namespace) as (key: DeepSeekWebSettingsKey) => string
  // The settings.section page was removed in 1.0.44 after a real account ban: the
  // plugin is now panel-only. Sign-in state, sign-out (the official page's own
  // sign-out also clears the Host credential via WebPanelAuthBanner) and panel
  // position all live in the panel surfaces themselves.
  // Docked variant: one tab inside the right sidebar (better-sidebar renders official
  // tab types, so this surfaces next to its built-in browser tab).
  const openPanelTab = (url?: string) => {
    try {
      ctx.sidebarRight?.openTab?.(PANEL_TAB_KIND, url !== undefined && url.length > 0 ? { params: { url } } : {})
    } catch {
      // sidebarRight can be absent when no session surface is mounted yet.
    }
  }

  ctx.slots.inject(SIDEBAR_ACTION_SLOT, () => ctx.slots.register({
    name: SIDEBAR_ACTION_SLOT,
    id: SIDEBAR_ACTION_ID,
    order: SIDEBAR_ACTION_ORDER,
    locale: namespace,
    inject: (): DeepSeekPanelToggleInjected => ({ t, openPanelTab }),
  }, DeepSeekPanelToggle))

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

  // Right-click a selection in any DSH conversation → "复制到 DeepSeek 网页":
  // opens the panel and pastes the text into the official chat.deepseek.com input.
  registerSelectionActions(ctx)
}
