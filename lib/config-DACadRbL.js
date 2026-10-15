import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import WebSocket from "ws";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
//#region ../compat/src/errors.ts
var DeepSeekWebError = class extends Error {
	code;
	status;
	constructor(message, code, options) {
		super(message, options?.cause === void 0 ? void 0 : { cause: options.cause });
		this.name = "DeepSeekWebError";
		this.code = code;
		if (options?.status !== void 0) this.status = options.status;
	}
};
const ERROR_CODES = {
	MISSING_CREDENTIAL: "MISSING_CREDENTIAL",
	AUTH: "DEEPSEEK_WEB_AUTH",
	REAUTH_REQUIRED: "DEEPSEEK_WEB_REAUTH_REQUIRED",
	WAF: "DEEPSEEK_WEB_WAF",
	RATE_LIMIT: "DEEPSEEK_WEB_RATE_LIMIT",
	HTTP: "DEEPSEEK_WEB_HTTP",
	TIMEOUT: "DEEPSEEK_WEB_TIMEOUT",
	POW: "DEEPSEEK_WEB_POW",
	POW_UNSUPPORTED: "DEEPSEEK_WEB_POW_UNSUPPORTED",
	POW_REJECTED: "DEEPSEEK_WEB_POW_REJECTED",
	PROTOCOL: "DEEPSEEK_WEB_PROTOCOL",
	PROTOCOL_INCOMPLETE: "DEEPSEEK_WEB_PROTOCOL_INCOMPLETE",
	TOOL_PROTOCOL: "DEEPSEEK_WEB_TOOL_PROTOCOL",
	REMOTE_SESSION: "DEEPSEEK_WEB_REMOTE_SESSION",
	BROWSER_NOT_FOUND: "DEEPSEEK_WEB_BROWSER_NOT_FOUND",
	BROWSER_INSTALL: "DEEPSEEK_WEB_BROWSER_INSTALL",
	BROWSER_LAUNCH: "DEEPSEEK_WEB_BROWSER_LAUNCH",
	BROWSER_CDP: "DEEPSEEK_WEB_BROWSER_CDP",
	BROWSER_LOGIN_CANCELLED: "DEEPSEEK_WEB_BROWSER_LOGIN_CANCELLED",
	UNSUPPORTED_IMAGE: "DEEPSEEK_WEB_UNSUPPORTED_IMAGE",
	PROTOCOL_CORE_MISMATCH: "DEEPSEEK_WEB_PROTOCOL_CORE_MISMATCH",
	REMOTE_HISTORY_INVALID: "DEEPSEEK_WEB_REMOTE_HISTORY_INVALID",
	REMOTE_HISTORY_INCOMPLETE: "DEEPSEEK_WEB_REMOTE_HISTORY_INCOMPLETE"
};
//#endregion
//#region ../compat/src/constants.ts
const IMAGE_MEDIA_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif"
];
const UPLOAD_POLL_DEADLINE_MS = 18e4;
const ABSOLUTE_NONCE_LIMIT = 5e6;
const MAX_ERROR_BYTES = 65536;
//#endregion
//#region ../compat/src/redaction.ts
const PATTERNS = [
	[/\bBearer\s+[A-Za-z0-9._\-+=/]+/gi, "Bearer [redacted]"],
	[/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted jwt]"],
	[/(\bauthorization=)[^&\s]+/gi, "$1[redacted]"],
	[/(\baccess_token=)[^&\s]+/gi, "$1[redacted]"],
	[/(\brefresh_token=)[^&\s]+/gi, "$1[redacted]"],
	[/(\btoken=)[^&\s]+/gi, "$1[redacted]"],
	[/(\bcookie=)[^&\s]+/gi, "$1[redacted]"],
	[/\bCookie:\s*[^\r\n]+/gi, "Cookie: [redacted]"],
	[/\bAuthorization:\s*[^\r\n]+/gi, "Authorization: [redacted]"]
];
function redactSensitiveText(value) {
	let out = value;
	for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
	return out;
}
//#endregion
//#region ../compat/src/request.ts
function timezoneOffsetSeconds() {
	return -(/* @__PURE__ */ new Date()).getTimezoneOffset() * 60;
}
function accountHash(accountId) {
	return createHash("sha256").update(`deepseek-web-account\0${accountId}`).digest("hex");
}
function responseHeaders(headers) {
	const out = [];
	headers.forEach((value, name) => {
		const lower = name.toLowerCase();
		if (lower === "authorization" || lower === "cookie" || lower === "set-cookie") return;
		out.push({
			name,
			value
		});
	});
	return out;
}
function applyTransportHeaders(descriptor, credential, userAgentOverride) {
	const headers = new Headers();
	for (const header of descriptor.headers) {
		if (header.placeholder === "authorization") {
			if (descriptor.requiresCredential) headers.set("Authorization", `Bearer ${credential.replace(/^Bearer\s+/i, "")}`);
			continue;
		}
		if (header.value != null && header.value.length > 0) headers.set(header.name, header.value);
	}
	headers.set("User-Agent", userAgentOverride ?? descriptor.suggestedUserAgent);
	return headers;
}
async function readLimited(response, maxBytes, signal) {
	if (response.body === null) return /* @__PURE__ */ new Uint8Array();
	const reader = response.body.getReader();
	const chunks = [];
	let total = 0;
	while (true) {
		if (signal?.aborted) throw new DeepSeekWebError("request aborted", ERROR_CODES.TIMEOUT);
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) throw new DeepSeekWebError("response too large", ERROR_CODES.PROTOCOL);
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}
var DeepSeekWebHttpClient = class {
	baseURL;
	fingerprint;
	fetchImpl;
	constructor(baseURL, fingerprint, fetchImpl = fetch) {
		this.baseURL = baseURL;
		this.fingerprint = fingerprint;
		this.fetchImpl = fetchImpl;
	}
	clientContext() {
		return {
			locale: this.fingerprint?.locale,
			timezoneOffsetSeconds: timezoneOffsetSeconds(),
			clientVersion: this.fingerprint?.clientVersion,
			bundleId: this.fingerprint?.bundleId
		};
	}
	async send(descriptor, credential, signal, form) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 21e4);
		const onAbort = () => controller.abort();
		signal?.addEventListener("abort", onAbort, { once: true });
		try {
			const headers = applyTransportHeaders(descriptor, credential, this.fingerprint?.userAgent);
			let body;
			if (form !== void 0) {
				headers.delete("Content-Type");
				body = form;
			} else if (descriptor.bodyText != null && descriptor.bodyKind === "json") body = descriptor.bodyText;
			const origin = this.baseURL ?? descriptor.origin;
			const response = await this.fetchImpl(new URL(descriptor.path, origin), {
				method: descriptor.method.toUpperCase(),
				headers,
				body,
				signal: controller.signal,
				redirect: "manual"
			});
			const headerList = responseHeaders(response.headers);
			const contentType = response.headers.get("content-type") ?? "";
			if (descriptor.responseKind === "sse" && response.ok && contentType.includes("text/event-stream")) return {
				status: response.status,
				headers: headerList,
				body: /* @__PURE__ */ new Uint8Array(),
				text: "",
				response
			};
			const bytes = await readLimited(response, descriptor.responseKind === "sse" || !response.ok ? MAX_ERROR_BYTES : Math.max(1, descriptor.maxResponseBytes || 262144), signal);
			return {
				status: response.status,
				headers: headerList,
				body: bytes,
				text: new TextDecoder().decode(bytes),
				response
			};
		} catch (error) {
			if (error instanceof DeepSeekWebError) throw error;
			if (error.name === "AbortError") throw new DeepSeekWebError("DeepSeek Web request timed out", ERROR_CODES.TIMEOUT, { cause: error });
			throw new DeepSeekWebError(redactSensitiveText(String(error)), ERROR_CODES.HTTP, { cause: error });
		} finally {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
		}
	}
};
//#endregion
//#region ../compat/src/protocol/native.ts
function candidateDirs() {
	const here = dirname(fileURLToPath(import.meta.url));
	return [
		join(here, "..", "generated"),
		join(here, "..", "..", "generated"),
		join(here, "..", "..", "plugin", "wasm"),
		join(here, "..", "..", "..", "plugin", "wasm"),
		join(here, "..", "wasm"),
		join(here, "..", "..", "wasm"),
		join(here, "..", "..", "..", "wasm"),
		join(here, "..", "..", "..", "..", "packages", "plugin", "wasm")
	];
}
let cached;
async function loadWasmNative() {
	cached ??= (async () => {
		for (const dir of candidateDirs()) try {
			const jsPath = join(dir, "deepseek_web_core.js");
			const wasmPath = join(dir, "deepseek_web_core_bg.wasm");
			const bytes = new Uint8Array(await readFile(wasmPath));
			const mod = await import(pathToFileURL(jsPath).href);
			await mod.default({ module_or_path: bytes });
			if (typeof mod.protocol_abi_version !== "function") continue;
			return mod;
		} catch {
			continue;
		}
	})();
	return cached;
}
var ProtocolStreamAssembler = class {
	inner;
	constructor(inner) {
		this.inner = inner;
	}
	processEvent(event, data) {
		try {
			this.inner.push(event, data);
		} catch (error) {
			rethrowWasm(error);
		}
	}
	takeDelta() {
		const parsed = JSON.parse(this.inner.take_delta());
		return {
			reasoning: parsed.reasoning ?? "",
			text: parsed.text ?? "",
			citations: (parsed.citations ?? []).map((item) => ({
				citeIndex: item.citeIndex,
				url: item.url,
				title: item.title,
				siteName: item.siteName
			}))
		};
	}
	finish() {
		try {
			const parsed = JSON.parse(this.inner.finish());
			return {
				requestMessageId: parsed.requestMessageId,
				responseMessageId: parsed.responseMessageId,
				reasoning: parsed.reasoning,
				text: parsed.text,
				citations: parsed.citations,
				...parsed.sessionTitle === void 0 ? {} : { sessionTitle: parsed.sessionTitle }
			};
		} catch (error) {
			rethrowWasm(error);
		}
	}
};
function throwIfProtocolError(parsed) {
	if (parsed.ok && parsed.response !== void 0) return;
	const error = parsed.error;
	throw new DeepSeekWebError(error?.safeMessage ?? "DeepSeek Web protocol error", error?.dshCode ?? ERROR_CODES.PROTOCOL, error?.status === void 0 ? void 0 : { status: error.status });
}
var ProtocolCore = class {
	native;
	constructor(native) {
		this.native = native;
		const version = native.protocol_abi_version();
		if (version !== 2) throw new DeepSeekWebError(`plugin JS ABI v2 / WASM ABI v${version}`, ERROR_CODES.PROTOCOL_CORE_MISMATCH);
	}
	get abiVersion() {
		return this.native.protocol_abi_version();
	}
	buildRequest(command) {
		try {
			return JSON.parse(this.native.build_request_json(JSON.stringify({
				schemaVersion: 2,
				...command
			})));
		} catch (error) {
			rethrowWasm(error);
		}
	}
	parseResponse(input) {
		try {
			const meta = JSON.stringify({
				schemaVersion: 2,
				operation: input.operation,
				status: input.status,
				headers: input.headers,
				bodyText: input.bodyText
			});
			return JSON.parse(this.native.parse_response_json(meta, input.body ?? /* @__PURE__ */ new Uint8Array()));
		} catch (error) {
			rethrowWasm(error);
		}
	}
	createStream() {
		return new ProtocolStreamAssembler(new this.native.WasmStreamAssembler());
	}
	pathlessFixture() {
		try {
			return this.native.pathless_sse_fixture();
		} catch (error) {
			rethrowWasm(error);
		}
	}
	encodePowHeader(challenge, nonce, target = "completion") {
		try {
			return this.native.encode_pow_header_json(JSON.stringify({
				algorithm: challenge.algorithm,
				challenge: challenge.challenge,
				salt: challenge.salt,
				signature: challenge.signature,
				expire_at: challenge.expireAt,
				difficulty: challenge.difficulty
			}), BigInt(nonce), target);
		} catch (error) {
			rethrowWasm(error);
		}
	}
};
let corePromise;
let syncCore;
async function loadProtocolCore() {
	corePromise ??= (async () => {
		const native = await loadWasmNative();
		if (native === void 0) throw new DeepSeekWebError("DeepSeek Web protocol WASM is missing; rebuild with pnpm build:core", ERROR_CODES.PROTOCOL_CORE_MISMATCH);
		const core = new ProtocolCore(native);
		syncCore = core;
		return core;
	})();
	return corePromise;
}
function getProtocolCoreSync() {
	if (syncCore === void 0) throw new DeepSeekWebError("DeepSeek Web protocol core is not initialized", ERROR_CODES.PROTOCOL_CORE_MISMATCH);
	return syncCore;
}
function rethrowWasm(error) {
	if (error instanceof DeepSeekWebError) throw error;
	const message = error instanceof Error ? error.message : String(error);
	try {
		const parsed = JSON.parse(message);
		if (parsed?.error?.dshCode) throw new DeepSeekWebError(parsed.error.safeMessage, parsed.error.dshCode, parsed.error.status === void 0 ? void 0 : { status: parsed.error.status });
	} catch (inner) {
		if (inner instanceof DeepSeekWebError) throw inner;
	}
	throw new DeepSeekWebError(message, ERROR_CODES.PROTOCOL);
}
//#endregion
//#region ../compat/src/account.ts
async function currentUser(http, credential, signal) {
	const core = await loadProtocolCore();
	const descriptor = core.buildRequest({
		type: "current_user",
		client: http.clientContext()
	});
	const raw = await http.send(descriptor, credential, signal);
	const parsed = core.parseResponse({
		operation: "current_user",
		status: raw.status,
		headers: raw.headers,
		bodyText: raw.text,
		body: raw.body
	});
	throwIfProtocolError(parsed);
	if (parsed.response.type !== "account") throw new DeepSeekWebError("DeepSeek Web account id missing", ERROR_CODES.PROTOCOL);
	return {
		id: parsed.response.id,
		accountHash: accountHash(parsed.response.id)
	};
}
//#endregion
//#region ../compat/src/pow/wasm.ts
async function loadWasmPowSolver() {
	const native = await loadWasmNative();
	if (native === void 0) return void 0;
	return { solve(challenge, nowMs, nonceLimit, deadlineMs) {
		const json = JSON.stringify({
			algorithm: challenge.algorithm,
			challenge: challenge.challenge,
			salt: challenge.salt,
			signature: challenge.signature,
			expire_at: challenge.expireAt,
			difficulty: challenge.difficulty
		});
		const parsed = JSON.parse(native.solve_pow_json(json, BigInt(nowMs), BigInt(nonceLimit), BigInt(deadlineMs)));
		if (typeof parsed.nonce !== "number" || typeof parsed.header !== "string") throw new Error("invalid wasm PoW result");
		return parsed;
	} };
}
//#endregion
//#region ../compat/src/pow/pool.ts
var PowWorkerPool = class {
	disposed = false;
	wasmPromise;
	constructor(_options) {
		this.warmup();
	}
	warmup() {
		this.wasmPromise ??= loadWasmPowSolver();
		return this.wasmPromise;
	}
	async solverKind() {
		if (await this.warmup() === void 0) throw new DeepSeekWebError("PoW WASM unavailable", ERROR_CODES.POW);
		return "wasm";
	}
	async solve(challenge, options) {
		if (this.disposed) throw new DeepSeekWebError("PoW pool disposed", ERROR_CODES.POW);
		if (options?.signal?.aborted) throw new DeepSeekWebError("PoW aborted", ERROR_CODES.POW);
		const nonceLimit = Math.min(options?.nonceLimit ?? 5e6, ABSOLUTE_NONCE_LIMIT);
		const deadlineMs = options?.deadlineMs ?? Date.now() + 3e4;
		const wasm = await this.warmup();
		if (options?.signal?.aborted) throw new DeepSeekWebError("PoW aborted", ERROR_CODES.POW);
		if (wasm === void 0) throw new DeepSeekWebError("PoW WASM unavailable", ERROR_CODES.POW);
		const solved = wasm.solve(challenge, Date.now(), nonceLimit, deadlineMs);
		return {
			nonce: solved.nonce,
			header: solved.header
		};
	}
	async dispose() {
		this.disposed = true;
	}
};
//#endregion
//#region ../compat/src/sse.ts
var SseParser = class {
	buffer = "";
	total = 0;
	push(chunk, onEvent) {
		this.total += chunk.length;
		if (this.total > 67108864) throw new DeepSeekWebError("SSE stream exceeds size limit", ERROR_CODES.PROTOCOL);
		this.buffer += chunk;
		while (true) {
			const split = this.buffer.indexOf("\n\n");
			if (split < 0) break;
			const raw = this.buffer.slice(0, split);
			this.buffer = this.buffer.slice(split + 2);
			if (raw.length > 2097152) throw new DeepSeekWebError("SSE event exceeds size limit", ERROR_CODES.PROTOCOL);
			let event = "";
			const dataLines = [];
			for (const line of raw.split("\n")) if (line.startsWith("event:")) event = line.slice(6).trim();
			else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
			onEvent(event, dataLines.join("\n"));
		}
	}
};
var DeepSeekWebSseAssembler = class {
	inner;
	constructor(inner) {
		this.inner = inner ?? getProtocolCoreSync().createStream();
	}
	takeDelta() {
		return this.inner.takeDelta();
	}
	processEvent(event, data) {
		this.inner.processEvent(event, data);
	}
	finish() {
		return this.inner.finish();
	}
};
function rewriteCitationMarkers(text, citations) {
	return text.replace(/\[citation:(\d+)\]/g, (match, index) => {
		const citation = citations.find((item) => item.citeIndex === Number(index));
		if (citation === void 0) return match;
		return `[${citation.title ?? citation.siteName ?? citation.url}](${citation.url})`;
	});
}
async function readSseResponse(response, signal, idleTimeoutMs = 18e4, onDelta) {
	const parser = new SseParser();
	const assembler = new DeepSeekWebSseAssembler((await loadProtocolCore()).createStream());
	if (response.body === null) throw new DeepSeekWebError("empty SSE body", ERROR_CODES.PROTOCOL_INCOMPLETE);
	const reader = response.body.getReader();
	const decoder = new TextDecoder("utf-8");
	let citationCount = 0;
	const handleEvent = (event, data) => {
		// DeepSeek reports backend failures as an SSE `hint` event. Without this
		// check the assembler simply ends the stream, so a failed turn looks like a
		// successful but empty reply, and the empty message then makes the next
		// turn fail with "invalid message id".
		if (event === "hint") {
			let hint;
			try {
				hint = JSON.parse(data);
			} catch {
				hint = void 0;
			}
			if (hint !== null && typeof hint === "object" && hint.type === "error") {
				const detail = typeof hint.content === "string" && hint.content.length > 0 ? `: ${hint.content}` : "";
				throw new DeepSeekWebError(`DeepSeek Web backend rejected the request${detail}`, ERROR_CODES.HTTP);
			}
		}
		assembler.processEvent(event, data);
		if (onDelta === void 0) return;
		const delta = assembler.takeDelta();
		const citationsChanged = delta.citations.length !== citationCount;
		citationCount = delta.citations.length;
		if (delta.reasoning.length > 0 || delta.text.length > 0 || citationsChanged) onDelta(delta);
	};
	let idle = setTimeout(() => {
		reader.cancel();
	}, idleTimeoutMs);
	try {
		while (true) {
			if (signal?.aborted) throw new DeepSeekWebError("SSE aborted", ERROR_CODES.TIMEOUT);
			const { done, value } = await reader.read();
			clearTimeout(idle);
			if (done) break;
			idle = setTimeout(() => {
				reader.cancel();
			}, idleTimeoutMs);
			parser.push(decoder.decode(value, { stream: true }), handleEvent);
		}
		parser.push(decoder.decode(), handleEvent);
		return assembler.finish();
	} catch (error) {
		void reader.cancel().catch(() => {});
		throw error;
	} finally {
		clearTimeout(idle);
	}
}
//#endregion
//#region ../compat/src/completion.ts
function asPowChallenge(value) {
	return {
		algorithm: value.algorithm,
		challenge: value.challenge,
		salt: value.salt,
		signature: value.signature,
		expireAt: value.expireAt,
		difficulty: value.difficulty
	};
}
async function solveCompletionPow(http, pool, credential, signal) {
	const core = await loadProtocolCore();
	const descriptor = core.buildRequest({
		type: "create_pow_challenge",
		target: "completion",
		client: http.clientContext()
	});
	const raw = await http.send(descriptor, credential, signal);
	const parsed = core.parseResponse({
		operation: "create_pow_challenge",
		status: raw.status,
		headers: raw.headers,
		bodyText: raw.text,
		body: raw.body
	});
	throwIfProtocolError(parsed);
	if (parsed.response.type !== "pow_challenge") throw new DeepSeekWebError("invalid PoW challenge", ERROR_CODES.POW);
	const challenge = asPowChallenge(parsed.response);
	const solved = await pool.solve(challenge, { signal });
	return solved.header ?? core.encodePowHeader(challenge, solved.nonce, "completion");
}
async function completeTurn(http, pool, request, powAttempt = 0) {
	const core = await loadProtocolCore();
	const header = request.powHeader !== void 0 && powAttempt === 0 ? request.powHeader : await solveCompletionPow(http, pool, request.credential, request.signal);
	const descriptor = core.buildRequest({
		type: "completion",
		client: http.clientContext(),
		input: {
			sessionId: request.chatSessionId,
			parentMessageId: request.parentMessageId,
			prompt: request.prompt,
			attachments: [...request.refFileIds ?? []],
			model: request.modelType,
			thinking: request.thinkingEnabled,
			search: request.searchEnabled
		},
		pow: { header }
	});
	try {
		const raw = await http.send(descriptor, request.credential, request.signal);
		const classified = core.parseResponse({
			operation: "completion",
			status: raw.status,
			headers: raw.headers,
			bodyText: raw.text,
			body: raw.body
		});
		if (!classified.ok) throwIfProtocolError(classified);
		return await readSseResponse(raw.response, request.signal, 18e4, request.onDelta);
	} catch (error) {
		if (error instanceof DeepSeekWebError && error.code === ERROR_CODES.POW && powAttempt === 0) return completeTurn(http, pool, {
			...request,
			powHeader: void 0
		}, 1);
		if (error instanceof DeepSeekWebError && error.code === ERROR_CODES.POW) throw new DeepSeekWebError("DeepSeek Web rejected PoW after retry", ERROR_CODES.POW_REJECTED, { cause: error });
		throw error;
	}
}
//#endregion
//#region ../compat/src/session.ts
async function createSession(http, credential, signal) {
	const core = await loadProtocolCore();
	const descriptor = core.buildRequest({
		type: "create_session",
		client: http.clientContext()
	});
	const raw = await http.send(descriptor, credential, signal);
	const parsed = core.parseResponse({
		operation: "create_session",
		status: raw.status,
		headers: raw.headers,
		bodyText: raw.text,
		body: raw.body
	});
	throwIfProtocolError(parsed);
	if (parsed.response.type !== "session") throw new DeepSeekWebError("DeepSeek Web session id missing", ERROR_CODES.REMOTE_SESSION);
	return { chatSessionId: parsed.response.sessionId };
}
//#endregion
//#region ../compat/src/sessions.ts
async function listSessions(http, credential, options) {
	if (options?.signal?.aborted) throw new DeepSeekWebError("request aborted", ERROR_CODES.TIMEOUT);
	const core = await loadProtocolCore();
	const descriptor = core.buildRequest({
		type: "list_sessions",
		client: http.clientContext(),
		cursor: options?.cursor,
		limit: options?.limit
	});
	const raw = await http.send(descriptor, credential, options?.signal);
	const parsed = core.parseResponse({
		operation: "list_sessions",
		status: raw.status,
		headers: raw.headers,
		bodyText: raw.text,
		body: raw.body
	});
	throwIfProtocolError(parsed);
	if (parsed.response.type !== "session_list") throw new DeepSeekWebError("DeepSeek Web session list missing", ERROR_CODES.PROTOCOL);
	return {
		items: parsed.response.items,
		...parsed.response.nextCursor === void 0 ? {} : { nextCursor: parsed.response.nextCursor }
	};
}
//#endregion
//#region ../compat/src/history.ts
async function fetchSessionHistory(http, credential, chatSessionId, options) {
	if (options?.signal?.aborted) throw new DeepSeekWebError("request aborted", ERROR_CODES.TIMEOUT);
	const trimmed = chatSessionId.trim();
	if (trimmed.length === 0) throw new DeepSeekWebError("missing session id", ERROR_CODES.REMOTE_HISTORY_INVALID);
	const core = await loadProtocolCore();
	const descriptor = core.buildRequest({
		type: "fetch_session_history",
		client: http.clientContext(),
		sessionId: trimmed,
		cursor: options?.cursor,
		limit: options?.limit
	});
	const raw = await http.send(descriptor, credential, options?.signal);
	const parsed = core.parseResponse({
		operation: "fetch_session_history",
		status: raw.status,
		headers: raw.headers,
		bodyText: raw.text,
		body: raw.body
	});
	throwIfProtocolError(parsed);
	if (parsed.response.type !== "session_history") throw new DeepSeekWebError("DeepSeek Web history missing", ERROR_CODES.REMOTE_HISTORY_INVALID);
	return {
		session: parsed.response.session,
		messages: parsed.response.messages,
		...parsed.response.nextCursor === void 0 ? {} : { nextCursor: parsed.response.nextCursor }
	};
}
//#endregion
//#region ../compat/src/attachments.ts
const IMAGE_MEDIA = new Set(IMAGE_MEDIA_TYPES);
function extensionFor(mediaType) {
	if (mediaType === "image/jpeg") return "jpg";
	if (mediaType === "image/webp") return "webp";
	if (mediaType === "image/gif") return "gif";
	return "png";
}
async function sleep(ms, signal) {
	if (signal?.aborted) throw new DeepSeekWebError("request aborted", ERROR_CODES.TIMEOUT);
	await new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(new DeepSeekWebError("request aborted", ERROR_CODES.TIMEOUT));
		};
		signal?.addEventListener("abort", onAbort);
	});
}
async function parseAttachment(http, credential, operation, raw) {
	const parsed = (await loadProtocolCore()).parseResponse({
		operation,
		status: raw.status,
		headers: raw.headers,
		bodyText: raw.text,
		body: raw.body
	});
	throwIfProtocolError(parsed);
	if (parsed.response.type !== "attachment") throw new DeepSeekWebError("DeepSeek Web upload response missing file id", ERROR_CODES.PROTOCOL);
	return {
		fileId: parsed.response.fileId,
		status: parsed.response.status
	};
}
async function pollUntilReady(http, credential, fileId, signal) {
	const core = await loadProtocolCore();
	const deadline = Date.now() + UPLOAD_POLL_DEADLINE_MS;
	while (true) {
		if (signal?.aborted) throw new DeepSeekWebError("request aborted", ERROR_CODES.TIMEOUT);
		const descriptor = core.buildRequest({
			type: "fetch_attachment",
			client: http.clientContext(),
			fileId
		});
		const payload = await parseAttachment(http, credential, "fetch_attachment", await http.send(descriptor, credential, signal));
		if (payload.status === "SUCCESS") return;
		if (payload.status === "FAILED") throw new DeepSeekWebError("DeepSeek Web failed to parse the uploaded image", ERROR_CODES.UNSUPPORTED_IMAGE);
		if (Date.now() >= deadline) throw new DeepSeekWebError("DeepSeek Web image parse timed out", ERROR_CODES.TIMEOUT);
		await sleep(500, signal);
	}
}
async function uploadAttachment(http, pool, request) {
	if (!IMAGE_MEDIA.has(request.mediaType)) throw new DeepSeekWebError(`DeepSeek Web image upload does not accept ${request.mediaType}`, ERROR_CODES.UNSUPPORTED_IMAGE);
	if (request.bytes.byteLength === 0 || request.bytes.byteLength > 5242880) throw new DeepSeekWebError("DeepSeek Web image exceeds the upload size limit", ERROR_CODES.UNSUPPORTED_IMAGE);
	const core = await loadProtocolCore();
	const powDescriptor = core.buildRequest({
		type: "create_pow_challenge",
		target: "upload_attachment",
		client: http.clientContext()
	});
	const powRaw = await http.send(powDescriptor, request.credential, request.signal);
	const powParsed = core.parseResponse({
		operation: "create_pow_challenge",
		status: powRaw.status,
		headers: powRaw.headers,
		bodyText: powRaw.text,
		body: powRaw.body
	});
	throwIfProtocolError(powParsed);
	if (powParsed.response.type !== "pow_challenge") throw new DeepSeekWebError("invalid PoW challenge", ERROR_CODES.POW);
	const challenge = {
		algorithm: powParsed.response.algorithm,
		challenge: powParsed.response.challenge,
		salt: powParsed.response.salt,
		signature: powParsed.response.signature,
		expireAt: powParsed.response.expireAt,
		difficulty: powParsed.response.difficulty
	};
	const solved = await pool.solve(challenge, { signal: request.signal });
	const header = core.encodePowHeader(challenge, solved.nonce, "upload_attachment");
	const filename = request.name?.replace(/[\\/]/g, "_") || `image.${extensionFor(request.mediaType)}`;
	const form = new FormData();
	form.append("file", new Blob([request.bytes], { type: request.mediaType }), filename);
	const uploadDescriptor = core.buildRequest({
		type: "upload_attachment",
		client: http.clientContext(),
		pow: { header },
		fileSize: request.bytes.byteLength,
		model: request.modelType,
		thinking: request.thinkingEnabled
	});
	const uploaded = await http.send(uploadDescriptor, request.credential, request.signal, form);
	const payload = await parseAttachment(http, request.credential, "upload_attachment", uploaded);
	await pollUntilReady(http, request.credential, payload.fileId, request.signal);
	return { fileId: payload.fileId };
}
//#endregion
//#region ../compat/src/client.ts
var CompatDeepSeekWebClient = class {
	http;
	pow;
	constructor(options) {
		this.http = new DeepSeekWebHttpClient(options?.baseURL, options?.fingerprint, options?.fetchImpl);
		this.pow = options?.pow ?? new PowWorkerPool();
		this.pow.warmup();
		loadProtocolCore();
	}
	currentUser(credential, signal) {
		return currentUser(this.http, credential, signal);
	}
	createSession(credential, signal) {
		return createSession(this.http, credential, signal);
	}
	solveCompletionPow(credential, signal) {
		return solveCompletionPow(this.http, this.pow, credential, signal);
	}
	complete(request) {
		return completeTurn(this.http, this.pow, request);
	}
	uploadAttachment(request) {
		return uploadAttachment(this.http, this.pow, request);
	}
	listSessions(credential, options) {
		return listSessions(this.http, credential, options);
	}
	fetchSessionHistory(credential, chatSessionId, options) {
		return fetchSessionHistory(this.http, credential, chatSessionId, options);
	}
	async dispose() {
		await this.pow.dispose();
	}
};
//#endregion
//#region ../compat/src/browser-auth/capture.ts
const MAX_BEARER_BYTES = 32768;
const DEEPSEEK_WEB_ORIGIN = "https://chat.deepseek.com";
function isTargetApiRequest(url) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" && parsed.hostname === "chat.deepseek.com" && parsed.pathname.startsWith("/api/v0/");
	} catch {
		return false;
	}
}
function extractBearer(headers) {
	if (headers === void 0) return void 0;
	const pairs = Array.isArray(headers) ? headers : Object.entries(headers);
	for (const [name, value] of pairs) {
		if (name.toLowerCase() !== "authorization" || typeof value !== "string") continue;
		const match = value.match(/^Bearer\s+(\S+)$/i);
		if (match?.[1] && match[1].length > 0 && match[1].length <= MAX_BEARER_BYTES && !/[\r\n]/.test(match[1])) return match[1];
	}
}
var HeaderCorrelator = class {
	urls = /* @__PURE__ */ new Map();
	headers = /* @__PURE__ */ new Map();
	consider(requestId, url, headerBag) {
		if (url !== void 0) this.urls.set(requestId, url);
		if (headerBag !== void 0) {
			const prev = this.headers.get(requestId) ?? {};
			this.headers.set(requestId, {
				...prev,
				...headerBag
			});
		}
		const knownUrl = this.urls.get(requestId);
		if (knownUrl === void 0) return void 0;
		if (!isTargetApiRequest(knownUrl)) return void 0;
		return extractBearer(this.headers.get(requestId));
	}
};
//#endregion
//#region ../compat/src/browser-auth/cdp.ts
var CdpSession = class CdpSession {
	ws;
	id = 0;
	pending = /* @__PURE__ */ new Map();
	handlers = [];
	constructor(ws) {
		this.ws = ws;
		ws.on("message", (data) => {
			const parsed = JSON.parse(String(data));
			if (parsed.id !== void 0) {
				const waiter = this.pending.get(parsed.id);
				if (waiter === void 0) return;
				this.pending.delete(parsed.id);
				if (parsed.error) waiter.reject(new DeepSeekWebError(parsed.error.message, ERROR_CODES.BROWSER_CDP));
				else waiter.resolve(parsed.result);
				return;
			}
			if (parsed.method) for (const handler of this.handlers) handler(parsed.method, parsed.params ?? {});
		});
	}
	static connect(url) {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(url);
			const timer = setTimeout(() => {
				ws.close();
				reject(new DeepSeekWebError("CDP connect timed out", ERROR_CODES.BROWSER_CDP));
			}, 8e3);
			ws.once("open", () => {
				clearTimeout(timer);
				resolve(new CdpSession(ws));
			});
			ws.once("error", (error) => {
				clearTimeout(timer);
				reject(new DeepSeekWebError("CDP connect failed", ERROR_CODES.BROWSER_CDP, { cause: error }));
			});
		});
	}
	onEvent(handler) {
		this.handlers.push(handler);
		return () => {
			const index = this.handlers.indexOf(handler);
			if (index >= 0) this.handlers.splice(index, 1);
		};
	}
	send(method, params, sessionId) {
		const id = ++this.id;
		return new Promise((resolve, reject) => {
			this.pending.set(id, {
				resolve,
				reject
			});
			this.ws.send(JSON.stringify({
				id,
				method,
				params,
				sessionId
			}));
		});
	}
	close() {
		this.ws.close();
	}
};
async function attachPage(browser) {
	const target = await browser.send("Target.createTarget", { url: "about:blank" });
	return {
		session: browser,
		sessionId: (await browser.send("Target.attachToTarget", {
			targetId: target.targetId,
			flatten: true
		})).sessionId
	};
}
//#endregion
//#region ../compat/src/browser-auth/discovery.ts
const exec = promisify(execFile);
function pushIfExists(out, id, kind, executable) {
	if (executable.length > 0 && existsSync(executable) && !out.some((item) => item.executable === executable)) out.push({
		id,
		kind,
		executable
	});
}
async function windowsCandidates() {
	const out = [];
	const pf = process.env.PROGRAMFILES ?? "C:\\Program Files";
	const pf86 = process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";
	const local = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
	const paths = [
		[
			"chrome",
			"chrome",
			join(pf, "Google", "Chrome", "Application", "chrome.exe")
		],
		[
			"chrome-x86",
			"chrome",
			join(pf86, "Google", "Chrome", "Application", "chrome.exe")
		],
		[
			"chrome-local",
			"chrome",
			join(local, "Google", "Chrome", "Application", "chrome.exe")
		],
		[
			"edge",
			"edge",
			join(pf, "Microsoft", "Edge", "Application", "msedge.exe")
		],
		[
			"edge-x86",
			"edge",
			join(pf86, "Microsoft", "Edge", "Application", "msedge.exe")
		],
		[
			"brave",
			"brave",
			join(local, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
		],
		[
			"chromium",
			"chromium",
			join(local, "Chromium", "Application", "chrome.exe")
		]
	];
	for (const [id, kind, executable] of paths) pushIfExists(out, id, kind, executable);
	try {
		const { stdout } = await exec("reg", [
			"query",
			"HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
			"/ve"
		]);
		const match = stdout.match(/REG_SZ\s+(.+\.exe)/i);
		if (match?.[1]) pushIfExists(out, "chrome-app-path", "chrome", match[1].trim());
	} catch {}
	return out;
}
function macCandidates() {
	const out = [];
	for (const [id, kind, executable] of [
		[
			"chrome",
			"chrome",
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
		],
		[
			"edge",
			"edge",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
		],
		[
			"brave",
			"brave",
			"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
		],
		[
			"chromium",
			"chromium",
			"/Applications/Chromium.app/Contents/MacOS/Chromium"
		]
	]) pushIfExists(out, id, kind, executable);
	return out;
}
function linuxCandidates() {
	const out = [];
	const names = [
		["google-chrome", "chrome"],
		["google-chrome-stable", "chrome"],
		["microsoft-edge", "edge"],
		["microsoft-edge-stable", "edge"],
		["brave-browser", "brave"],
		["chromium", "chromium"],
		["chromium-browser", "chromium"]
	];
	const pathDirs = (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":");
	for (const [name, kind] of names) for (const dir of pathDirs) pushIfExists(out, name, kind, join(dir, name));
	return out;
}
async function discoverBrowsers(options) {
	if (options?.fsExists) {
		const fake = [];
		const check = options.fsExists;
		const probe = (id, kind, executable) => {
			if (check(executable)) fake.push({
				id,
				kind,
				executable
			});
		};
		probe("chrome", "chrome", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
		probe("edge", "edge", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe");
		probe("brave", "brave", join(homedir(), "AppData", "Local", "BraveSoftware", "Brave-Browser", "Application", "brave.exe"));
		probe("path-chrome", "chrome", join("C:\\fake-path", "chrome.exe"));
		return fake;
	}
	const platform = options?.platform ?? process.platform;
	if (platform === "win32") return windowsCandidates();
	if (platform === "darwin") return macCandidates();
	return linuxCandidates();
}
function preferCandidate(candidates, preferred) {
	if (preferred !== "auto") return candidates.find((item) => item.kind === preferred) ?? candidates[0];
	for (const kind of [
		"chrome",
		"edge",
		"brave",
		"chromium",
		"managed"
	]) {
		const hit = candidates.find((item) => item.kind === kind);
		if (hit) return hit;
	}
	return candidates[0];
}
//#endregion
//#region ../compat/src/browser-auth/installer.ts
var FileLock = class {
	path;
	constructor(path) {
		this.path = path;
	}
	async acquire() {
		await mkdir(join(this.path, ".."), { recursive: true });
		const handle = await import("node:fs/promises").then((fs) => fs.open(this.path, "wx").catch(async (error) => {
			if (error.code !== "EEXIST") throw error;
			await new Promise((resolve) => setTimeout(resolve, 250));
			return fs.open(this.path, "wx");
		}));
		return async () => {
			await handle.close();
			await rm(this.path, { force: true });
		};
	}
};
async function installManagedBrowser(options) {
	if (!options.allowDownload) throw new DeepSeekWebError("managed browser download is disabled", ERROR_CODES.BROWSER_INSTALL);
	await mkdir(options.cacheDir, { recursive: true });
	const release = await new FileLock(join(options.cacheDir, ".lock")).acquire();
	try {
		try {
			const { computeExecutablePath, install } = await import("@puppeteer/browsers");
			const installed = await install({
				cacheDir: options.cacheDir,
				browser: "chrome",
				buildId: "stable",
				downloadProgressCallback: (_downloaded, total) => {
					if (total > 0) options.onProgress?.(Math.min(1, _downloaded / total));
				}
			});
			const executable = computeExecutablePath({
				cacheDir: options.cacheDir,
				browser: "chrome",
				buildId: installed.buildId ?? "stable"
			});
			if (!existsSync(executable)) throw new DeepSeekWebError("managed browser executable missing after install", ERROR_CODES.BROWSER_INSTALL);
			await writeFile(join(options.cacheDir, "CURRENT"), executable, "utf8");
			return {
				id: "managed-chrome",
				kind: "managed",
				executable
			};
		} catch (error) {
			if (error instanceof DeepSeekWebError) throw error;
			throw new DeepSeekWebError("managed browser install failed", ERROR_CODES.BROWSER_INSTALL, { cause: error });
		}
	} finally {
		await release();
	}
}
//#endregion
//#region ../compat/src/browser-auth/profile.ts
async function ensureIsolatedProfile(root) {
	await mkdir(root, { recursive: true });
	if (platform() !== "win32") await chmod(root, 448).catch(() => void 0);
	return root;
}
async function resetIsolatedProfile(root) {
	let lastError;
	for (let attempt = 0; attempt < 6; attempt++) try {
		await rm(root, {
			recursive: true,
			force: true
		});
		await mkdir(root, { recursive: true });
		if (platform() !== "win32") await chmod(root, 448).catch(() => void 0);
		return;
	} catch (error) {
		lastError = error;
		await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
	}
	throw lastError instanceof Error ? lastError : /* @__PURE__ */ new Error("failed to reset isolated browser profile");
}
async function readDevToolsActivePort(userDataDir) {
	const [portLine, pathLine] = (await readFile(join(userDataDir, "DevToolsActivePort"), "utf8")).split(/\r?\n/);
	const port = Number(portLine);
	if (!Number.isInteger(port) || port <= 0) throw new Error("invalid DevToolsActivePort");
	const path = (pathLine ?? "").trim() || "/devtools/browser";
	return {
		port,
		browserWS: `ws://127.0.0.1:${port}${path.startsWith("/") ? path : `/${path}`}`
	};
}
//#endregion
//#region ../compat/src/browser-auth/process.ts
async function launchIsolatedBrowser(options) {
	const args = [
		`--user-data-dir=${options.userDataDir}`,
		"--remote-debugging-port=0",
		"--no-first-run",
		"--no-default-browser-check",
		"about:blank",
		...options.extraArgs ?? []
	];
	if (args.some((arg) => arg.includes("disable-web-security") || arg.includes("ignore-certificate-errors"))) throw new DeepSeekWebError("refusing insecure browser flags", ERROR_CODES.BROWSER_LAUNCH);
	await rm(join(options.userDataDir, "DevToolsActivePort"), { force: true });
	const startedAt = Date.now();
	const child = spawn(options.executable, args, {
		stdio: "ignore",
		windowsHide: false,
		detached: false
	});
	child.on("error", () => void 0);
	const deadline = Date.now() + 15e3;
	let lastError;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) throw new DeepSeekWebError("browser process exited before publishing DevTools", ERROR_CODES.BROWSER_LAUNCH);
		try {
			const info = await readDevToolsActivePort(options.userDataDir);
			if ((await stat(join(options.userDataDir, "DevToolsActivePort"))).mtimeMs + 25 < startedAt) throw new Error("stale DevToolsActivePort");
			return {
				process: child,
				userDataDir: options.userDataDir,
				executable: options.executable,
				...info
			};
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
	}
	await killProcessTree(child.pid);
	throw new DeepSeekWebError("browser launched but DevToolsActivePort was not published", ERROR_CODES.BROWSER_LAUNCH, { cause: lastError });
}
async function killProcessTree(pid) {
	if (pid === void 0) return;
	if (process.platform === "win32") {
		await new Promise((resolve) => {
			const killer = spawn("taskkill", [
				"/PID",
				String(pid),
				"/T",
				"/F"
			], {
				stdio: "ignore",
				windowsHide: true
			});
			killer.on("exit", () => resolve());
			killer.on("error", () => resolve());
		});
		return;
	}
	try {
		process.kill(-pid, "SIGTERM");
	} catch {
		try {
			process.kill(pid, "SIGTERM");
		} catch {}
	}
}
async function stopBrowser(launched) {
	if (launched === void 0) return;
	await killProcessTree(launched.process.pid);
}
//#endregion
//#region ../compat/src/browser-auth/state.ts
function signedOut() {
	return { status: "signed-out" };
}
//#endregion
//#region ../compat/src/browser-auth/coordinator.ts
var BrowserAuthCoordinator = class {
	deps;
	state = signedOut();
	operation;
	launched;
	cdp;
	cancellation;
	explicitSignOut = false;
	constructor(deps) {
		this.deps = deps;
	}
	async status() {
		if (this.operation !== void 0) return this.state;
		if (this.state.status === "signed-in" || this.state.status === "error") return this.state;
		if (this.explicitSignOut) return this.state;
		const stored = await this.deps.readStoredAccount?.();
		if (stored) this.state = {
			status: "signed-in",
			account: stored,
			browser: { kind: "unknown" }
		};
		return this.state;
	}
	signIn(options) {
		if (this.operation !== void 0) return this.operation;
		this.explicitSignOut = false;
		this.state = { status: "detecting-browser" };
		this.cancellation = new AbortController();
		const signal = options?.signal;
		const onAbort = () => this.cancellation?.abort();
		signal?.addEventListener("abort", onAbort, { once: true });
		this.operation = this.run(options).finally(() => {
			this.operation = void 0;
			this.cancellation = void 0;
			signal?.removeEventListener("abort", onAbort);
		});
		return this.operation;
	}
	async cancel() {
		this.cancellation?.abort();
		await this.operation?.catch(() => void 0);
		await this.cleanup();
		if (this.state.status !== "signed-in") this.state = {
			status: "error",
			code: ERROR_CODES.BROWSER_LOGIN_CANCELLED,
			message: "login cancelled"
		};
	}
	async signOut(options) {
		this.explicitSignOut = true;
		await this.cancel();
		try {
			await this.deps.clearCredential();
		} catch {}
		if (options?.clearProfile !== false) await resetIsolatedProfile(this.profileDir());
		this.state = signedOut();
	}
	async dispose() {
		await this.cancel();
	}
	profileDir() {
		return join(this.deps.resolveHome(), "browser-profiles", "dsh-deepseek-web");
	}
	cacheDir() {
		return join(this.deps.resolveHome(), "cache", "dsh-deepseek-web", "browser");
	}
	async run(options) {
		try {
			if (options?.resetProfile) {
				try {
					await this.deps.clearCredential();
				} catch {}
				await resetIsolatedProfile(this.profileDir());
			}
			this.state = { status: "detecting-browser" };
			let selected = preferCandidate(await discoverBrowsers(), options?.preferred ?? "auto");
			if ((selected === void 0 || options?.preferred === "managed") && (options?.allowManagedDownload ?? true)) {
				this.state = { status: "installing-browser" };
				selected = await installManagedBrowser({
					cacheDir: this.cacheDir(),
					allowDownload: options?.allowManagedDownload ?? true,
					onProgress: (progress) => {
						this.state = {
							status: "installing-browser",
							progress
						};
					}
				});
			}
			if (selected === void 0) throw new DeepSeekWebError("no compatible browser found", ERROR_CODES.BROWSER_NOT_FOUND);
			this.state = { status: "launching-browser" };
			const userDataDir = await ensureIsolatedProfile(this.profileDir());
			this.launched = await launchIsolatedBrowser({
				executable: selected.executable,
				userDataDir
			});
			this.cdp = await CdpSession.connect(this.launched.browserWS);
			const page = await attachPage(this.cdp);
			const correlator = new HeaderCorrelator();
			let captured;
			const capture = (method, params) => {
				if (method !== "Network.requestWillBeSent" && method !== "Network.requestWillBeSentExtraInfo") return;
				const request = params.request;
				const url = request?.url ?? (params.headers !== void 0 ? void 0 : void 0);
				const requestId = String(params.requestId ?? "");
				const headers = request?.headers ?? params.headers;
				if (url !== void 0 && !isTargetApiRequest(url) && method === "Network.requestWillBeSent") return;
				const bearer = correlator.consider(requestId, url ?? `https://chat.deepseek.com/api/v0/`, headers);
				if (bearer) captured = bearer;
				const extra = extractBearer(params.headers);
				if (extra && (url === void 0 || isTargetApiRequest(url))) captured = extra;
			};
			this.cdp.onEvent(capture);
			await page.session.send("Network.enable", {}, page.sessionId);
			await page.session.send("Page.enable", {}, page.sessionId);
			this.state = { status: "waiting-for-login" };
			await page.session.send("Page.navigate", { url: DEEPSEEK_WEB_ORIGIN }, page.sessionId);
			const deadline = Date.now() + 9e5;
			while (Date.now() < deadline) {
				if (this.cancellation?.signal.aborted) throw new DeepSeekWebError("login cancelled", ERROR_CODES.BROWSER_LOGIN_CANCELLED);
				if (captured) {
					this.state = { status: "validating" };
					try {
						const account = await this.deps.validateCredential(captured, this.cancellation?.signal);
						await this.deps.storeCredential(captured);
						captured = void 0;
						this.state = {
							status: "signed-in",
							account,
							browser: {
								kind: selected.kind,
								version: selected.version
							}
						};
						await this.cleanup();
						return this.state;
					} catch {
						captured = void 0;
						this.state = { status: "waiting-for-login" };
					}
				}
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
			throw new DeepSeekWebError("login timed out", ERROR_CODES.BROWSER_LOGIN_CANCELLED);
		} catch (error) {
			await this.cleanup();
			const code = error instanceof DeepSeekWebError ? error.code : ERROR_CODES.BROWSER_LAUNCH;
			const message = error instanceof Error ? error.message : String(error);
			this.state = {
				status: "error",
				code,
				message
			};
			return this.state;
		}
	}
	async cleanup() {
		this.cdp?.close();
		this.cdp = void 0;
		await stopBrowser(this.launched);
		this.launched = void 0;
	}
};
//#endregion
//#region src/config.ts
const PROVIDER = "deepseek-web";
const CREDENTIAL_REF_DEFAULT = "DEEPSEEK_WEB_TOKEN";
const SETTINGS_NS = "llm-deepseek-web";
const DEFAULT_CONFIG = {
	tokenEnv: CREDENTIAL_REF_DEFAULT,
	defaultModel: "default",
	thinking: "enabled",
	nativeSearch: "on",
	streamIdleTimeoutMs: 18e4,
	maxToolProtocolBytes: 131072,
	maxToolCallsPerTurn: 16,
	maxProtocolRepairAttempts: 2,
	maxToolResultBytes: 65536,
	browser: {
		preferred: "auto",
		allowManagedDownload: true
	}
};
function nativeSearchActive(_config, model) {
	return model !== "expert";
}
function resolveConfig(raw = {}) {
	const maxToolCallsPerTurn = raw.maxToolCallsPerTurn ?? DEFAULT_CONFIG.maxToolCallsPerTurn;
	if (!Number.isInteger(maxToolCallsPerTurn) || maxToolCallsPerTurn < 1 || maxToolCallsPerTurn > 32) throw new Error("dsh-deepseek-web-free: maxToolCallsPerTurn must be an integer in 1..32");
	return {
		tokenEnv: raw.tokenEnv ?? DEFAULT_CONFIG.tokenEnv,
		defaultModel: raw.defaultModel ?? DEFAULT_CONFIG.defaultModel,
		thinking: raw.thinking ?? DEFAULT_CONFIG.thinking,
		nativeSearch: "on",
		streamIdleTimeoutMs: raw.streamIdleTimeoutMs ?? DEFAULT_CONFIG.streamIdleTimeoutMs,
		maxToolProtocolBytes: raw.maxToolProtocolBytes ?? DEFAULT_CONFIG.maxToolProtocolBytes,
		maxToolCallsPerTurn,
		maxProtocolRepairAttempts: raw.maxProtocolRepairAttempts ?? DEFAULT_CONFIG.maxProtocolRepairAttempts,
		maxToolResultBytes: raw.maxToolResultBytes ?? DEFAULT_CONFIG.maxToolResultBytes,
		browser: {
			preferred: raw.browser?.preferred ?? DEFAULT_CONFIG.browser.preferred,
			allowManagedDownload: raw.browser?.allowManagedDownload ?? DEFAULT_CONFIG.browser.allowManagedDownload
		}
	};
}
//#endregion
export { nativeSearchActive as a, CompatDeepSeekWebClient as c, loadProtocolCore as d, redactSensitiveText as f, SETTINGS_NS as i, rewriteCitationMarkers as l, ERROR_CODES as m, DEFAULT_CONFIG as n, resolveConfig as o, DeepSeekWebError as p, PROVIDER as r, BrowserAuthCoordinator as s, CREDENTIAL_REF_DEFAULT as t, PowWorkerPool as u };

//# sourceMappingURL=config-DACadRbL.js.map