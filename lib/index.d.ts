import z from "@deepseek-ai/schemastery";
import { GenerateOptions, LlmAdapter, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, StreamChunk } from "@deepseek-ai/dsh-llm";
import { Context } from "@deepseek-ai/cordis";
//#region src/config.d.ts
declare const PROVIDER = "deepseek-web";
type ModelId = 'default' | 'expert';
type ThinkingMode = 'enabled' | 'disabled';
type NativeSearchMode = 'off' | 'on';
type BrowserPreference = 'auto' | 'chrome' | 'edge' | 'brave' | 'chromium' | 'managed';
interface Config$1 {
  tokenEnv?: string;
  defaultModel?: ModelId;
  thinking?: ThinkingMode;
  /** Always on for default; Expert cannot search on the wire. Settings cannot turn this off. */
  nativeSearch?: NativeSearchMode;
  streamIdleTimeoutMs?: number;
  maxToolProtocolBytes?: number;
  maxToolCallsPerTurn?: number;
  maxProtocolRepairAttempts?: number;
  maxToolResultBytes?: number;
  browser?: {
    preferred?: BrowserPreference;
    allowManagedDownload?: boolean;
  };
}
interface ResolvedConfig {
  tokenEnv: string;
  defaultModel: ModelId;
  thinking: ThinkingMode;
  nativeSearch: NativeSearchMode;
  streamIdleTimeoutMs: number;
  maxToolProtocolBytes: number;
  maxToolCallsPerTurn: number;
  maxProtocolRepairAttempts: number;
  maxToolResultBytes: number;
  browser: {
    preferred: BrowserPreference;
    allowManagedDownload: boolean;
  };
}
//#endregion
//#region ../compat/src/types.d.ts
type DeepSeekModelType = 'default' | 'expert';
interface DeepSeekAccount {
  id: string;
  accountHash: string;
}
interface DeepSeekSession {
  chatSessionId: string;
}
interface DeepSeekCitation {
  citeIndex: number;
  url: string;
  title?: string;
  siteName?: string;
}
interface DeepSeekTurn {
  requestMessageId: string;
  responseMessageId: string;
  reasoning: string;
  text: string;
  citations: DeepSeekCitation[];
  /** Official `event: title` payload; never a visible transcript fragment. */
  sessionTitle?: string;
}
interface DeepSeekStreamDelta {
  reasoning: string;
  text: string;
  citations: DeepSeekCitation[];
}
interface DeepSeekCompletionRequest {
  credential: string;
  chatSessionId: string;
  parentMessageId?: string;
  prompt: string;
  modelType: DeepSeekModelType;
  thinkingEnabled: boolean;
  searchEnabled: boolean;
  refFileIds?: readonly string[];
  signal?: AbortSignal;
  onDelta?: (delta: DeepSeekStreamDelta) => void;
  /** Prefetched PoW proof; completion refetches when the provider rejects a stale proof. */
  powHeader?: string;
}
interface DeepSeekAttachmentUpload {
  credential: string;
  bytes: Uint8Array;
  mediaType: string;
  name?: string;
  modelType?: DeepSeekModelType;
  thinkingEnabled?: boolean;
  signal?: AbortSignal;
}
interface DeepSeekAttachmentRef {
  fileId: string;
}
interface DeepSeekRemoteSessionSummary {
  chatSessionId: string;
  title: string;
  createdAt?: number;
  updatedAt?: number;
  modelType?: DeepSeekModelType;
}
interface DeepSeekRemoteSessionPage {
  items: DeepSeekRemoteSessionSummary[];
  nextCursor?: string;
}
interface DeepSeekRemoteMessage {
  role: 'user' | 'assistant';
  requestMessageId?: string;
  responseMessageId?: string;
  text: string;
  reasoning?: string;
  citations?: DeepSeekCitation[];
  createdAt?: number;
  modelType?: DeepSeekModelType;
  thinkingEnabled?: boolean;
  searchEnabled?: boolean;
}
interface DeepSeekRemoteSessionHistory {
  session: DeepSeekRemoteSessionSummary;
  messages: DeepSeekRemoteMessage[];
  nextCursor?: string;
}
interface DeepSeekWebClient {
  currentUser(credential: string, signal?: AbortSignal): Promise<DeepSeekAccount>;
  createSession(credential: string, signal?: AbortSignal): Promise<DeepSeekSession>;
  complete(request: DeepSeekCompletionRequest): Promise<DeepSeekTurn>;
  solveCompletionPow?(credential: string, signal?: AbortSignal): Promise<string>;
  uploadAttachment?(request: DeepSeekAttachmentUpload): Promise<DeepSeekAttachmentRef>;
  listSessions(credential: string, options?: {
    cursor?: string;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<DeepSeekRemoteSessionPage>;
  fetchSessionHistory(credential: string, chatSessionId: string, options?: {
    cursor?: string;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<DeepSeekRemoteSessionHistory>;
}
//#endregion
//#region src/adapter.d.ts
interface AdapterDeps {
  options: () => ResolvedConfig;
  resolveCredential: () => Promise<string>;
  client?: DeepSeekWebClient;
}
declare class DeepSeekWebAdapter extends LlmAdapter {
  private readonly deps;
  private readonly locks;
  private readonly accountCache;
  private readonly remotes;
  private readonly client;
  constructor(deps: AdapterDeps);
  clearAccountCache(): void;
  providerInfo(provider: string): LlmProviderInfo;
  listModels(provider: string): Promise<readonly LlmModelInfo[]>;
  resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo>;
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
  private resolveAccount;
  private oneShot;
  private executeConversation;
  private completeChecked;
  private completeWithRepair;
  private accept;
}
//#endregion
//#region src/index.d.ts
declare const name = "llm-deepseek-web";
declare const inject: string[];
type Config = Config$1;
declare const Config: z<Schemastery.ObjectS<{
  tokenEnv: z<string, string>;
  defaultModel: z<"default" | "expert", "default" | "expert">;
  thinking: z<"enabled" | "disabled", "enabled" | "disabled">;
  streamIdleTimeoutMs: z<number, number>;
  maxToolProtocolBytes: z<number, number>;
  maxToolCallsPerTurn: z<number, number>;
  maxProtocolRepairAttempts: z<number, number>;
  maxToolResultBytes: z<number, number>;
  browser: z<Schemastery.ObjectS<{
    preferred: z<"auto" | "chrome" | "edge" | "brave" | "chromium" | "managed", "auto" | "chrome" | "edge" | "brave" | "chromium" | "managed">;
    allowManagedDownload: z<boolean, boolean>;
  }>, Schemastery.ObjectT<{
    preferred: z<"auto" | "chrome" | "edge" | "brave" | "chromium" | "managed", "auto" | "chrome" | "edge" | "brave" | "chromium" | "managed">;
    allowManagedDownload: z<boolean, boolean>;
  }>>;
}>, Schemastery.ObjectT<{
  tokenEnv: z<string, string>;
  defaultModel: z<"default" | "expert", "default" | "expert">;
  thinking: z<"enabled" | "disabled", "enabled" | "disabled">;
  streamIdleTimeoutMs: z<number, number>;
  maxToolProtocolBytes: z<number, number>;
  maxToolCallsPerTurn: z<number, number>;
  maxProtocolRepairAttempts: z<number, number>;
  maxToolResultBytes: z<number, number>;
  browser: z<Schemastery.ObjectS<{
    preferred: z<"auto" | "chrome" | "edge" | "brave" | "chromium" | "managed", "auto" | "chrome" | "edge" | "brave" | "chromium" | "managed">;
    allowManagedDownload: z<boolean, boolean>;
  }>, Schemastery.ObjectT<{
    preferred: z<"auto" | "chrome" | "edge" | "brave" | "chromium" | "managed", "auto" | "chrome" | "edge" | "brave" | "chromium" | "managed">;
    allowManagedDownload: z<boolean, boolean>;
  }>>;
}>>;
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, DeepSeekWebAdapter, PROVIDER, apply, inject, name };
//# sourceMappingURL=index.d.ts.map