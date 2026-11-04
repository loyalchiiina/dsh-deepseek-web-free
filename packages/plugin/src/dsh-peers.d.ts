declare module '@deepseek-ai/dsh-llm' {
  export class LlmAdapter {
    providerInfo?(provider: string): { id: string; name: string }
    providerRetryPolicy?(provider: string): unknown
    listModels?(provider: string): Promise<readonly LlmModelInfo[]>
    resolveModel?(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>
  }
  export class LlmError extends Error {
    code: string
    constructor(message: string, code: string, options?: ErrorOptions)
  }
  export function ReasoningEffortId(id: string): string
  export function createUserMessage<T extends { content: unknown; source: unknown }>(
    input: T,
  ): T & { id: string; role: 'user' }
  export function createAssistantMessage(input: {
    content: unknown
    source: { provider: string; model: string; replayState?: unknown }
  }): {
    id: string
    role: 'assistant'
    content: unknown
    source: { kind: 'model'; provider: string; model: string; replayState?: unknown }
  }
  export interface LlmModelInfo {
    provider: string
    id: string
    name: string
    description?: string
    inputModalities?: readonly string[]
  }
  export interface LlmResolvedModelInfo extends LlmModelInfo {
    reasoning?: { efforts: readonly { id: string; name: string }[]; defaultEffort?: string }
  }
  export interface LlmProviderInfo { id: string; name: string }
  export interface ToolSchema { name: string; description: string; parameters: Record<string, unknown> }
  export interface GenerateOptions {
    provider: string
    model: string
    reasoningEffort?: string
    messages: unknown[]
    system?: string
    tools?: ToolSchema[]
    signal?: AbortSignal
    sessionId?: string
    purpose?: 'compaction' | 'session-title'
  }
  export type StreamChunk =
    | { type: 'block-start'; index: number; blockType: string }
    | { type: 'text-delta'; index: number; text: string }
    | { type: 'reasoning-delta'; index: number; text: string }
    | { type: 'tool-call-delta'; index: number; id: string; name?: string; argumentsDelta: string }
    | { type: 'block-end'; index: number; block: Record<string, unknown> }
    | { type: 'usage'; usage: unknown }
    | { type: 'finish'; reason: unknown; replayState?: unknown }
}

declare module '@deepseek-ai/cordis' {
  export interface Context {
    llm: {
      registerConfigurableProviders(entries: unknown[]): unknown
      registerAdapter(providers: string[], adapter: unknown): { replace(providers: string[]): void }
    }
    logger: { error(...args: unknown[]): void }
    get(name: string): unknown
    provide(name: string, value: unknown): void
    inject(deps: string[], fn: (ctx: Context) => void): void
    effect(fn: () => unknown, name?: string): () => void
    commands: { register(def: unknown): () => void }
    webServer: {
      register(route: {
        kind: 'exact' | 'prefix'
        path: string
        handler: (...args: never[]) => unknown
      }): () => void
    }
    invariants: { register(name: string, install: unknown): () => void }
    deepSeekWeb?: unknown
  }
}

declare module '@deepseek-ai/schemastery' {
  const z: {
    object(shape: unknown): unknown
    string(): { role(name: string): { default(value: string): unknown }; default?(value: string): unknown }
    number(): unknown
    boolean(): unknown
    union(values: unknown[]): { default(value: unknown): unknown }
  }
  export default z
}

declare module '@deepseek-ai/dsh-credentials' {
  export function credentialRef(value: string): string
}

declare module '@deepseek-ai/dsh-home-paths' {
  export function resolveDshHome(configured?: string): string
}

declare module '@deepseek-ai/dsh-settings' {
  export function settingsNamespace(name: string): string
  export function installSettingsSection(
    ctx: unknown,
    ns: string,
    schema: unknown,
    entry: unknown,
    hooks: { setSource(current: () => unknown): void; onChange(): void },
  ): void
}

declare module '@deepseek-ai/dsh-invariants' {
  export type InvariantInstaller = () => void
}

declare module '@deepseek-ai/dsh-commands' {
  export type CommandResult = { readonly kind: 'success' | 'error'; readonly text?: string }
}

declare module '@deepseek-ai/dsh-attachment' {
  export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  export interface ImageAttachmentRef {
    attachmentId: string
    mediaType: ImageMediaType
    bytes: number
    width: number
    height: number
    name?: string
  }
  export interface StoredImageAttachment {
    ref: ImageAttachmentRef
    data: Uint8Array
  }
  export interface AttachmentStore {
    readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>
  }
}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  export interface ClientContext {
    effect(fn: () => unknown, name: string): void
    locale: {
      register(ns: string, packs: unknown): () => void
      bind(ns: string): (key: string) => string
    }
    slots: {
      inject(name: string, factory: () => unknown): void
      register(slot: unknown, component: unknown): unknown
    }
    sessions?: HarnessSessionsLike
    workspaces?: HarnessWorkspacesLike
    /** Right sidebar service; present only when a session surface is mounted. */
    sidebarRight?: {
      openTab?(kind: string, options?: { params?: Record<string, unknown>; paneId?: string; preferNewPane?: boolean; revealIfOpened?: boolean; replaceTab?: string }): void
      openResource?(address: string, options?: { kind?: string; preferNewPane?: boolean }): void
      openTabFromTarget?(kind: string, target: unknown): void
      close?(): void
    }
    /** Registry for right sidebar tab types. */
    sidebarRightTabs?: {
      register?(definition: {
        id: string
        kind: string
        title: () => string
        priority?: string
        multiple?: boolean
        keepMounted?: boolean
        guide?: unknown[]
      }): () => void
      get?(kind: string): unknown
    }
  }

  export interface HarnessSessionsLike {
    open(id: string): void
    refresh?(): Promise<void>
    list?: {
      getSnapshot(): {
        ids?: string[]
        byId?: Record<string, unknown>
        items?: Array<{ id?: string }>
      }
      subscribe?(fn: () => void): () => void
    }
  }

  export interface HarnessWorkspacesLike {
    refresh?(): Promise<void>
    list?: {
      getSnapshot(): {
        items?: Array<{ workspaceId?: string; id?: string; title?: string; path?: string }>
      }
      subscribe?(fn: () => void): () => void
    }
  }
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ButtonHTMLAttributes, ReactNode, RefObject } from 'react'
  export function Button(props: {
    variant?: 'primary' | 'ghost' | 'outline' | 'toolbar'
    size?: 'md' | 'sm'
    icon?: ReactNode
    className?: string
    children?: ReactNode
  } & ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element
  export function StateDot(props: {
    state: 'done' | 'warning' | 'ongoing' | 'error'
    size?: number
    className?: string
  }): JSX.Element
  export function Tooltip(props: {
    children: JSX.Element
    label: string
    side?: 'top' | 'right' | 'bottom' | 'left'
  }): JSX.Element
  export function IconFolderOpenOutline16(props?: { size?: number; className?: string }): JSX.Element
  export function IconQueueOutline14(props?: { size?: number; className?: string }): JSX.Element
  export function IconQueueOutlineRegular(props?: { size?: number; className?: string }): JSX.Element
  export function IconRefreshOutline16(props?: { size?: number; className?: string }): JSX.Element
  export function useDismissOnOutsidePointer(
    root: RefObject<HTMLElement | null>,
    open: boolean,
    setOpen: (open: boolean) => void,
  ): void
  export interface MenuItem {
    id: string
    label: ReactNode
    disabled?: boolean
    danger?: boolean
    icon?: ReactNode
  }
  export type MenuEntry =
    | MenuItem
    | { type: 'separator'; id: string }
    | { type: 'label'; id: string; text: string }
  export function Menu(props: {
    open: boolean
    anchor: ReactNode
    items: readonly MenuEntry[]
    footer?: readonly MenuEntry[]
    selectedId?: string
    onSelect: (id: string) => void
    onClose: () => void
    align?: 'start' | 'end'
    side?: 'bottom' | 'top' | 'right'
    portal?: boolean
    getAnchorRect?: () => DOMRect | null
    compact?: boolean
    dense?: boolean
  }): JSX.Element
}
declare module '@deepseek-ai/dsh-client-ui-settings/client' {}
declare module '@deepseek-ai/dsh-client-locale/client' {}
declare module '@deepseek-ai/dsh-client-ui-sidebar/client' {}
declare module '@deepseek-ai/dsh-client-ui-conversation/client' {}
declare module '@deepseek-ai/dsh-client-ui-slots' {
  export interface LocaleNamespaceMap {}
}

declare module '@puppeteer/browsers' {
  export function install(options: unknown): Promise<unknown>
  export function computeExecutablePath(options: unknown): string
}
