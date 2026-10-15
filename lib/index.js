import { a as nativeSearchActive, c as CompatDeepSeekWebClient, d as loadProtocolCore, f as redactSensitiveText, i as SETTINGS_NS, l as rewriteCitationMarkers, m as ERROR_CODES$1, n as DEFAULT_CONFIG, o as resolveConfig, p as DeepSeekWebError, r as PROVIDER, s as BrowserAuthCoordinator, u as PowWorkerPool } from "./config-DACadRbL.js";
import { mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import z from "@deepseek-ai/schemastery";
import { LlmAdapter, LlmError, ReasoningEffortId, createAssistantMessage, createUserMessage } from "@deepseek-ai/dsh-llm";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { createHash } from "node:crypto";
//#region ../compat/src/citation.ts
const MARKER = "[citation:";
function markerPrefixSuffixLen(value) {
	for (let length = 9; length > 0; length -= 1) if (value.endsWith(MARKER.slice(0, length))) return length;
	return 0;
}
function citationMarkdown(citation) {
	return `[${citation.title ?? citation.siteName ?? citation.url}](${citation.url})`;
}
var CitationStreamGate = class {
	pending = "";
	rendered = "";
	get text() {
		return this.rendered;
	}
	push(delta, citations, finish = false) {
		this.pending += delta;
		let visible = "";
		while (true) {
			const start = this.pending.indexOf(MARKER);
			if (start < 0) {
				const held = finish ? 0 : markerPrefixSuffixLen(this.pending);
				const visibleEnd = this.pending.length - held;
				visible += this.pending.slice(0, visibleEnd);
				this.pending = this.pending.slice(visibleEnd);
				break;
			}
			visible += this.pending.slice(0, start);
			this.pending = this.pending.slice(start);
			const close = this.pending.indexOf("]");
			if (close < 0) {
				if (finish) {
					visible += this.pending;
					this.pending = "";
				}
				break;
			}
			const marker = this.pending.slice(0, close + 1);
			const index = Number(marker.slice(10, -1).trim());
			const citation = citations.find((item) => item.citeIndex === index);
			if (citation !== void 0) {
				visible += citationMarkdown(citation);
				this.pending = this.pending.slice(close + 1);
				continue;
			}
			if (finish) {
				visible += marker;
				this.pending = this.pending.slice(close + 1);
				continue;
			}
			break;
		}
		this.rendered += visible;
		return visible;
	}
};
//#endregion
//#region ../compat/src/browser-auth/security.ts
const LOOPBACK = /* @__PURE__ */ new Set([
	"127.0.0.1",
	"::1",
	"::ffff:127.0.0.1"
]);
function trustedPluginRequest(req) {
	const remote = req.socket.remoteAddress;
	if (remote === void 0 || !LOOPBACK.has(remote)) return false;
	if (req.headers["sec-fetch-site"] === "cross-site") return false;
	const host = req.headers.host;
	if (host === void 0 || host.length === 0) return false;
	const origin = req.headers.origin;
	if (origin !== void 0 && origin.length > 0) try {
		if (new URL(origin).host !== host) return false;
	} catch {
		return false;
	}
	return true;
}
function pluginResponseHeaders() {
	return {
		"cache-control": "no-store",
		"x-content-type-options": "nosniff",
		"content-type": "application/json; charset=utf-8"
	};
}
//#endregion
//#region src/search-timeline.ts
function searchTimelineSources(citations) {
	const seen = /* @__PURE__ */ new Set();
	const sources = [];
	for (const citation of citations) {
		if (citation.url.length === 0 || seen.has(citation.url)) continue;
		seen.add(citation.url);
		sources.push({
			url: citation.url,
			title: citation.title ?? citation.siteName ?? citation.url
		});
	}
	return sources;
}
/** Markdown source list mapped from chat.deepseek.com SEARCH citations. */
function formatSearchTimeline(citations) {
	const sources = searchTimelineSources(citations);
	if (sources.length === 0) return "";
	return `${sources.length === 1 ? "Found 1 source" : `Found ${sources.length} sources`}\n\n${sources.map((source, index) => `${index + 1}. [${source.title}](${source.url})`).join("\n")}`;
}
//#endregion
//#region src/messages.ts
function messageHasImage(messages) {
	for (const message of messages) {
		const content = message.content;
		if (!Array.isArray(content)) continue;
		if (content.some((block) => block.type === "image")) return true;
	}
	return false;
}
function flattenText(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.filter((block) => block.type === "text" || block.type === "reasoning").map((block) => String(block.text ?? "")).join("\n");
}
function toolCallBlocks(content) {
	if (!Array.isArray(content)) return [];
	return content.filter((block) => block.type === "tool-call").map((block) => block);
}
function toolResultFromMessage(message) {
	const record = message;
	if (record.source?.kind !== "tool") return void 0;
	const typed = Array.isArray(record.content) ? record.content[0] : record.content;
	return {
		id: String(typed?.id ?? typed?.toolCallId ?? record.source.callId ?? ""),
		content: typed?.content ?? record.content,
		isError: Boolean(typed?.isError)
	};
}
//#endregion
//#region src/title.ts
/** EasyPhy-style session titles: JSON `{ title }` plus a local fallback. Never a chat turn. */
const TITLE_LIMIT = 20;
const GENERIC_KEYS = /* @__PURE__ */ new Set([
	"新对话",
	"对话主题",
	"会话主题",
	"聊天主题",
	"对话标题",
	"会话标题",
	"聊天标题",
	"untitled",
	"conversationtopic",
	"chattopic",
	"conversationtitle",
	"chattitle"
]);
const POLITE_PREFIXES = [
	"请帮我",
	"请你帮我",
	"麻烦帮我",
	"麻烦你",
	"能不能帮我",
	"可以帮我",
	"请问",
	"请",
	"现在",
	"我想要",
	"我想",
	"帮我",
	"please ",
	"could you ",
	"can you "
];
const ACTION_PREFIXES = [
	"看一下",
	"看下",
	"检查一下",
	"检查下",
	"如何",
	"怎么"
];
const TITLE_REQUEST_MARKER = "JSON array of human messages:";
function compact(value) {
	return value.replace(/\s+/g, " ").trim();
}
function firstLine(value) {
	return value.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0) ?? "";
}
function stripDecorators(value) {
	let title = value.replace(/^[#*\-•\s]+/, "").trim();
	for (const prefix of [
		"标题：",
		"标题:",
		"主题：",
		"主题:",
		"Title:"
	]) if (title.startsWith(prefix)) {
		title = title.slice(prefix.length).trim();
		break;
	}
	return title.replace(/^["'“‘]+/, "").replace(/["'”’]+$/, "").replace(/[。.!！?？]+$/, "").trim();
}
function truncate(value, limit) {
	const chars = [...value];
	return chars.length <= limit ? value : chars.slice(0, limit).join("");
}
function genericKey(title) {
	return [...title].filter((character) => /\p{Letter}|\p{Number}/u.test(character)).join("").toLowerCase();
}
function isGeneric(title) {
	return GENERIC_KEYS.has(genericKey(title));
}
/**
* Parse a structured title payload (`{"title":"..."}` / `{"标题":"..."}`) or
* the first usable line of free text. Mirrors EasyPhy `normalize_title`.
*/
function parseStructuredTitle(value) {
	const trimmed = value.trim();
	let raw = trimmed;
	try {
		const parsed = JSON.parse(trimmed);
		if (typeof parsed === "string") raw = parsed;
		else if (typeof parsed === "object" && parsed !== null) {
			const record = parsed;
			const nested = record.title ?? record["标题"] ?? record.content;
			if (typeof nested === "string" && nested.trim().length > 0) raw = nested;
		}
	} catch {}
	const title = stripDecorators(compact(firstLine(raw)));
	if (title.length === 0 || isGeneric(title)) return "新对话";
	return truncate(title, TITLE_LIMIT);
}
function userText(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.filter((block) => block.type === "text").map((block) => String(block.text ?? "")).join("\n");
}
function messageText(item) {
	if (typeof item === "string") return item;
	if (typeof item !== "object" || item === null) return "";
	const record = item;
	const value = record.text ?? record.content ?? record.title;
	return typeof value === "string" ? value : "";
}
/** Unwrap DSH session-title-llm's JSON-framed user prompt into source texts. */
function unframeTitleRequest(text) {
	const index = text.indexOf(TITLE_REQUEST_MARKER);
	const payload = (index >= 0 ? text.slice(index + 29) : text).trim();
	try {
		const parsed = JSON.parse(payload);
		if (!Array.isArray(parsed)) return [];
		return parsed.map(messageText).map(compact).filter((item) => item.length > 0);
	} catch {
		return [];
	}
}
function sourceTexts(messages) {
	const texts = [];
	for (const message of messages) {
		const record = message;
		if (record.role !== void 0 && record.role !== "user") continue;
		const raw = compact(userText(record.content ?? record));
		if (raw.length === 0) continue;
		const framed = unframeTitleRequest(raw);
		if (framed.length > 0) texts.push(...framed);
		else texts.push(raw);
	}
	return texts;
}
function fallbackTitleFromText(source) {
	let text = compact(source);
	for (;;) {
		const lower = text.toLowerCase();
		const prefix = POLITE_PREFIXES.find((item) => lower.startsWith(item.toLowerCase())) ?? ACTION_PREFIXES.find((item) => text.startsWith(item));
		if (prefix === void 0) break;
		text = text.slice(prefix.length).trim();
	}
	const candidate = parseStructuredTitle(text.split(/[。！？!?；;\n\r]/).map((part) => part.trim()).find((part) => part.length > 0) ?? text);
	return candidate === "新对话" ? "新对话" : truncate(candidate, 18);
}
function looksStructured(value) {
	try {
		const parsed = JSON.parse(value.trim());
		if (typeof parsed === "string") return true;
		if (typeof parsed !== "object" || parsed === null) return false;
		const record = parsed;
		return typeof record.title === "string" || typeof record["标题"] === "string";
	} catch {
		return false;
	}
}
/** Local fallback from the first user prompt when Web providers skip a remote title turn. */
function fallbackSessionTitle(messages) {
	for (const text of sourceTexts(messages)) {
		if (looksStructured(text)) {
			const structured = parseStructuredTitle(text);
			if (structured !== "新对话") return structured;
		}
		const title = fallbackTitleFromText(text);
		if (title !== "新对话") return title;
	}
	return "新对话";
}
/** Prefer the official Web `event: title`, else a local EasyPhy-style fallback. */
function resolveSessionTitle(liveTitle, messages) {
	if (liveTitle !== void 0 && liveTitle.trim().length > 0) {
		const title = parseStructuredTitle(liveTitle);
		if (title !== "新对话") return title;
	}
	return fallbackSessionTitle(messages);
}
//#endregion
//#region src/tool-bridge/parser.ts
const DSML_OPEN = "<||DSML||";
const DSML_FULLWIDTH_OPEN = "<｜DSML｜";
const XML_INVOKE_OPEN = "<invoke name=";
const MARKED_BLOCKS = [
	["<dsh_tool_calls>", "</dsh_tool_calls>"],
	["<easyphy_tool_calls>", "</easyphy_tool_calls>"],
	["<ds_local_tool_calls>", "</ds_local_tool_calls>"],
	["<dsh_local_tool_calls>", "</dsh_local_tool_calls>"],
	["<ds_tool_calls>", "</ds_tool_calls>"],
	["<function_calls>", "</function_calls>"],
	["<tool_calls>", "</tool_calls>"]
];
const TEXT_PROTOCOL_OPEN_MARKERS = [
	...MARKED_BLOCKS.map(([open]) => open),
	DSML_OPEN,
	DSML_FULLWIDTH_OPEN,
	XML_INVOKE_OPEN
];
/** First complete marked tool block, ignoring surrounding natural language. */
function extractMarkedToolSlice(content) {
	let best;
	for (const [open, close] of MARKED_BLOCKS) {
		const start = content.indexOf(open);
		if (start < 0) continue;
		if (insideFence(content, start)) continue;
		const bodyStart = start + open.length;
		const relativeEnd = content.slice(bodyStart).indexOf(close);
		if (relativeEnd < 0) continue;
		const slice = content.slice(start, bodyStart + relativeEnd + close.length);
		if (best === void 0 || start < best.start) best = {
			start,
			slice
		};
	}
	return best?.slice;
}
/**
* Answer channel first, then thinking. A well-formed block in DeepThink is
* recovered for execution but never shown as reasoning text.
*/
function resolveToolProtocol(channels, allowedTools, options) {
	const tryParse = (content) => {
		if (content === void 0 || content.trim().length === 0) return { kind: "none" };
		const strict = parseToolProtocol(content, allowedTools, options);
		if (strict.kind === "calls") return strict;
		const slice = extractMarkedToolSlice(content);
		if (slice !== void 0 && slice !== content.trim()) {
			const extracted = parseToolProtocol(slice, allowedTools, options);
			if (extracted.kind === "calls") return extracted;
		}
		return strict;
	};
	const fromText = tryParse(channels.text);
	if (fromText.kind === "calls") return fromText;
	const fromReasoning = tryParse(channels.reasoning);
	if (fromReasoning.kind === "calls") return fromReasoning;
	return fromText.kind !== "none" ? fromText : fromReasoning;
}
function visibleTextBeforeToolProtocol(text, hasTools) {
	if (!hasTools) return text;
	let cut = text.length;
	for (const marker of TEXT_PROTOCOL_OPEN_MARKERS) {
		const at = text.indexOf(marker);
		if (at >= 0) cut = Math.min(cut, at);
	}
	const before = text.slice(0, cut);
	const hold = trailingToolMarkerPrefixLen(before);
	return before.slice(0, before.length - hold);
}
function trailingToolMarkerPrefixLen(text) {
	let held = 0;
	for (const marker of TEXT_PROTOCOL_OPEN_MARKERS) for (let length = Math.min(marker.length - 1, text.length); length > 0; length -= 1) if (text.endsWith(marker.slice(0, length))) {
		held = Math.max(held, length);
		break;
	}
	return held;
}
function toBridgeTools(tools) {
	return tools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		parameters: tool.parameters
	}));
}
function canonicalJson(value) {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}
function toolCallId(responseMessageId, index, name, args) {
	const framed = [
		String(responseMessageId.length),
		responseMessageId,
		String(String(index).length),
		String(index),
		String(name.length),
		name,
		String(canonicalJson(args).length),
		canonicalJson(args)
	].join("\0");
	return `deepseek-web-${createHash("sha256").update(framed).digest("hex").slice(0, 32)}`;
}
function insideFence(content, index) {
	return (content.slice(0, index).split("```").length - 1) % 2 === 1;
}
function repairTruncatedJson(body) {
	const stack = [];
	let inString = false;
	let escaped = false;
	for (const ch of body) {
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === "\"") inString = false;
			continue;
		}
		if (ch === "\"") inString = true;
		else if (ch === "{") stack.push("}");
		else if (ch === "[") stack.push("]");
		else if (ch === "}" || ch === "]") {
			if (stack.pop() !== ch) return void 0;
		}
	}
	if (inString || escaped || stack.length === 0 || stack.length > 8) return void 0;
	const repaired = body + stack.reverse().join("");
	try {
		JSON.parse(repaired);
		return repaired;
	} catch {
		return;
	}
}
function parseMarkedBlock(content, open, close, allowed, maxBytes, maxCalls, responseMessageId) {
	const start = content.indexOf(open);
	if (start < 0) {
		if (content.includes(close)) return {
			kind: "invalid",
			reason: "tool protocol missing open marker"
		};
		return;
	}
	if (insideFence(content, start)) return {
		kind: "invalid",
		reason: "tool protocol must not be fenced"
	};
	if (content.slice(start + open.length).includes(open)) return {
		kind: "invalid",
		reason: "multiple open markers"
	};
	const bodyStart = start + open.length;
	const relativeEnd = content.slice(bodyStart).indexOf(close);
	if (relativeEnd < 0) return {
		kind: "invalid",
		reason: "tool protocol missing close marker"
	};
	const bodyEnd = bodyStart + relativeEnd;
	if (bodyEnd - bodyStart > maxBytes) return {
		kind: "invalid",
		reason: "tool protocol exceeds size limit"
	};
	if (content.slice(bodyEnd + close.length).trim().length > 0) return {
		kind: "invalid",
		reason: "text after tool protocol"
	};
	const raw = content.slice(bodyStart, bodyEnd).trim();
	try {
		return callsFromJson(JSON.parse(raw), allowed, maxCalls, responseMessageId);
	} catch (error) {
		const repaired = repairTruncatedJson(raw);
		if (repaired !== void 0) try {
			return callsFromJson(JSON.parse(repaired), allowed, maxCalls, responseMessageId);
		} catch {}
		const xml = parseInvokes(raw, allowed, maxCalls, responseMessageId);
		if (xml !== void 0) return xml;
		return {
			kind: "invalid",
			reason: `invalid tool protocol JSON: ${String(error)}`
		};
	}
}
function callsFromJson(parsed, allowed, maxCalls, responseMessageId) {
	if (typeof parsed !== "object" || parsed === null) return {
		kind: "invalid",
		reason: "tool protocol is not an object"
	};
	const version = parsed.version;
	if (version !== void 0 && version !== 1) return {
		kind: "invalid",
		reason: "unsupported tool protocol version"
	};
	const rawCalls = parsed.calls;
	if (!Array.isArray(rawCalls)) return {
		kind: "invalid",
		reason: "tool protocol missing calls array"
	};
	if (rawCalls.length < 1 || rawCalls.length > maxCalls) return {
		kind: "invalid",
		reason: `tool protocol calls must be 1..${maxCalls}`
	};
	const calls = [];
	for (const [index, raw] of rawCalls.entries()) {
		if (typeof raw !== "object" || raw === null) return {
			kind: "invalid",
			reason: `call ${index + 1} is not an object`
		};
		const name = String(raw.name ?? "").trim();
		if (name.length === 0) return {
			kind: "invalid",
			reason: `call ${index + 1} has empty name`
		};
		if (!allowed.has(name)) return {
			kind: "invalid",
			reason: `tool ${name} is not allowed`
		};
		let args = raw.arguments;
		if (typeof args === "string") try {
			args = JSON.parse(args);
		} catch {
			return {
				kind: "invalid",
				reason: `call ${index + 1} arguments are not a JSON object`
			};
		}
		if (typeof args !== "object" || args === null || Array.isArray(args)) return {
			kind: "invalid",
			reason: `call ${index + 1} arguments must be an object`
		};
		const objectArgs = args;
		calls.push({
			id: toolCallId(responseMessageId, index, name, objectArgs),
			name,
			arguments: objectArgs
		});
	}
	return {
		kind: "calls",
		calls
	};
}
function stripDsml(content) {
	return content.replaceAll("<||DSML||", "<").replaceAll("</||DSML||", "</").replaceAll("<｜DSML｜", "<").replaceAll("</｜DSML｜", "</");
}
function parseParamValue(raw) {
	const trimmed = raw.trim();
	if (trimmed.length === 0) return "";
	try {
		return JSON.parse(trimmed);
	} catch {
		return raw.startsWith("\n") || raw.endsWith("\n") ? trimmed : raw;
	}
}
function parseInvokes(content, allowed, maxCalls, responseMessageId) {
	const normalized = stripDsml(content);
	if (!/<invoke\s+name=/i.test(normalized)) return void 0;
	const calls = [];
	let rest = normalized;
	while (true) {
		const match = rest.match(/<invoke\s+name=["']([^"']+)["'][^>]*>/i);
		if (match === null || match.index === void 0) break;
		rest = rest.slice(match.index + match[0].length);
		const closeMatch = rest.match(/<\/invoke>/i);
		if (closeMatch === null || closeMatch.index === void 0) return {
			kind: "invalid",
			reason: "tool invoke missing close tag"
		};
		const body = rest.slice(0, closeMatch.index);
		rest = rest.slice(closeMatch.index + closeMatch[0].length);
		const name = match[1].trim();
		if (name.length === 0) return {
			kind: "invalid",
			reason: `call ${calls.length + 1} has empty name`
		};
		if (!allowed.has(name)) return {
			kind: "invalid",
			reason: `tool ${name} is not allowed`
		};
		const args = {};
		let paramRest = body;
		while (true) {
			const param = paramRest.match(/<parameter\s+name=["']([^"']+)["'][^>]*>/i);
			if (param === null || param.index === void 0) break;
			paramRest = paramRest.slice(param.index + param[0].length);
			const pCloseMatch = paramRest.match(/<\/parameter>/i);
			if (pCloseMatch === null || pCloseMatch.index === void 0) return {
				kind: "invalid",
				reason: `tool ${name} parameter ${param[1]} missing close tag`
			};
			args[param[1]] = parseParamValue(paramRest.slice(0, pCloseMatch.index));
			paramRest = paramRest.slice(pCloseMatch.index + pCloseMatch[0].length);
		}
		calls.push({
			id: toolCallId(responseMessageId, calls.length, name, args),
			name,
			arguments: args
		});
	}
	if (calls.length === 0) return {
		kind: "invalid",
		reason: "invoke marker without a complete call"
	};
	if (calls.length > maxCalls) return {
		kind: "invalid",
		reason: "too many tool calls"
	};
	return {
		kind: "calls",
		calls
	};
}
function parseDsml(content, allowed, maxCalls, responseMessageId) {
	const normalized = content.replaceAll("｜", "|");
	if (!normalized.includes("<||DSML||tool_calls>") && !normalized.includes("<||DSML||invoke")) return void 0;
	return parseInvokes(normalized, allowed, maxCalls, responseMessageId) ?? {
		kind: "invalid",
		reason: "DSML marker without invokes"
	};
}
function parseToolProtocol(content, allowedTools, options) {
	const allowed = new Set(allowedTools);
	for (const [open, close] of MARKED_BLOCKS) {
		const parsed = parseMarkedBlock(content, open, close, allowed, options.maxBytes, options.maxCalls, options.responseMessageId);
		if (parsed) return parsed;
	}
	const dsml = parseDsml(content, allowed, options.maxCalls, options.responseMessageId);
	if (dsml) return dsml;
	const stripped = stripDsml(content).trimStart();
	if (/^<invoke\s+name=/i.test(stripped)) {
		const xml = parseInvokes(content, allowed, options.maxCalls, options.responseMessageId);
		if (xml) return xml;
	}
	return { kind: "none" };
}
//#endregion
//#region src/tool-bridge/contract.ts
function buildToolContract(tools, maxCalls) {
	if (tools.length === 0) return "";
	return `
<DSH_LOCAL_TOOL_CONTRACT version="1">
DeepSeek Web does not expose native function calling.
Harness tools are requested only on the answer channel.

CHANNELS:
- thinking / DeepThink: natural-language planning only. Never emit tool tags, JSON call objects, executable command payloads, or a draft of the answer-channel block.
- answer: if a local operation is required, emit exactly one un-fenced block and stop. Otherwise answer the user.

Answer-channel schema (never copy this into thinking):
<dsh_tool_calls>{"version":1,"calls":[{"name":"TOOL_NAME","arguments":{}}]}</dsh_tool_calls>
Rules:
- tool tags belong only in the answer channel
- when calling tools, no user-visible text before or after the block
- use only listed tools
- arguments must be a JSON object
- max ${maxCalls} calls
- never claim execution before Harness returns results
- do not emit <ds_local_tool_calls>, <invoke>, or DSML; those are parsed only as a compatibility fallback
- the runtime strips tool tags from thinking so they never appear in the Think UI
Available tools:
${JSON.stringify(tools)}
</DSH_LOCAL_TOOL_CONTRACT>`;
}
function buildContractUpdate(tools) {
	return `<DSH_TOOL_CONTRACT_UPDATE>\n${JSON.stringify(tools)}\n</DSH_TOOL_CONTRACT_UPDATE>`;
}
function buildSystemUpdate(system) {
	return `<DSH_SYSTEM_UPDATE>\n${system}\n</DSH_SYSTEM_UPDATE>`;
}
//#endregion
//#region src/tool-bridge/result.ts
function utf8Bytes(value) {
	return Buffer.byteLength(value, "utf8");
}
function projectToolResult(id, content, isError, maxBytes) {
	const texts = [];
	const walk = (value) => {
		if (typeof value === "string") {
			texts.push({
				type: "text",
				text: value
			});
			return;
		}
		if (Array.isArray(value)) {
			for (const item of value) walk(item);
			return;
		}
		if (typeof value === "object" && value !== null) {
			const record = value;
			if (record.type === "image") {
				texts.push({
					type: "text",
					text: "[unsupported image tool result: DeepSeek Web inputModalities are text-only]"
				});
				return;
			}
			if (typeof record.text === "string") {
				texts.push({
					type: "text",
					text: record.text
				});
				return;
			}
			texts.push({
				type: "text",
				text: `opaque:${canonicalJson(record).slice(0, 1024)}`
			});
		}
	};
	walk(content);
	let combined = texts.map((item) => item.text).join("\n");
	if (utf8Bytes(combined) > maxBytes) {
		let cut = combined;
		while (utf8Bytes(cut) > maxBytes) cut = cut.slice(0, Math.floor(cut.length * .9));
		const omitted = utf8Bytes(combined) - utf8Bytes(cut);
		combined = `${cut}\n[omitted ${omitted} bytes]`;
	}
	return {
		id,
		isError,
		content: [{
			type: "text",
			text: combined
		}]
	};
}
function buildExchange(calls, results) {
	return `<DSH_LOCAL_TOOL_EXCHANGE version="1">
${JSON.stringify({
		calls: calls.map((call) => ({
			id: call.id,
			name: call.name,
			arguments: call.arguments
		})),
		results
	})}
</DSH_LOCAL_TOOL_EXCHANGE>
Continue using the Harness tool results.
If another local operation is required, emit a new tool-call block in the answer channel, not in thinking.
Otherwise answer normally.`;
}
//#endregion
//#region src/tool-bridge/repair.ts
function promisedToolContinuation(content, nativeSearch = false) {
	const text = content.trim();
	if (text.length === 0) return false;
	const lower = text.toLowerCase();
	const english = [
		"let me ",
		"i'll ",
		"i will ",
		"i'm going to "
	];
	const actions = nativeSearch ? [
		"inspect",
		"read",
		"check",
		"run",
		"look at",
		"locate",
		"verify"
	] : [
		"inspect",
		"search",
		"read",
		"check",
		"run",
		"look at",
		"locate",
		"verify"
	];
	for (const marker of english) {
		const index = lower.indexOf(marker);
		if (index >= 0 && index < 80 && actions.some((action) => lower.includes(action))) return true;
	}
	const chineseIntent = [
		"我先",
		"我会先",
		"我将先",
		"接下来我"
	];
	const chineseAction = nativeSearch ? [
		"读取",
		"查看",
		"检查",
		"定位",
		"运行",
		"验证"
	] : [
		"查找",
		"搜索",
		"读取",
		"查看",
		"检查",
		"定位",
		"运行",
		"验证"
	];
	return chineseIntent.some((marker) => text.includes(marker)) && chineseAction.some((action) => text.includes(action));
}
function repairPrompt(reason, nativeSearch = false) {
	return `<DSH_TOOL_PROTOCOL_REPAIR>
The previous reply was not a valid Harness tool protocol: ${reason}${nativeSearch && /\bweb_search\b|\bweb_fetch\b/.test(reason) ? " web_search and web_fetch are not used on DeepSeek Web. Native search already runs on this turn; answer the user." : nativeSearch ? " Do not call web_search or web_fetch." : ""}
Emit exactly one un-fenced <dsh_tool_calls> block with valid JSON in the answer channel (not in thinking), or answer the user without claiming a local tool ran.
</DSH_TOOL_PROTOCOL_REPAIR>`;
}
function promisedContinuationPrompt(nativeSearch = false) {
	return `<DSH_TOOL_PROTOCOL_REPAIR>
You promised a local repository/file/shell operation.${nativeSearch ? " Looking up current public information is DeepSeek Web Search, not a Harness tool." : ""} Either emit a valid <dsh_tool_calls> block in the answer channel now, or answer without claiming the operation happened. Do not put the block in thinking.
</DSH_TOOL_PROTOCOL_REPAIR>`;
}
//#endregion
//#region src/prompt.ts
/** DSH agent-preset tools that the official Web Search toggle already covers. */
const NATIVE_SEARCH_SUPERSEDED_TOOLS = /* @__PURE__ */ new Set(["web_search", "web_fetch"]);
function filterToolsForNativeSearch(tools, nativeSearch) {
	if (!nativeSearch) return [...tools];
	return tools.filter((tool) => !NATIVE_SEARCH_SUPERSEDED_TOOLS.has(tool.name));
}
function nativeSearchOverride() {
	return `<DEEPSEEK_WEB_SEARCH>
DeepSeek Web Search is already enabled for this same turn (the official Web Search toggle). It runs automatically while you think and answer. It is not a callable tool and does not require a new conversation.
The agent preset may say to use web_search or web_fetch. Ignore those instructions here. Do not emit web_search, web_fetch, or any invented search tool. For current public information, answer normally; sources appear on the timeline.
Harness file, shell, and similar tools still use DSH_LOCAL_TOOL_CONTRACT when a local operation is required.
</DEEPSEEK_WEB_SEARCH>`;
}
function providerBoundary(nativeSearch, images) {
	return `<DEEPSEEK_WEB_AGENT_BOUNDARY>
This conversation runs through DeepSeek Web. ${nativeSearch ? "DeepSeek Web Search already runs automatically on this turn. It is not a Harness tool." : "The upstream model exposes no native function-calling API."} Never claim that DeepSeek itself called a Harness tool. Any listed tools are DeepSeek Harness capabilities mediated exclusively by DSH_LOCAL_TOOL_CONTRACT. ${images}
</DEEPSEEK_WEB_AGENT_BOUNDARY>`;
}
function buildFullPrompt(input) {
	const nativeSearch = input.nativeSearch === true;
	const images = (input.attachedImageCount ?? 0) > 0 ? `This turn includes ${input.attachedImageCount} DeepSeek file attachment(s) via ref_file_ids. Treat them as visual input.` : "";
	const conversation = input.messages.map((message) => formatMessage(message)).join("\n\n");
	const tools = filterToolsForNativeSearch(input.tools, nativeSearch);
	const search = nativeSearch ? `\n${nativeSearchOverride()}\n` : "\n";
	return `${providerBoundary(nativeSearch, images)}

<DSH_AGENT_INSTRUCTIONS>
${input.system ?? ""}
</DSH_AGENT_INSTRUCTIONS>
${search}
<DSH_CONVERSATION>
${conversation}
</DSH_CONVERSATION>
${buildToolContract(tools, input.maxCalls)}

Keep thinking free of tool tags. Return the next answer-channel response for the latest user task. If a local Harness operation is needed, emit one valid <dsh_tool_calls> block in the answer channel and stop; otherwise answer normally.`;
}
function buildIncrementalPrompt(input) {
	const nativeSearch = input.nativeSearch === true;
	const images = (input.attachedImageCount ?? 0) > 0 ? `This turn includes ${input.attachedImageCount} DeepSeek file attachment(s) via ref_file_ids.` : "";
	const toolsUpdate = input.toolsUpdate === void 0 ? void 0 : filterToolsForNativeSearch(input.toolsUpdate, nativeSearch);
	return [
		"<DEEPSEEK_WEB_INCREMENTAL_CONTEXT>",
		images,
		nativeSearch ? nativeSearchOverride() : "",
		input.systemUpdate ? buildSystemUpdate(input.systemUpdate) : "",
		toolsUpdate ? buildContractUpdate(toolsUpdate) : "",
		input.delta.map(formatMessage).join("\n\n"),
		"</DEEPSEEK_WEB_INCREMENTAL_CONTEXT>",
		nativeSearch ? "Continue the existing request. Keep thinking free of tool tags. Do not call web_search or web_fetch. If another local Harness operation is required, emit a new tool-call block in the answer channel. Otherwise answer normally." : "Continue the existing request. Keep thinking free of tool tags. If another local operation is required, emit a new tool-call block in the answer channel. Otherwise answer normally."
	].filter(Boolean).join("\n");
}
function wrapTag(tag, body) {
	return `<${tag}>\n${body}\n</${tag}>`;
}
function formatMessage(message) {
	if (message.toolResults && message.toolResults.length > 0) return buildExchange(message.toolCalls ?? [], message.toolResults);
	if (message.role === "assistant") return wrapTag("assistant", message.text);
	if (message.role === "system" || message.sourceKind === "plugin") return wrapTag("dsh_context", message.text);
	const userText = stripHarnessInjections(message.text);
	if (userText.length > 0) return wrapTag("user", userText);
	if ((message.text || "").trim().length === 0) return wrapTag("user", "[image attached]");
	return wrapTag("dsh_context", message.text);
}
const PLUGIN_PROMPT_MARKERS = [
	"<DEEPSEEK_WEB_INCREMENTAL_CONTEXT>",
	"<DEEPSEEK_WEB_AGENT_BOUNDARY>",
	"<DSH_CONVERSATION>",
	"<DSH_AGENT_INSTRUCTIONS>",
	"<DSH_LOCAL_TOOL_EXCHANGE",
	"<DSH_TOOL_PROTOCOL_REPAIR>",
	"<DSH_SYSTEM_UPDATE>",
	"<DSH_TOOL_CONTRACT_UPDATE>",
	"<DSH_LOCAL_TOOL_CONTRACT",
	"<user>"
];
const USER_HEAD = "USER:\n";
const USER_INLINE = "\nUSER:\n";
const INJECTION_STARTS = [
	"Current runtime context.",
	"Current runtime context:",
	"Current DSH file policy:",
	"Approval policy:",
	"<system-reminder>",
	"<available_skills>"
];
function innerBetween(text, open, close) {
	const start = text.indexOf(open);
	if (start < 0) return void 0;
	const from = start + open.length;
	const end = text.indexOf(close, from);
	return end < 0 ? text.slice(from) : text.slice(from, end);
}
function taggedPayloads(text, tag) {
	const open = `<${tag}>`;
	const close = `</${tag}>`;
	const payloads = [];
	let from = 0;
	while (from <= text.length) {
		const start = text.indexOf(open, from);
		if (start < 0) break;
		const inner = start + open.length;
		const end = text.indexOf(close, inner);
		const body = (end < 0 ? text.slice(inner) : text.slice(inner, end)).trim();
		if (body.length > 0) payloads.push(body);
		from = end < 0 ? text.length + 1 : end + close.length;
	}
	return payloads;
}
function injectionCut(text) {
	let cut = -1;
	const consider = (at) => {
		if (at < 0) return;
		if (cut < 0 || at < cut) cut = at;
	};
	for (const marker of INJECTION_STARTS) {
		if (text.startsWith(marker)) return 0;
		consider(text.indexOf(`\n${marker}`));
	}
	return cut;
}
/** Drop DSH runtime-context / skill catalog suffixes that ride on user-role turns. */
function stripHarnessInjections(text) {
	const cut = injectionCut(text);
	if (cut === 0) return "";
	if (cut < 0) return text.trim();
	return text.slice(0, cut).trim();
}
function payloadEnd(after) {
	const nextRole = after.search(/\n(?:USER|ASSISTANT|SYSTEM):\n/);
	const closeIncremental = after.indexOf("</DEEPSEEK_WEB_INCREMENTAL_CONTEXT>");
	const closeConversation = after.indexOf("</DSH_CONVERSATION>");
	let end = after.length;
	if (nextRole >= 0) end = Math.min(end, nextRole);
	if (closeIncremental >= 0) end = Math.min(end, closeIncremental);
	if (closeConversation >= 0) end = Math.min(end, closeConversation);
	return end;
}
function userPayloads(body) {
	const payloads = [];
	let from = 0;
	while (from <= body.length) {
		let at;
		if (from === 0 && body.startsWith(USER_HEAD)) at = 0;
		else {
			at = body.indexOf(USER_INLINE, from);
			if (at < 0) break;
		}
		const start = at === 0 && body.startsWith(USER_HEAD) ? 6 : at + 7;
		const after = body.slice(start);
		const relEnd = payloadEnd(after);
		const payload = after.slice(0, relEnd).trim();
		if (payload.length > 0) payloads.push(payload);
		from = start + Math.max(relEnd, 1);
	}
	return payloads;
}
function looksLikePluginPrompt(text) {
	return PLUGIN_PROMPT_MARKERS.some((marker) => text.includes(marker));
}
function cleanUserPayloads(payloads) {
	return payloads.map(stripHarnessInjections).filter((payload) => payload.length > 0).join("\n\n");
}
/**
* Remote Web history stores the plugin's prompt envelope as the user turn.
* Import keeps only `<user>` payloads (with a `USER:` fallback) and drops
* contracts, plugin context, search overrides, and trailing channel instructions.
*/
function extractImportedUserText(text) {
	const normalized = text.replaceAll("\r\n", "\n");
	const tagged = cleanUserPayloads(taggedPayloads(normalized, "user"));
	if (tagged.length > 0) return tagged;
	if (!looksLikePluginPrompt(normalized)) return stripHarnessInjections(normalized);
	return cleanUserPayloads(userPayloads(innerBetween(normalized, "<DSH_CONVERSATION>", "</DSH_CONVERSATION>") ?? innerBetween(normalized, "<DEEPSEEK_WEB_INCREMENTAL_CONTEXT>", "</DEEPSEEK_WEB_INCREMENTAL_CONTEXT>") ?? normalized));
}
//#endregion
//#region src/clean-turn.ts
const enabled = /* @__PURE__ */ new Set();
function isCleanMode(sessionId) {
	return sessionId !== void 0 && enabled.has(sessionId);
}
function setCleanMode(sessionId, on) {
	if (on) enabled.add(sessionId);
	else enabled.delete(sessionId);
}
//#endregion
//#region src/replay.ts
function wrapReplay(response) {
	return JSON.parse(JSON.stringify({ response }));
}
function readReplay(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const inner = value.response ?? value;
	if (typeof inner !== "object" || inner === null) return void 0;
	const replay = inner;
	if (replay.kind !== "deepseek-web" || replay.version !== 1) return void 0;
	if (typeof replay.affinity?.accountHash !== "string") return void 0;
	if (replay.affinity.model !== "default" && replay.affinity.model !== "expert") return void 0;
	if (typeof replay.remote?.chatSessionId !== "string") return void 0;
	if (typeof replay.remote.responseMessageId !== "string") return void 0;
	return replay;
}
function framed(parts) {
	return parts.map((part) => `${part.length}:${part}`).join("|");
}
function hashText(value) {
	return createHash("sha256").update(value).digest("hex");
}
function stableJson(value) {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}
function normalizeText(value) {
	return value.replaceAll("\r\n", "\n");
}
function historyPrefixHash(messages, upTo) {
	return hashText(framed(messages.slice(0, upTo).map(semanticFrame)));
}
/**
* EasyPhy-style projection: role + source.kind + semantic content.
* Message UUIDs and reasoning are omitted so a restored DSH session can keep
* the same remote session identifier across tool loops and process restarts.
*/
function semanticFrame(message) {
	const record = message;
	return framed([
		record.role ?? "",
		record.source?.kind ?? "",
		contentFrame(record.content)
	]);
}
function contentFrame(content) {
	if (typeof content === "string") return `text:${normalizeText(content)}`;
	if (!Array.isArray(content)) return `unknown:${stableJson(content ?? null)}`;
	return content.map((block) => {
		const record = block;
		if (record.type === "reasoning") return "";
		if (record.type === "text") return `text:${normalizeText(record.text ?? "")}`;
		if (record.type === "tool-call") return framed([
			"tool-call",
			record.id ?? "",
			record.name ?? "",
			record.arguments ?? ""
		]);
		if (record.type === "tool-result") return framed([
			"tool-result",
			record.id ?? "",
			String(record.isError ?? false),
			stableJson(record.content ?? "")
		]);
		if (record.type === "image") return `image:${record.attachment?.attachmentId ?? ""}`;
		return `${record.type ?? "block"}:${stableJson(record)}`;
	}).filter(Boolean).join(";");
}
function lastModelReplay(messages, provider) {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.role !== "assistant") continue;
		if (message.source?.kind !== "model") continue;
		if (message.source.provider !== provider) continue;
		const replay = readReplay(message.source.replayState);
		if (replay) return {
			index: i,
			replay
		};
	}
}
function createLiveCursor(input) {
	return {
		dshSessionId: input.sessionId,
		chatSessionId: input.chatSessionId,
		parentMessageId: input.parentMessageId,
		accountHash: input.accountHash,
		model: input.model,
		sentCount: input.messages.length,
		sentHash: historyPrefixHash(input.messages, input.messages.length),
		systemHash: input.systemHash,
		toolsHash: input.toolsHash,
		...input.sessionTitle === void 0 ? {} : { sessionTitle: input.sessionTitle }
	};
}
function deltaAfterBoundPrefix(messages, sentCount) {
	const rest = messages.slice(sentCount);
	const first = rest[0];
	if (first?.role === "assistant" && (first.source?.kind === "model" || first.source?.kind === void 0)) return rest.slice(1);
	return [...rest];
}
function continueFrom(input, cursor) {
	if (cursor.accountHash !== input.accountHash) return {
		kind: "rebuild",
		reason: "account-mismatch"
	};
	if (cursor.model !== input.model) return {
		kind: "rebuild",
		reason: "model-mismatch"
	};
	if ((cursor.dshSessionId ?? "") !== (input.sessionId ?? "")) return {
		kind: "rebuild",
		reason: "session-fork"
	};
	if (input.messages.length < cursor.prefixCount) return {
		kind: "rebuild",
		reason: "history-mismatch"
	};
	if (historyPrefixHash(input.messages, cursor.prefixCount) !== cursor.prefixHash) return {
		kind: "rebuild",
		reason: "history-mismatch"
	};
	const contractUpdate = cursor.toolsHash !== input.toolsHash || cursor.systemHash !== input.systemHash ? {
		system: cursor.systemHash === input.systemHash ? void 0 : "updated",
		tools: cursor.toolsHash !== input.toolsHash
	} : void 0;
	return {
		kind: "continue",
		chatSessionId: cursor.chatSessionId,
		parentMessageId: cursor.parentMessageId,
		deltaMessages: cursor.deltaMessages,
		contractUpdate
	};
}
function planConversation(input) {
	if (input.purpose === "compaction" || input.purpose === "session-title") return {
		kind: "one-shot",
		purpose: input.purpose
	};
	if (input.live && input.sessionId !== void 0 && input.live.dshSessionId === input.sessionId) return continueFrom(input, {
		dshSessionId: input.live.dshSessionId,
		accountHash: input.live.accountHash,
		model: input.live.model,
		chatSessionId: input.live.chatSessionId,
		parentMessageId: input.live.parentMessageId,
		prefixCount: input.live.sentCount,
		prefixHash: input.live.sentHash,
		systemHash: input.live.systemHash,
		toolsHash: input.live.toolsHash,
		deltaMessages: deltaAfterBoundPrefix(input.messages, input.live.sentCount)
	});
	const found = lastModelReplay(input.messages, input.provider);
	if (found === void 0) return {
		kind: "rebuild",
		reason: "no-replay"
	};
	const replay = found.replay;
	return continueFrom(input, {
		dshSessionId: replay.dshSessionId,
		accountHash: replay.affinity.accountHash,
		model: replay.affinity.model,
		chatSessionId: replay.remote.chatSessionId,
		parentMessageId: replay.remote.responseMessageId,
		prefixCount: found.index,
		prefixHash: replay.history.inputPrefixHash,
		systemHash: replay.contract.systemHash,
		toolsHash: replay.contract.toolsHash,
		deltaMessages: [...input.messages.slice(found.index + 1)]
	});
}
//#endregion
//#region src/adapter.ts
var AsyncMutex = class {
	chain = Promise.resolve();
	runExclusive(fn) {
		const run = this.chain.then(fn, fn);
		this.chain = run.then(() => void 0, () => void 0);
		return run;
	}
};
var SessionLockMap = class {
	locks = /* @__PURE__ */ new Map();
	async runExclusive(sessionId, signal, fn) {
		if (signal?.aborted) throw new LlmError("aborted", "TIMEOUT");
		const key = sessionId ?? "_none";
		let lock = this.locks.get(key);
		if (lock === void 0) {
			lock = new AsyncMutex();
			this.locks.set(key, lock);
		}
		try {
			return await lock.runExclusive(fn);
		} finally {}
	}
};
var ChunkQueue = class {
	items = [];
	waiter;
	done = false;
	error;
	push(chunk) {
		if (this.waiter !== void 0) {
			const waiter = this.waiter;
			this.waiter = void 0;
			waiter({
				value: chunk,
				done: false
			});
			return;
		}
		this.items.push(chunk);
	}
	close() {
		this.done = true;
		this.waiter?.({
			value: void 0,
			done: true
		});
		this.waiter = void 0;
	}
	fail(error) {
		this.error = error;
		this.done = true;
		this.waiter?.({
			value: void 0,
			done: true
		});
		this.waiter = void 0;
	}
	async *iterate() {
		while (true) {
			if (this.items.length > 0) {
				yield this.items.shift();
				continue;
			}
			if (this.error !== void 0) throw this.error;
			if (this.done) return;
			const result = await new Promise((resolve) => {
				this.waiter = resolve;
			});
			if (result.done) {
				if (this.error !== void 0) throw this.error;
				return;
			}
			yield result.value;
		}
	}
};
var StreamSink = class {
	emit;
	hasTools;
	nextIndex = 0;
	reasoningIndex;
	textIndex;
	reasoning = "";
	rawReasoning = "";
	reasoningFed = 0;
	rawText = "";
	fed = 0;
	visibleEmitted = false;
	receivedDelta = false;
	reasoningClosed = false;
	textClosed = false;
	searchClosed = false;
	gate = new CitationStreamGate();
	citations = [];
	constructor(emit, hasTools) {
		this.emit = emit;
		this.hasTools = hasTools;
	}
	get streamedVisible() {
		return this.visibleEmitted;
	}
	push(delta) {
		this.receivedDelta = true;
		this.citations = delta.citations;
		if (delta.reasoning.length > 0) {
			this.rawReasoning += delta.reasoning;
			const visibleReasoning = visibleTextBeforeToolProtocol(this.rawReasoning, this.hasTools);
			const unfedReasoning = visibleReasoning.slice(this.reasoningFed);
			this.reasoningFed = visibleReasoning.length;
			if (unfedReasoning.length > 0) {
				this.ensure("reasoning");
				this.reasoning += unfedReasoning;
				this.emit({
					type: "reasoning-delta",
					index: this.reasoningIndex,
					text: unfedReasoning
				});
			}
		}
		if (delta.text.length > 0) this.rawText += delta.text;
		const visiblePrefix = visibleTextBeforeToolProtocol(this.rawText, this.hasTools);
		const unfed = visiblePrefix.slice(this.fed);
		this.fed = visiblePrefix.length;
		const visible = this.gate.push(unfed, this.citations);
		if (visible.length === 0) return;
		this.maybeEmitSearchCard();
		this.ensure("text");
		this.visibleEmitted = true;
		this.emit({
			type: "text-delta",
			index: this.textIndex,
			text: visible
		});
	}
	flushTurn(turn) {
		this.citations = turn.citations;
		if (this.receivedDelta) return;
		this.push({
			reasoning: turn.reasoning,
			text: turn.text,
			citations: turn.citations
		});
	}
	resetBufferedText() {
		this.rawText = "";
		this.fed = 0;
		this.rawReasoning = this.reasoning;
		this.reasoningFed = this.reasoning.length;
		this.citations = [];
		this.gate = new CitationStreamGate();
	}
	finish(calls, replay) {
		this.maybeEmitSearchCard();
		if (calls.length > 0) {
			this.closeReasoning();
			this.closeText();
			for (const call of calls) {
				const argsJson = JSON.stringify(call.arguments);
				const index = this.nextIndex;
				this.nextIndex += 1;
				this.emit({
					type: "block-start",
					index,
					blockType: "tool-call"
				});
				this.emit({
					type: "tool-call-delta",
					index,
					id: call.id,
					name: call.name,
					argumentsDelta: argsJson
				});
				this.emit({
					type: "block-end",
					index,
					block: {
						type: "tool-call",
						id: call.id,
						name: call.name,
						arguments: argsJson
					}
				});
			}
			this.emit({
				type: "finish",
				reason: { kind: "tool-calls" },
				replayState: wrapReplay(replay)
			});
			return;
		}
		const flushed = this.gate.push("", this.citations, true);
		if (flushed.length > 0) {
			this.ensure("text");
			this.visibleEmitted = true;
			this.emit({
				type: "text-delta",
				index: this.textIndex,
				text: flushed
			});
		}
		this.closeReasoning();
		this.closeText();
		this.emit({
			type: "finish",
			reason: { kind: "stop" },
			replayState: wrapReplay(replay)
		});
	}
	maybeEmitSearchCard() {
		if (this.searchClosed || this.textIndex !== void 0) return;
		const markdown = formatSearchTimeline(this.citations);
		if (markdown.length === 0) return;
		this.searchClosed = true;
		this.closeReasoning();
		const index = this.nextIndex;
		this.nextIndex += 1;
		this.emit({
			type: "block-start",
			index,
			blockType: "text"
		});
		this.emit({
			type: "text-delta",
			index,
			text: markdown
		});
		this.emit({
			type: "block-end",
			index,
			block: {
				type: "text",
				text: markdown
			}
		});
	}
	ensure(kind) {
		if (kind === "reasoning") {
			if (this.reasoningIndex !== void 0 || this.reasoningClosed) return;
			this.reasoningIndex = this.nextIndex;
			this.nextIndex += 1;
			this.emit({
				type: "block-start",
				index: this.reasoningIndex,
				blockType: "reasoning"
			});
			return;
		}
		if (this.textIndex !== void 0) return;
		this.textIndex = this.nextIndex;
		this.nextIndex += 1;
		this.emit({
			type: "block-start",
			index: this.textIndex,
			blockType: "text"
		});
	}
	closeReasoning() {
		if (this.reasoningIndex === void 0 || this.reasoningClosed) return;
		this.reasoningClosed = true;
		this.emit({
			type: "block-end",
			index: this.reasoningIndex,
			block: {
				type: "reasoning",
				text: this.reasoning
			}
		});
	}
	closeText() {
		if (this.textIndex === void 0 || this.textClosed) return;
		this.textClosed = true;
		this.emit({
			type: "block-end",
			index: this.textIndex,
			block: {
				type: "text",
				text: this.gate.text
			}
		});
	}
};
var DeepSeekWebAdapter = class extends LlmAdapter {
	deps;
	locks = new SessionLockMap();
	accountCache = /* @__PURE__ */ new Map();
	remotes = /* @__PURE__ */ new Map();
	client;
	constructor(deps) {
		super();
		this.deps = deps;
		this.client = deps.client ?? new CompatDeepSeekWebClient();
	}
	clearAccountCache() {
		this.accountCache.clear();
		this.remotes.clear();
	}
	providerInfo(provider) {
		return {
			id: provider,
			name: "DeepSeek Web"
		};
	}
	async listModels(provider) {
		return [{
			provider,
			id: "default",
			name: "DeepSeek Web",
			inputModalities: ["text"]
		}, {
			provider,
			id: "expert",
			name: "DeepSeek Web Expert",
			inputModalities: ["text"]
		}];
	}
	async resolveModel(provider, model) {
		const models = await this.listModels(provider);
		return {
			...models.find((item) => item.id === model) ?? models[0],
			reasoning: deepThinkReasoning(this.deps.options().thinking !== "disabled")
		};
	}
	async *stream(options) {
		const config = this.deps.options();
		if (messageHasImage(options.messages)) throw new LlmError("DeepSeek Web does not support image understanding; ImageBlock is rejected", ERROR_CODES$1.UNSUPPORTED_IMAGE);
		const credential = await this.deps.resolveCredential();
		const powHeaderPromise = options.purpose === "session-title" ? Promise.resolve(void 0) : this.client.solveCompletionPow?.(credential, options.signal) ?? Promise.resolve(void 0);
		const account = await this.resolveAccount(credential, options.signal);
		const queue = new ChunkQueue();
		const running = (options.purpose === "compaction" || options.purpose === "session-title" ? this.oneShot(options, config, credential, account.hash, (chunk) => queue.push(chunk), powHeaderPromise) : this.locks.runExclusive(options.sessionId, options.signal, () => {
			return this.executeConversation(options, config, credential, account.hash, (chunk) => queue.push(chunk), powHeaderPromise);
		})).then(() => queue.close(), (error) => queue.fail(error));
		try {
			yield* queue.iterate();
		} finally {
			await running;
		}
	}
	async resolveAccount(credential, signal) {
		const cached = this.accountCache.get(credential);
		if (cached && Date.now() - cached.at < 6e5) return { hash: cached.hash };
		try {
			const account = await this.client.currentUser(credential, signal);
			this.accountCache.set(credential, {
				hash: account.accountHash,
				at: Date.now()
			});
			return { hash: account.accountHash };
		} catch (error) {
			this.accountCache.delete(credential);
			throw toLlm(error);
		}
	}
	async oneShot(options, config, credential, accountHash, emit, powHeaderPromise) {
		const sink = new StreamSink(emit, false);
		if (options.purpose === "session-title") {
			const live = options.sessionId === void 0 ? void 0 : this.remotes.get(options.sessionId);
			const title = resolveSessionTitle(live?.sessionTitle, options.messages);
			sink.push({
				reasoning: "",
				text: title,
				citations: []
			});
			sink.finish([], {
				kind: "deepseek-web",
				version: 1,
				dshSessionId: options.sessionId,
				affinity: {
					accountHash,
					model: modelOf$1(options.model)
				},
				remote: {
					chatSessionId: live?.chatSessionId ?? "local-title",
					responseMessageId: live?.parentMessageId ?? "0"
				},
				history: { inputPrefixHash: live?.sentHash ?? hashText("") },
				contract: {
					systemHash: live?.systemHash ?? hashText(options.system ?? ""),
					toolsHash: live?.toolsHash ?? hashText("[]"),
					thinking: false,
					nativeSearch: false
				}
			});
			return;
		}
		const session = await this.client.createSession(credential, options.signal);
		const prompt = flattenText(options.messages.at(-1)?.content) || "Summarize.";
		const remote = await this.completeChecked({
			credential,
			chatSessionId: session.chatSessionId,
			prompt,
			modelType: modelOf$1(options.model),
			thinkingEnabled: false,
			searchEnabled: false,
			signal: options.signal,
			onDelta: (delta) => sink.push(delta),
			powHeader: await powHeaderPromise
		});
		sink.flushTurn(remote);
		sink.finish([], this.accept(remote, options, config, accountHash, session.chatSessionId, false, hashText(options.system ?? ""), hashText("[]"), false).replay);
	}
	async executeConversation(options, config, credential, accountHash, emit, powHeaderPromise) {
		const model = modelOf$1(options.model);
		const clean = isCleanMode(options.sessionId);
		const cleanText = lastHumanUserText(options.messages);
		const nativeSearch = nativeSearchActive(config, model);
		const tools = clean ? [] : toBridgeTools(options.tools ?? []);
		const promptTools = filterToolsForNativeSearch(tools, nativeSearch);
		const sink = new StreamSink(emit, promptTools.length > 0);
		const systemHash = hashText(clean ? "" : options.system ?? "");
		const toolsHash = hashText(clean ? "[]" : JSON.stringify(tools));
		const live = options.sessionId === void 0 ? void 0 : this.remotes.get(options.sessionId);
		const plan = planConversation({
			messages: options.messages,
			sessionId: options.sessionId,
			accountHash,
			model,
			provider: PROVIDER,
			systemHash,
			toolsHash,
			live
		});
		let chatSessionId;
		let parentMessageId;
		let prompt;
		let rebuilt = false;
		if (plan.kind === "continue") {
			chatSessionId = plan.chatSessionId;
			parentMessageId = plan.parentMessageId;
			prompt = clean ? cleanText : buildIncrementalPrompt({
				toolsUpdate: plan.contractUpdate?.tools ? tools : void 0,
				systemUpdate: plan.contractUpdate?.system ? options.system : void 0,
				delta: toPromptMessages(plan.deltaMessages, config.maxToolResultBytes),
				nativeSearch
			});
		} else {
			if (options.sessionId !== void 0) this.remotes.delete(options.sessionId);
			chatSessionId = (await this.client.createSession(credential, options.signal)).chatSessionId;
			prompt = clean ? cleanText : buildFullPrompt({
				system: options.system,
				messages: toPromptMessages(options.messages, config.maxToolResultBytes),
				tools,
				maxCalls: config.maxToolCallsPerTurn,
				nativeSearch
			});
			rebuilt = plan.kind === "rebuild";
		}
		try {
			const remote = await this.completeWithRepair({
				credential,
				chatSessionId,
				parentMessageId,
				prompt,
				modelType: model,
				thinkingEnabled: thinkingEnabled(options, config),
				searchEnabled: nativeSearch,
				signal: options.signal,
				tools: promptTools.map((tool) => tool.name),
				nativeSearch,
				config,
				sink,
				powHeader: await powHeaderPromise
			});
			sink.flushTurn(remote.turn);
			sink.finish(remote.calls, this.accept(remote.turn, options, config, accountHash, chatSessionId, remote.calls, systemHash, toolsHash).replay);
		} catch (error) {
			if (rebuilt) throw toLlm(error);
			if (error instanceof DeepSeekWebError && (error.code === ERROR_CODES$1.REMOTE_SESSION || error.code === ERROR_CODES$1.PROTOCOL)) {
				if (options.sessionId !== void 0) this.remotes.delete(options.sessionId);
				const session = await this.client.createSession(credential, options.signal);
				const remote = await this.completeWithRepair({
					credential,
					chatSessionId: session.chatSessionId,
					prompt: clean ? cleanText : buildFullPrompt({
						system: options.system,
						messages: toPromptMessages(options.messages, config.maxToolResultBytes),
						tools,
						maxCalls: config.maxToolCallsPerTurn,
						nativeSearch
					}),
					modelType: model,
					thinkingEnabled: thinkingEnabled(options, config),
					searchEnabled: nativeSearch,
					signal: options.signal,
					tools: promptTools.map((tool) => tool.name),
					nativeSearch,
					config,
					sink
				});
				sink.flushTurn(remote.turn);
				sink.finish(remote.calls, this.accept(remote.turn, options, config, accountHash, session.chatSessionId, remote.calls, systemHash, toolsHash).replay);
				return;
			}
			throw toLlm(error);
		}
	}
	async completeChecked(request) {
		try {
			return await this.client.complete(request);
		} catch (error) {
			throw toLlm(error);
		}
	}
	async completeWithRepair(input) {
		let parent = input.parentMessageId;
		let prompt = input.prompt;
		let powHeader = input.powHeader;
		for (let attempt = 0; attempt <= input.config.maxProtocolRepairAttempts; attempt++) {
			const turn = await this.completeChecked({
				credential: input.credential,
				chatSessionId: input.chatSessionId,
				parentMessageId: parent,
				prompt,
				modelType: input.modelType,
				thinkingEnabled: input.thinkingEnabled,
				searchEnabled: input.searchEnabled,
				signal: input.signal,
				onDelta: (delta) => input.sink.push(delta),
				powHeader
			});
			powHeader = void 0;
			const parsed = resolveToolProtocol({
				text: turn.text,
				reasoning: turn.reasoning
			}, input.tools, {
				maxBytes: input.config.maxToolProtocolBytes,
				maxCalls: input.config.maxToolCallsPerTurn,
				responseMessageId: turn.responseMessageId
			});
			if (parsed.kind === "calls") return {
				turn: {
					...turn,
					text: ""
				},
				calls: parsed.calls
			};
			if (parsed.kind === "none") {
				const promisedSource = turn.text.trim().length > 0 ? turn.text : turn.reasoning;
				if (!input.sink.streamedVisible && input.tools.length > 0 && promisedToolContinuation(promisedSource, input.nativeSearch) && attempt < input.config.maxProtocolRepairAttempts) {
					input.sink.resetBufferedText();
					parent = turn.responseMessageId;
					prompt = promisedContinuationPrompt(input.nativeSearch);
					continue;
				}
				return {
					turn,
					calls: []
				};
			}
			if (input.sink.streamedVisible) return {
				turn,
				calls: []
			};
			input.sink.resetBufferedText();
			parent = turn.responseMessageId;
			prompt = repairPrompt(parsed.reason, input.nativeSearch);
		}
		throw new LlmError("DeepSeek Web tool protocol remained invalid", ERROR_CODES$1.TOOL_PROTOCOL);
	}
	accept(turn, options, config, accountHash, chatSessionId, calls, systemHash, toolsHash, bindSession = true) {
		const parsedCalls = Array.isArray(calls) ? calls : [];
		const text = rewriteCitationMarkers(turn.text, turn.citations);
		const model = modelOf$1(options.model);
		const replay = {
			kind: "deepseek-web",
			version: 1,
			dshSessionId: options.sessionId,
			affinity: {
				accountHash,
				model
			},
			remote: {
				chatSessionId,
				responseMessageId: turn.responseMessageId
			},
			history: { inputPrefixHash: historyPrefixHash(options.messages, options.messages.length) },
			contract: {
				systemHash,
				toolsHash,
				thinking: thinkingEnabled(options, config),
				nativeSearch: nativeSearchActive(config, model)
			},
			...turn.citations.length > 0 ? { provider: { citations: turn.citations } } : {}
		};
		if (bindSession && options.sessionId !== void 0) this.remotes.set(options.sessionId, createLiveCursor({
			sessionId: options.sessionId,
			chatSessionId,
			parentMessageId: turn.responseMessageId,
			accountHash,
			model,
			messages: options.messages,
			systemHash,
			toolsHash,
			sessionTitle: turn.sessionTitle ?? (options.sessionId === void 0 ? void 0 : this.remotes.get(options.sessionId)?.sessionTitle)
		}));
		return {
			reasoning: turn.reasoning,
			text,
			calls: parsedCalls,
			replay
		};
	}
};
const OFF_DEEPTHINK = ReasoningEffortId("off");
const ON_DEEPTHINK = ReasoningEffortId("on");
/** chat.deepseek.com DeepThink is always available; plugin config only sets the default. */
function deepThinkReasoning(enabled) {
	return {
		efforts: [{
			id: OFF_DEEPTHINK,
			name: "Off"
		}, {
			id: ON_DEEPTHINK,
			name: "DeepThink"
		}],
		defaultEffort: enabled ? ON_DEEPTHINK : OFF_DEEPTHINK
	};
}
function thinkingEnabled(options, config) {
	if (config.thinking === "disabled") return false;
	const effort = options.reasoningEffort;
	if (effort === void 0) return true;
	if (effort === OFF_DEEPTHINK || effort === "none") return false;
	return true;
}
function modelOf$1(model) {
	return model === "expert" ? "expert" : "default";
}
function toLlm(error) {
	if (error instanceof LlmError) return error;
	if (error instanceof DeepSeekWebError) return new LlmError(error.message, error.code);
	return new LlmError(error instanceof Error ? error.message : String(error), ERROR_CODES$1.HTTP);
}
function lastHumanUserText(messages) {
	for (let index = messages.length - 1; index >= 0; index--) {
		const record = messages[index];
		if (record.role !== "user") continue;
		if (record.source?.kind === "tool" || record.source?.kind === "plugin") continue;
		const text = extractImportedUserText(flattenText(record.content)).replace(/^USER:\n/, "").trim();
		if (text.length > 0) return text;
	}
	return "";
}
function toPromptMessages(messages, maxToolResultBytes) {
	const out = [];
	for (const message of messages) {
		const result = toolResultFromMessage(message);
		if (result) {
			out.push({
				role: "tool",
				sourceKind: "tool",
				text: "",
				toolResults: [projectToolResult(result.id, result.content, result.isError, maxToolResultBytes)]
			});
			continue;
		}
		const record = message;
		const calls = toolCallBlocks(record.content).map((call) => ({
			id: call.id,
			name: call.name,
			arguments: JSON.parse(call.arguments || "{}")
		}));
		out.push({
			role: record.role ?? "user",
			sourceKind: record.source?.kind,
			text: flattenText(record.content),
			toolCalls: calls.length > 0 ? calls : void 0
		});
	}
	return out;
}
//#endregion
//#region src/auth-routes.ts
const AUTH_STATUS_PATH = "/plugins/dsh-deepseek-web-free/auth/status";
const AUTH_LOGIN_PATH = "/plugins/dsh-deepseek-web-free/auth/login";
const AUTH_CANCEL_PATH = "/plugins/dsh-deepseek-web-free/auth/cancel";
const AUTH_LOGOUT_PATH = "/plugins/dsh-deepseek-web-free/auth/logout";
const ACCOUNT_PATH = "/plugins/dsh-deepseek-web-free/account";
const DOCTOR_PATH = "/plugins/dsh-deepseek-web-free/doctor";
function write$1(res, status, body) {
	const json = JSON.stringify(body);
	const headers = pluginResponseHeaders();
	for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
	res.statusCode = status;
	res.end(json);
}
function forbidden$1(res) {
	write$1(res, 403, { error: "forbidden" });
}
async function readBody$1(req, limit = 4096) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		total += chunk.length;
		if (total > limit) throw new Error("body too large");
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf8");
}
function registerAuthRoutes(webServer, service) {
	const handler = (method, fn) => async (req, res) => {
		if (req.method !== method) {
			write$1(res, 405, { error: "method not allowed" });
			return;
		}
		if (!trustedPluginRequest(req)) {
			forbidden$1(res);
			return;
		}
		try {
			await fn(req, res);
		} catch (error) {
			write$1(res, 500, { error: redactSensitiveText(error instanceof Error ? error.message : String(error)) });
		}
	};
	const disposers = [
		webServer.register({
			kind: "exact",
			path: AUTH_STATUS_PATH,
			handler: handler("GET", async (_req, res) => write$1(res, 200, await service.status()))
		}),
		webServer.register({
			kind: "exact",
			path: AUTH_LOGIN_PATH,
			handler: handler("POST", async (req, res) => {
				const raw = await readBody$1(req);
				const body = raw.length > 0 ? JSON.parse(raw) : {};
				service.login({ resetProfile: body.resetProfile === true }).catch(() => void 0);
				write$1(res, 200, await service.status());
			})
		}),
		webServer.register({
			kind: "exact",
			path: AUTH_CANCEL_PATH,
			handler: handler("POST", async (req, res) => {
				await readBody$1(req);
				await service.cancel();
				write$1(res, 200, { ok: true });
			})
		}),
		webServer.register({
			kind: "exact",
			path: AUTH_LOGOUT_PATH,
			handler: handler("POST", async (req, res) => {
				const raw = await readBody$1(req);
				const body = raw.length > 0 ? JSON.parse(raw) : {};
				await service.logout(body.clearProfile !== false);
				write$1(res, 200, { ok: true });
			})
		}),
		webServer.register({
			kind: "exact",
			path: ACCOUNT_PATH,
			handler: handler("GET", async (_req, res) => {
				const status = await service.status();
				write$1(res, 200, status.status === "signed-in" ? {
					account: status.account,
					browser: status.browser
				} : { status: status.status });
			})
		}),
		webServer.register({
			kind: "exact",
			path: DOCTOR_PATH,
			handler: handler("GET", async (_req, res) => write$1(res, 200, await service.doctor()))
		})
	];
	return () => {
		for (const dispose of disposers) dispose();
	};
}
//#endregion
//#region src/dsh-session.ts
/**
* Newest `agent-preset/selected` wins; otherwise the creation header. Matches
* Harness `resolveSessionPreset` so a fork/resume rebuilds the same agent.
*/
function resolveSessionPreset(session) {
	for (let index = session.events.length - 1; index >= 0; index--) {
		const event = session.events[index];
		if (event?.type !== "agent-preset/selected") continue;
		const id = event.data.agentPreset;
		if (typeof id === "string" && id.length > 0) return id;
	}
	const fromHeader = session.header?.agentPreset ?? session.meta?.agentPreset;
	return typeof fromHeader === "string" && fromHeader.length > 0 ? fromHeader : void 0;
}
var PluginSessionError = class extends Error {
	code;
	constructor(message, code) {
		super(message);
		this.name = "PluginSessionError";
		this.code = code;
	}
};
//#endregion
//#region src/errors.ts
const ERROR_CODES = {
	...ERROR_CODES$1,
	REMOTE_SESSION_LIST_FAILED: "DEEPSEEK_WEB_REMOTE_SESSION_LIST_FAILED",
	REMOTE_SESSION_HISTORY_FAILED: "DEEPSEEK_WEB_REMOTE_SESSION_HISTORY_FAILED",
	REMOTE_SESSION_NOT_FOUND: "DEEPSEEK_WEB_REMOTE_SESSION_NOT_FOUND",
	MIRROR_MATERIALIZE_FAILED: "DEEPSEEK_WEB_MIRROR_MATERIALIZE_FAILED",
	MIRROR_ALREADY_CONFLICTED: "DEEPSEEK_WEB_MIRROR_ALREADY_CONFLICTED",
	MIRROR_UNAVAILABLE: "DEEPSEEK_WEB_MIRROR_UNAVAILABLE",
	FORK_SOURCE_NOT_FOUND: "DEEPSEEK_WEB_FORK_SOURCE_NOT_FOUND",
	FORK_MESSAGE_NOT_FOUND: "DEEPSEEK_WEB_FORK_MESSAGE_NOT_FOUND",
	FORK_MESSAGE_NOT_DEEPSEEK_WEB: "DEEPSEEK_WEB_FORK_MESSAGE_NOT_DEEPSEEK_WEB",
	FORK_OPEN_TURN: "DEEPSEEK_WEB_FORK_OPEN_TURN",
	FORK_WORKSPACE_NOT_FOUND: "DEEPSEEK_WEB_FORK_WORKSPACE_NOT_FOUND",
	FORK_WORKSPACE_ATTACH_FAILED: "DEEPSEEK_WEB_FORK_WORKSPACE_ATTACH_FAILED",
	FORK_INCOMPATIBLE_SESSION: "DEEPSEEK_WEB_FORK_INCOMPATIBLE_SESSION"
};
//#endregion
//#region src/session-routes.ts
const SESSIONS_PATH = "/plugins/dsh-deepseek-web-free/sessions";
const FORK_PATH = "/plugins/dsh-deepseek-web-free/fork";
const MAX_SESSION_ID = 128;
const MAX_CURSOR = 512;
const MAX_BODY = 4096;
function write(res, status, body) {
	const json = JSON.stringify(body);
	const headers = pluginResponseHeaders();
	for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
	res.statusCode = status;
	res.end(json);
}
function forbidden(res) {
	write(res, 403, { error: "forbidden" });
}
async function readBody(req, limit = MAX_BODY) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		total += chunk.length;
		if (total > limit) throw new PluginSessionError("body too large", ERROR_CODES.PROTOCOL);
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf8");
}
function parseJsonObject(raw) {
	if (raw.length === 0) return {};
	try {
		const value = JSON.parse(raw);
		if (typeof value !== "object" || value === null || Array.isArray(value)) throw new PluginSessionError("invalid json", ERROR_CODES.PROTOCOL);
		return value;
	} catch (error) {
		if (error instanceof PluginSessionError) throw error;
		throw new PluginSessionError("invalid json", ERROR_CODES.PROTOCOL);
	}
}
function requestUrl(req) {
	return new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
}
function boundId(value, label) {
	const trimmed = decodeURIComponent(value).trim();
	if (trimmed.length === 0 || trimmed.length > MAX_SESSION_ID) throw new PluginSessionError(`invalid ${label}`, ERROR_CODES.PROTOCOL);
	return trimmed;
}
function statusFor(code) {
	if (code === ERROR_CODES.MISSING_CREDENTIAL || code === ERROR_CODES.REAUTH_REQUIRED) return 401;
	if (code === ERROR_CODES.REMOTE_SESSION_NOT_FOUND || code === ERROR_CODES.FORK_SOURCE_NOT_FOUND || code === ERROR_CODES.FORK_MESSAGE_NOT_FOUND || code === ERROR_CODES.FORK_WORKSPACE_NOT_FOUND) return 404;
	if (code === ERROR_CODES.FORK_MESSAGE_NOT_DEEPSEEK_WEB || code === ERROR_CODES.FORK_OPEN_TURN || code === ERROR_CODES.FORK_INCOMPATIBLE_SESSION || code === ERROR_CODES.MIRROR_ALREADY_CONFLICTED) return 409;
	if (code === ERROR_CODES.PROTOCOL || code === ERROR_CODES.REMOTE_HISTORY_INVALID || code === ERROR_CODES.REMOTE_HISTORY_INCOMPLETE) return 400;
	return 500;
}
function fail(res, error) {
	const code = error instanceof PluginSessionError ? error.code : ERROR_CODES.HTTP;
	const message = redactSensitiveText(error instanceof Error ? error.message : String(error));
	write(res, statusFor(code), {
		error: message,
		code
	});
}
function abortFrom(req) {
	const controller = new AbortController();
	if (typeof req.once === "function") req.once("close", () => controller.abort());
	return controller;
}
function registerSessionRoutes(webServer, service) {
	const wrap = (mutating, fn) => async (req, res) => {
		if (!trustedPluginRequest(req)) {
			forbidden(res);
			return;
		}
		const controller = mutating ? void 0 : abortFrom(req);
		try {
			await fn(req, res, controller?.signal);
		} catch (error) {
			if (controller?.signal.aborted) return;
			fail(res, error);
		}
	};
	const dispatchSessions = async (req, res, signal) => {
		const url = requestUrl(req);
		const rest = url.pathname.slice(SESSIONS_PATH.length);
		if (req.method === "GET" && (rest === "" || rest === "/")) {
			const cursor = url.searchParams.get("cursor") ?? void 0;
			if (cursor !== void 0 && cursor.length > MAX_CURSOR) throw new PluginSessionError("invalid cursor", ERROR_CODES.PROTOCOL);
			const limitRaw = url.searchParams.get("limit");
			const limit = limitRaw === null ? void 0 : Number(limitRaw);
			if (limit !== void 0 && (!Number.isInteger(limit) || limit < 1)) throw new PluginSessionError("invalid limit", ERROR_CODES.PROTOCOL);
			write(res, 200, await service.listSessions({
				cursor,
				limit,
				refresh: url.searchParams.get("refresh") === "1",
				signal
			}));
			return;
		}
		const history = rest.match(/^\/([^/]+)\/history$/);
		if (req.method === "GET" && history) {
			write(res, 200, await service.fetchHistory(boundId(history[1], "session id"), {
				refresh: url.searchParams.get("refresh") === "1",
				signal
			}));
			return;
		}
		const materialize = rest.match(/^\/([^/]+)\/materialize$/);
		if (req.method === "POST" && materialize) {
			const id = boundId(materialize[1], "session id");
			await readBody(req);
			write(res, 200, await service.materialize(id));
			return;
		}
		if (req.method === "GET" || req.method === "POST") {
			write(res, 404, {
				error: "not found",
				code: ERROR_CODES.PROTOCOL
			});
			return;
		}
		write(res, 405, { error: "method not allowed" });
	};
	const sessions = async (req, res) => {
		await wrap(req.method !== "GET", dispatchSessions)(req, res);
	};
	const fork = wrap(true, async (req, res) => {
		if (req.method !== "POST") {
			write(res, 405, { error: "method not allowed" });
			return;
		}
		const body = parseJsonObject(await readBody(req));
		if (typeof body.sourceSessionId !== "string" || typeof body.messageId !== "string" || typeof body.workspaceId !== "string") throw new PluginSessionError("invalid fork request", ERROR_CODES.PROTOCOL);
		write(res, 200, await service.fork({
			sourceSessionId: boundId(body.sourceSessionId, "session id"),
			messageId: boundId(body.messageId, "message id"),
			workspaceId: boundId(body.workspaceId, "workspace id")
		}));
	});
	const disposers = [webServer.register({
		kind: "prefix",
		path: SESSIONS_PATH,
		handler: sessions
	}), webServer.register({
		kind: "exact",
		path: FORK_PATH,
		handler: fork
	})];
	return () => {
		for (const dispose of disposers) dispose();
	};
}
//#endregion
//#region src/remote-session-cache.ts
const LIST_CACHE_TTL_MS = 15e3;
const HISTORY_CACHE_TTL_MS = 3e4;
var RemoteSessionCache = class {
	lists = /* @__PURE__ */ new Map();
	histories = /* @__PURE__ */ new Map();
	mirrors = /* @__PURE__ */ new Map();
	listFlights = /* @__PURE__ */ new Map();
	historyFlights = /* @__PURE__ */ new Map();
	materializeFlights = /* @__PURE__ */ new Map();
	forkFlights = /* @__PURE__ */ new Map();
	clear() {
		this.lists.clear();
		this.histories.clear();
		this.mirrors.clear();
		this.listFlights.clear();
		this.historyFlights.clear();
		this.materializeFlights.clear();
		this.forkFlights.clear();
	}
	listKey(accountHash) {
		return accountHash;
	}
	historyKey(accountHash, chatSessionId) {
		return `${accountHash}:${chatSessionId}`;
	}
	mirrorKey(accountHash, chatSessionId) {
		return this.historyKey(accountHash, chatSessionId);
	}
	forkKey(sourceSessionId, messageId, workspaceId) {
		return `${sourceSessionId}:${messageId}:${workspaceId}`;
	}
	getList(accountHash, now = Date.now()) {
		return this.read(this.lists, this.listKey(accountHash), now);
	}
	setList(accountHash, value, now = Date.now()) {
		this.lists.set(this.listKey(accountHash), {
			value,
			expiresAt: now + LIST_CACHE_TTL_MS
		});
	}
	invalidateList(accountHash) {
		this.lists.delete(this.listKey(accountHash));
	}
	getHistory(accountHash, chatSessionId, now = Date.now()) {
		return this.read(this.histories, this.historyKey(accountHash, chatSessionId), now);
	}
	setHistory(accountHash, chatSessionId, value, now = Date.now()) {
		this.histories.set(this.historyKey(accountHash, chatSessionId), {
			value,
			expiresAt: now + HISTORY_CACHE_TTL_MS
		});
	}
	invalidateHistory(accountHash, chatSessionId) {
		this.histories.delete(this.historyKey(accountHash, chatSessionId));
	}
	getMirror(accountHash, chatSessionId) {
		return this.mirrors.get(this.mirrorKey(accountHash, chatSessionId));
	}
	setMirror(accountHash, chatSessionId, sessionId) {
		this.mirrors.set(this.mirrorKey(accountHash, chatSessionId), sessionId);
	}
	rememberFork(key, childId) {
		this.mirrors.set(`fork:${key}`, childId);
	}
	getFork(key) {
		return this.mirrors.get(`fork:${key}`);
	}
	singleFlight(bucket, key, run) {
		const flights = this.flightMap(bucket);
		const existing = flights.get(key);
		if (existing !== void 0) return existing;
		const pending = run().finally(() => {
			if (flights.get(key) === pending) flights.delete(key);
		});
		flights.set(key, pending);
		return pending;
	}
	flightMap(bucket) {
		if (bucket === "list") return this.listFlights;
		if (bucket === "history") return this.historyFlights;
		if (bucket === "materialize") return this.materializeFlights;
		return this.forkFlights;
	}
	read(store, key, now) {
		const hit = store.get(key);
		if (hit === void 0) return void 0;
		if (hit.expiresAt <= now) {
			store.delete(key);
			return;
		}
		return hit.value;
	}
};
//#endregion
//#region src/session-materializer.ts
const CONSERVATIVE_SYSTEM_HASH = hashText("");
const CONSERVATIVE_TOOLS_HASH = hashText("[]");
const MAX_INSPECT_CANDIDATES = 256;
const MAX_TITLE_BYTES = 80;
function pairRemoteTurns(messages) {
	const turns = [];
	let users = [];
	for (const message of messages) {
		if (message.role === "user") {
			users.push(message);
			continue;
		}
		if (message.role !== "assistant" || message.responseMessageId === void 0 || message.responseMessageId.length === 0) throw new PluginSessionError("remote assistant is missing a continuation id", ERROR_CODES.REMOTE_HISTORY_INVALID);
		turns.push({
			users,
			assistant: message
		});
		users = [];
	}
	return turns;
}
function projectCanonicalMessage(message) {
	const text = message.role === "assistant" ? rewriteCitationMarkers(message.text, message.citations ?? []) : extractImportedUserText(message.text);
	const content = [];
	if (message.role === "assistant" && message.reasoning !== void 0 && message.reasoning.length > 0) content.push({
		type: "reasoning",
		text: message.reasoning
	});
	if (message.role === "assistant") {
		const search = formatSearchTimeline(message.citations ?? []);
		if (search.length > 0) content.push({
			type: "text",
			text: search
		});
	}
	content.push({
		type: "text",
		text
	});
	return {
		role: message.role,
		source: { kind: message.role === "user" ? "user" : "model" },
		content
	};
}
function modelOf(message, fallback) {
	if (message.modelType === "expert" || fallback === "expert") return "expert";
	return "default";
}
function buildRemoteSessionSeed(input) {
	const turns = pairRemoteTurns(input.remote.messages);
	const events = [];
	const messages = [...input.prefixMessages ?? []];
	let seq = input.startSeq ?? 0;
	let loggedHeader = input.headerAlreadyLogged === true;
	let lastModel = input.lastModel;
	const now = eventTime(input.now, Date.now());
	const startTurn = input.startTurn ?? 1;
	const push = (type, data, extra) => {
		const event = {
			type,
			seq,
			time: eventTime(extra?.time, now + seq),
			data,
			...extra?.surfaceOp === void 0 ? {} : { surfaceOp: extra.surfaceOp }
		};
		seq += 1;
		events.push(event);
		return event;
	};
	const remoteTitle = truncateTitle(input.remote.session.title);
	if (startTurn === 1 && remoteTitle !== void 0) push("session/title", {
		title: remoteTitle,
		messageSeqs: [],
		source: { kind: "user" }
	}, { time: now });
	for (let index = 0; index < turns.length; index++) {
		const turn = turns[index];
		const turnNumber = startTurn + index;
		const model = modelOf(turn.assistant, input.remote.session.modelType);
		const stamp = eventTime(turn.assistant.createdAt ?? turn.users[0]?.createdAt, now + seq);
		push("turn/start", { turn: turnNumber }, { time: stamp });
		push("step/start", {
			turn: turnNumber,
			step: 1
		}, { time: stamp });
		for (const user of turn.users) {
			const projected = projectCanonicalMessage(user);
			const userMessage = createUserMessage({
				content: projected.content,
				source: { kind: "user" }
			});
			messages.push(userMessage);
			push("user/message", userMessage, {
				surfaceOp: "append",
				time: user.createdAt ?? stamp
			});
		}
		let reason = "resume";
		if (!loggedHeader) reason = "initial";
		else if (lastModel !== void 0 && lastModel !== model) reason = "change";
		loggedHeader = true;
		lastModel = model;
		push("request/header", {
			header: { config: {
				provider: PROVIDER,
				model
			} },
			reason
		}, { time: stamp });
		const projectedAssistant = projectCanonicalMessage(turn.assistant);
		const prefixHash = historyPrefixHash(messages, messages.length);
		const thinking = turn.assistant.thinkingEnabled ?? true;
		const nativeSearch = turn.assistant.searchEnabled ?? false;
		const replay = {
			kind: "deepseek-web",
			version: 1,
			dshSessionId: input.sessionId,
			affinity: {
				accountHash: input.accountHash,
				model
			},
			remote: {
				chatSessionId: input.remote.session.chatSessionId,
				responseMessageId: turn.assistant.responseMessageId
			},
			history: { inputPrefixHash: prefixHash },
			contract: {
				systemHash: CONSERVATIVE_SYSTEM_HASH,
				toolsHash: CONSERVATIVE_TOOLS_HASH,
				thinking,
				nativeSearch
			},
			...turn.assistant.citations !== void 0 && turn.assistant.citations.length > 0 ? { provider: { citations: turn.assistant.citations } } : {}
		};
		const assistantMessage = createAssistantMessage({
			content: projectedAssistant.content,
			source: {
				provider: PROVIDER,
				model,
				replayState: wrapReplay(replay)
			}
		});
		messages.push(assistantMessage);
		push("assistant/message", {
			turn: turnNumber,
			step: 1,
			message: assistantMessage
		}, {
			surfaceOp: "append",
			time: stamp
		});
		push("step/end", {
			turn: turnNumber,
			step: 1
		}, { time: stamp });
		push("turn/end", {
			turn: turnNumber,
			reason: { kind: "completed" }
		}, { time: stamp });
	}
	return {
		events,
		messages
	};
}
function derivedMessagesFromEvents(events) {
	const messages = [];
	for (const event of events) {
		if (event.type === "user/message") messages.push(event.data);
		if (event.type === "assistant/message") {
			const data = event.data;
			if (data.message !== void 0) messages.push(data.message);
		}
	}
	return messages;
}
function remoteFingerprint(messages) {
	return pairRemoteTurns(messages).map((turn) => {
		return `${turn.users.map((user) => `U:${extractImportedUserText(user.text)}`).join("+")}|A:${turn.assistant.responseMessageId}:${turn.assistant.text}`;
	}).join("\n");
}
function localFingerprint(messages) {
	const lines = [];
	let users = [];
	for (const message of messages) {
		const record = message;
		const text = record.role === "user" ? extractImportedUserText(textOf(record.content)) : textOf(record.content);
		if (record.role === "user") {
			users.push(`U:${text}`);
			continue;
		}
		if (record.role !== "assistant") continue;
		const replay = readReplay(record.source?.replayState);
		lines.push(`${users.join("+")}|A:${replay?.remote.responseMessageId ?? ""}:${text}`);
		users = [];
	}
	return lines.join("\n");
}
function textOf(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((block) => {
		const record = block;
		return record.type === "text" ? record.text ?? "" : "";
	}).join("");
}
function replayFromEvents(events) {
	for (let index = events.length - 1; index >= 0; index--) {
		const event = events[index];
		if (event?.type !== "assistant/message") continue;
		const message = event.data.message;
		const replay = readReplay(message?.source?.replayState);
		if (replay) return replay;
	}
}
function sameDir(left, right) {
	if (left === right) return true;
	const normalize = (value) => value.replace(/[\\/]+$/, "").replaceAll("\\", "/");
	const a = normalize(left);
	const b = normalize(right);
	return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}
function isReusableMirrorHeader(header, mirrorCwd, cwdAliases = []) {
	if (header.origin === "subagent" || header.parentSession !== void 0) return false;
	if (mirrorCwd === void 0 || mirrorCwd.length === 0) return header.cwd === void 0;
	if (header.cwd === void 0 || header.cwd.length === 0) return false;
	if (sameDir(header.cwd, mirrorCwd)) return true;
	return cwdAliases.some((alias) => alias.length > 0 && sameDir(header.cwd, alias));
}
async function findExistingMirror(persistence, accountHash, chatSessionId, cachedId, mirrorCwd, excludeIds = /* @__PURE__ */ new Set(), cwdAliases = []) {
	if (cachedId !== void 0 && !excludeIds.has(cachedId)) try {
		const inspected = await persistence.inspect(cachedId);
		if (isReusableMirrorHeader(inspected.meta, mirrorCwd, cwdAliases) && mirrorReplayMatches(inspected, accountHash, chatSessionId)) return inspected.meta.id;
	} catch {}
	const candidates = (await persistence.list()).filter((header) => !excludeIds.has(header.id) && isReusableMirrorHeader(header, mirrorCwd, cwdAliases)).sort((left, right) => right.createdAt - left.createdAt).slice(0, MAX_INSPECT_CANDIDATES);
	for (const header of candidates) try {
		const inspected = await persistence.inspect(header.id);
		if (mirrorReplayMatches(inspected, accountHash, chatSessionId)) return inspected.meta.id;
	} catch {
		continue;
	}
}
function mirrorReplayMatches(inspected, accountHash, chatSessionId) {
	const replay = replayFromEvents(inspected.events);
	return replay?.kind === "deepseek-web" && replay.affinity.accountHash === accountHash && replay.remote.chatSessionId === chatSessionId && (replay.dshSessionId === void 0 || replay.dshSessionId === inspected.meta.id);
}
/**
* Mapping policy: a DeepSeek Web conversation is never used as a DSH session
* id. Each mirror is a new UUID. Reopen looks up an existing mirror whose
* latest DeepSeek replay matches accountHash + remote conversation id and
* whose replay.dshSessionId is either missing or equal to that header id.
* Production mirrors persist a plugin data-directory cwd so Harness persona
* `{{cwd}}` and tools have a working directory. That directory is registered
* as the official **DeepSeek Chat** workspace so continuations are not
* projected to Ungrouped. Legacy no-cwd rows are not reused once a cwd is
* configured. Archived Harness session ids are skipped so a popover reopen
* can mint a live mirror. Process cache is a hint only; persistence remains
* the restart source of truth. Safe
* append applies only when the local fingerprint is a strict prefix of the
* remote history. Divergence returns conflict and opens the existing local
* copy without merging. When the mirror is already live in SessionStore,
* later prefix extensions append through that session so the in-memory log
* stays the authority.
*/
function appendEventsToLiveSession(session, events) {
	for (const event of events) {
		if (event.surfaceOp === void 0 && event.sourceEventSeqs === void 0) {
			session.append(event.type, event.data);
			continue;
		}
		session.append(event.type, event.data, {
			...event.surfaceOp === void 0 ? {} : { surfaceOp: event.surfaceOp },
			...event.sourceEventSeqs === void 0 ? {} : { sourceEventSeqs: event.sourceEventSeqs }
		});
	}
}
var RemoteSessionMaterializer = class {
	persistence;
	liveSession;
	options;
	constructor(persistence, liveSession = () => void 0, options = {}) {
		this.persistence = persistence;
		this.liveSession = liveSession;
		this.options = options;
	}
	async materialize(input) {
		const persistence = this.persistence();
		if (persistence === void 0) throw new PluginSessionError("session persistence is unavailable; cannot open a DeepSeek Web conversation", ERROR_CODES.MIRROR_UNAVAILABLE);
		const cwd = this.options.cwd?.();
		const excluded = new Set(this.options.excludeSessionIds?.() ?? []);
		const existing = await findExistingMirror(persistence, input.accountHash, input.remote.session.chatSessionId, input.cachedSessionId, cwd, excluded, this.options.cwdAliases?.() ?? []);
		if (existing !== void 0) {
			const reused = await this.reconcile(persistence, existing, input);
			await this.attachQuietly(reused.sessionId);
			return reused;
		}
		if (pairRemoteTurns(input.remote.messages).length === 0) throw new PluginSessionError("that DeepSeek Web conversation has no completed turns to open", ERROR_CODES.REMOTE_HISTORY_INVALID);
		const sessionId = crypto.randomUUID();
		const seed = buildRemoteSessionSeed({
			sessionId,
			accountHash: input.accountHash,
			remote: input.remote
		});
		if (cwd !== void 0 && cwd.length > 0) await this.options.ensureCwd?.(cwd);
		await persistence.create({
			version: 0,
			id: sessionId,
			createdAt: Date.now(),
			...cwd !== void 0 && cwd.length > 0 ? { cwd } : {}
		});
		if (seed.events.length > 0) await persistence.append(sessionId, seed.events);
		await this.attachQuietly(sessionId);
		return {
			sessionId,
			created: true,
			reconciled: "created"
		};
	}
	async attachQuietly(sessionId) {
		try {
			await this.options.attach?.(sessionId);
		} catch {}
	}
	async reconcile(persistence, sessionId, input) {
		const inspected = await persistence.inspect(sessionId);
		const localMessages = derivedMessagesFromEvents(inspected.events);
		const local = localFingerprint(localMessages);
		const remote = remoteFingerprint(input.remote.messages);
		if (local === remote) return {
			sessionId,
			created: false,
			reconciled: "reused"
		};
		if (remote.startsWith(local) && (local.length === 0 || remote.charAt(local.length) === "\n")) {
			const localTurns = local === "" ? 0 : local.split("\n").length;
			const extra = pairRemoteTurns(input.remote.messages).slice(localTurns);
			if (extra.length === 0) return {
				sessionId,
				created: false,
				reconciled: "reused"
			};
			const synthetic = [];
			for (const turn of extra) synthetic.push(...turn.users, turn.assistant);
			const lastModel = lastAssistantModel(localMessages);
			const nextTurn = buildRemoteSessionSeed({
				sessionId,
				accountHash: input.accountHash,
				remote: {
					...input.remote,
					messages: synthetic
				},
				prefixMessages: localMessages,
				startTurn: localTurns + 1,
				startSeq: inspected.events.length === 0 ? 0 : inspected.events[inspected.events.length - 1].seq + 1,
				headerAlreadyLogged: localTurns > 0,
				lastModel
			}).events;
			const live = this.liveSession(sessionId);
			if (live !== void 0) appendEventsToLiveSession(live, nextTurn);
			else await persistence.append(sessionId, nextTurn);
			return {
				sessionId,
				created: false,
				reconciled: "appended"
			};
		}
		return {
			sessionId,
			created: false,
			reconciled: "conflict"
		};
	}
};
function eventTime(value, fallback) {
	const raw = value ?? fallback;
	const n = Number.isFinite(raw) ? Math.trunc(raw) : Math.trunc(fallback);
	return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
function truncateTitle(value) {
	const trimmed = value?.trim() ?? "";
	if (trimmed.length === 0) return void 0;
	let bytes = 0;
	let end = 0;
	for (const char of trimmed) {
		const size = Buffer.byteLength(char, "utf8");
		if (bytes + size > MAX_TITLE_BYTES) break;
		bytes += size;
		end += char.length;
	}
	const next = trimmed.slice(0, end).trimEnd();
	return next.length === 0 ? void 0 : next;
}
function lastAssistantModel(messages) {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message.role !== "assistant") continue;
		return message.source?.model === "expert" ? "expert" : "default";
	}
}
//#endregion
//#region src/workspace-fork.ts
function assistantEventIndex(events, messageId) {
	return events.findIndex((event) => {
		if (event.type !== "assistant/message") return false;
		return event.data.message?.id === messageId;
	});
}
function enclosingCompletedTurnEnd(events, assistantIndex) {
	const assistant = events[assistantIndex];
	if (assistant === void 0 || assistant.type !== "assistant/message") throw new PluginSessionError("fork message is not a finalized assistant turn", ERROR_CODES.FORK_MESSAGE_NOT_FOUND);
	const turn = assistant.data.turn;
	if (typeof turn !== "number") throw new PluginSessionError("fork message is missing a turn boundary", ERROR_CODES.FORK_OPEN_TURN);
	for (let index = assistantIndex; index < events.length; index++) {
		const event = events[index];
		if (event.type !== "turn/end") continue;
		const data = event.data;
		if (data.turn !== turn) continue;
		if (data.reason?.kind !== "completed") throw new PluginSessionError("cannot fork an incomplete turn", ERROR_CODES.FORK_OPEN_TURN);
		return index;
	}
	throw new PluginSessionError("cannot fork an incomplete turn", ERROR_CODES.FORK_OPEN_TURN);
}
function cutSeedAtTurnEnd(events, endIndex) {
	return events.slice(0, endIndex + 1).map((event, seq) => ({
		...event,
		seq
	}));
}
function forkEligibility(events, messageId) {
	const index = assistantEventIndex(events, messageId);
	if (index < 0) throw new PluginSessionError("fork message was not found", ERROR_CODES.FORK_MESSAGE_NOT_FOUND);
	const message = events[index].data.message;
	return {
		replay: message?.source?.provider === "deepseek-web" ? readReplay(message.source.replayState) : void 0,
		endIndex: enclosingCompletedTurnEnd(events, index),
		index
	};
}
var WorkspaceForkService = class {
	deps;
	constructor(deps) {
		this.deps = deps;
	}
	async fork(input, cachedChildId) {
		const persistence = this.deps.persistence();
		const workspaces = this.deps.workspaces();
		if (persistence === void 0 || workspaces === void 0) throw new PluginSessionError("session persistence or workspace registry is unavailable", ERROR_CODES.MIRROR_UNAVAILABLE);
		const workspace = workspaces.get(input.workspaceId);
		if (workspace === void 0) throw new PluginSessionError("the selected workspace was not found", ERROR_CODES.FORK_WORKSPACE_NOT_FOUND);
		if (workspace.path.length === 0) throw new PluginSessionError("the selected workspace is no longer available", ERROR_CODES.FORK_WORKSPACE_NOT_FOUND);
		let source;
		try {
			source = await persistence.inspect(input.sourceSessionId);
		} catch {
			throw new PluginSessionError("the source conversation was not found", ERROR_CODES.FORK_SOURCE_NOT_FOUND);
		}
		if (source.meta.origin === "subagent") throw new PluginSessionError("cannot fork a subagent session", ERROR_CODES.FORK_INCOMPATIBLE_SESSION);
		const eligibility = forkEligibility(source.events, input.messageId);
		if (eligibility.replay !== void 0) {
			const accountHash = await this.deps.accountHash();
			if (accountHash !== void 0 && eligibility.replay.affinity.accountHash !== accountHash) throw new PluginSessionError("Fork requires the same DeepSeek Web account that created this conversation", ERROR_CODES.FORK_MESSAGE_NOT_DEEPSEEK_WEB);
		}
		const seed = cutSeedAtTurnEnd(source.events, eligibility.endIndex);
		const agentPreset = resolveSessionPreset(source);
		const archived = new Set(workspaces.archivedSessionIds ?? []);
		const existing = await findExistingFork(persistence, input.sourceSessionId, workspace.path, seed.length, cachedChildId, archived);
		if (existing !== void 0) {
			await attachFork(workspace, existing);
			return {
				childSessionId: existing,
				reused: true
			};
		}
		const childId = crypto.randomUUID();
		await persistence.create({
			version: 0,
			id: childId,
			createdAt: Date.now(),
			cwd: workspace.path,
			parentSession: input.sourceSessionId,
			seedLength: seed.length,
			...agentPreset === void 0 ? {} : { agentPreset }
		});
		if (seed.length > 0) await persistence.append(childId, seed);
		await attachFork(workspace, childId);
		return {
			childSessionId: childId,
			reused: false
		};
	}
};
const MAX_FORK_INSPECT = 256;
async function findExistingFork(persistence, sourceSessionId, cwd, seedLength, cachedId, excludeIds = /* @__PURE__ */ new Set()) {
	if (cachedId !== void 0 && !excludeIds.has(cachedId)) {
		if (await forkMatches(persistence, cachedId, sourceSessionId, cwd, seedLength)) return cachedId;
	}
	const candidates = (await persistence.list()).filter((header) => header.origin !== "subagent" && !excludeIds.has(header.id) && header.parentSession === sourceSessionId && header.cwd === cwd && header.seedLength === seedLength).sort((left, right) => right.createdAt - left.createdAt).slice(0, MAX_FORK_INSPECT);
	for (const header of candidates) if (await forkMatches(persistence, header.id, sourceSessionId, cwd, seedLength)) return header.id;
}
async function forkMatches(persistence, id, sourceSessionId, cwd, seedLength) {
	try {
		const existing = await persistence.inspect(id);
		return existing.meta.parentSession === sourceSessionId && existing.meta.cwd === cwd && existing.meta.seedLength === seedLength && existing.events.length === seedLength;
	} catch {
		return false;
	}
}
async function attachFork(workspace, sessionId) {
	try {
		await workspace.attachSession(sessionId);
	} catch (error) {
		throw new PluginSessionError(error instanceof Error ? error.message : "failed to attach the forked session", ERROR_CODES.FORK_WORKSPACE_ATTACH_FAILED);
	}
}
//#endregion
//#region src/session-publisher.ts
/**
* Harness `session.list` only merges cold persistence rows that have a cwd.
* Mirrors must be live in SessionStore (and preferably have an Agent) or the
* client never sees them — `open()` then times out with
* "the conversation is not yet visible in Harness".
*
* Official resume publishes the persisted log into SessionStore and mounts the
* agent preset in `setup` so tools and prompt sections exist before the agent
* is published. Skipping that mount leaves `options.tools` empty: the DSH
* system prompt still tells the model to emit `<dsh_tool_calls>`, and the
* adapter streams those tags as visible text.
*/
async function ensureHarnessSessionAttached(input) {
	const { sessionId, agents, sessions, cwd } = input;
	const live = agents?.get(sessionId);
	if (live !== void 0) {
		installMirrorCwdVariable(live.ctx?.systemPrompt, cwd, live.session.header?.cwd);
		return;
	}
	if (sessions?.get(sessionId) !== void 0 && (agents === void 0 || typeof agents.resume !== "function")) return;
	if (agents === void 0 || typeof agents.resume !== "function") return;
	try {
		const handle = await agents.resume({
			resumeSessionId: sessionId,
			setup: async (agentCtx) => {
				installMirrorCwdVariable(agentCtx.systemPrompt, cwd, agentCtx.agent?.session.header?.cwd);
				await input.agentPresets?.mount(agentCtx, input.agentPreset);
			}
		});
		installMirrorCwdVariable(handle.agent.ctx?.systemPrompt, cwd, handle.agent.session.header?.cwd);
	} catch (error) {
		const recovered = agents.get(sessionId);
		if (recovered !== void 0) {
			installMirrorCwdVariable(recovered.ctx?.systemPrompt, cwd, recovered.session.header?.cwd);
			return;
		}
		if (sessions?.get(sessionId) !== void 0) return;
		throw new PluginSessionError(`the conversation was saved but could not be opened in Harness: ${error instanceof Error ? error.message : String(error)}`, ERROR_CODES.MIRROR_UNAVAILABLE);
	}
}
function installMirrorCwdVariable(systemPrompt, cwd, headerCwd) {
	if (systemPrompt === void 0) return;
	if (headerCwd !== void 0 && headerCwd.length > 0) return;
	if (cwd === void 0 || cwd.length === 0) return;
	try {
		systemPrompt.variable("cwd", () => cwd);
	} catch {}
}
//#endregion
//#region src/workspace-title.ts
/** Display title for the plugin-owned Harness workspace. */
const DEEPSEEK_CHAT_WORKSPACE_TITLE = "DeepSeek Chat";
//#endregion
//#region src/deepseek-chat-workspace.ts
function deepSeekChatWorkspaceDir(home) {
	return join(home, "deepseek-web", "workspace");
}
async function ensureDeepSeekChatWorkspace(input) {
	const raw = deepSeekChatWorkspaceDir(input.home);
	await mkdir(raw, { recursive: true });
	const registry = input.workspaces;
	if (registry?.create === void 0) return { path: await resolveExisting(raw) };
	const workspace = await registry.create(raw, DEEPSEEK_CHAT_WORKSPACE_TITLE);
	if (workspace.title !== "DeepSeek Chat" && workspace.setTitle !== void 0) await workspace.setTitle(DEEPSEEK_CHAT_WORKSPACE_TITLE);
	return {
		path: workspace.path,
		id: workspace.id,
		workspace
	};
}
async function resolveExisting(path) {
	try {
		return await realpath(path);
	} catch {
		return path;
	}
}
//#endregion
//#region src/remote-session-service.ts
var RemoteSessionService = class {
	deps;
	cache = new RemoteSessionCache();
	materializer;
	forks;
	chatWorkspace;
	chatWorkspacePath;
	constructor(deps) {
		this.deps = deps;
		this.materializer = new RemoteSessionMaterializer(deps.persistence, (id) => {
			return deps.sessions?.()?.get(id) ?? deps.agents?.()?.get(id)?.session;
		}, {
			cwd: () => this.chatWorkspacePath ?? deps.cwd?.(),
			cwdAliases: () => {
				const primary = this.chatWorkspacePath;
				const raw = deps.cwd?.();
				return raw !== void 0 && raw.length > 0 && (primary === void 0 || raw !== primary) ? [raw] : [];
			},
			ensureCwd: deps.ensureCwd,
			excludeSessionIds: () => deps.workspaces?.()?.archivedSessionIds ?? [],
			attach: async (sessionId) => {
				await this.chatWorkspace?.attachSession(sessionId);
			}
		});
		this.forks = new WorkspaceForkService({
			persistence: deps.persistence,
			workspaces: deps.workspaces,
			accountHash: async () => {
				const status = await deps.auth.status();
				return status.status === "signed-in" ? status.account.accountHash : void 0;
			}
		});
	}
	clear() {
		this.cache.clear();
	}
	async requireCredential() {
		const status = await this.deps.auth.status();
		if (status.status !== "signed-in") throw new PluginSessionError("Sign in to DeepSeek Web to browse conversations", ERROR_CODES$1.MISSING_CREDENTIAL);
		const token = await this.deps.auth.resolveToken();
		if (token === void 0 || token.length === 0) throw new PluginSessionError("Sign in to DeepSeek Web to browse conversations", ERROR_CODES$1.MISSING_CREDENTIAL);
		return {
			token,
			accountHash: status.account.accountHash
		};
	}
	async listSessions(options) {
		const { token, accountHash } = await this.requireCredential();
		if (options?.refresh === true) this.cache.invalidateList(accountHash);
		else {
			const cached = this.cache.getList(accountHash);
			if (cached !== void 0 && options?.cursor === void 0) return cached;
		}
		return this.cache.singleFlight("list", `${accountHash}:${options?.cursor ?? ""}:${options?.limit ?? ""}`, async () => {
			try {
				const page = await this.deps.client.listSessions(token, {
					cursor: options?.cursor,
					limit: options?.limit,
					signal: options?.signal
				});
				if (options?.cursor === void 0) this.cache.setList(accountHash, page);
				return page;
			} catch (error) {
				throw mapRemoteError(error, ERROR_CODES.REMOTE_SESSION_LIST_FAILED);
			}
		});
	}
	async fetchHistory(chatSessionId, options) {
		const { token, accountHash } = await this.requireCredential();
		if (options?.refresh === true) this.cache.invalidateHistory(accountHash, chatSessionId);
		else {
			const cached = this.cache.getHistory(accountHash, chatSessionId);
			if (cached !== void 0) return cached;
		}
		return this.cache.singleFlight("history", this.cache.historyKey(accountHash, chatSessionId), async () => {
			try {
				const history = await this.deps.client.fetchSessionHistory(token, chatSessionId, { signal: options?.signal });
				this.cache.setHistory(accountHash, chatSessionId, history);
				return history;
			} catch (error) {
				throw mapRemoteError(error, ERROR_CODES.REMOTE_SESSION_HISTORY_FAILED);
			}
		});
	}
	async materialize(chatSessionId) {
		const { accountHash } = await this.requireCredential();
		return this.cache.singleFlight("materialize", this.cache.mirrorKey(accountHash, chatSessionId), async () => {
			await this.ensureChatWorkspace();
			const history = await this.fetchHistory(chatSessionId, { refresh: true });
			const result = await this.materializer.materialize({
				accountHash,
				remote: history,
				cachedSessionId: this.cache.getMirror(accountHash, chatSessionId)
			});
			await ensureHarnessSessionAttached({
				sessionId: result.sessionId,
				agents: this.deps.agents?.(),
				sessions: this.deps.sessions?.(),
				cwd: this.chatWorkspacePath ?? this.deps.cwd?.(),
				agentPresets: this.deps.agentPresets?.()
			});
			this.cache.setMirror(accountHash, chatSessionId, result.sessionId);
			return result;
		});
	}
	async fork(input) {
		const key = this.cache.forkKey(input.sourceSessionId, input.messageId, input.workspaceId);
		return this.cache.singleFlight("fork", key, async () => {
			await this.ensureChatWorkspace();
			const result = await this.forks.fork(input, this.cache.getFork(key));
			this.cache.rememberFork(key, result.childSessionId);
			const workspace = this.deps.workspaces?.()?.get(input.workspaceId);
			let agentPreset;
			try {
				const child = await this.deps.persistence()?.inspect(result.childSessionId);
				if (child !== void 0) agentPreset = resolveSessionPreset(child);
			} catch {}
			await ensureHarnessSessionAttached({
				sessionId: result.childSessionId,
				agents: this.deps.agents?.(),
				sessions: this.deps.sessions?.(),
				cwd: workspace?.path,
				agentPresets: this.deps.agentPresets?.(),
				agentPreset
			});
			return result;
		});
	}
	async ensureChatWorkspace() {
		const home = this.deps.home?.();
		if (home === void 0) return;
		const ensured = await ensureDeepSeekChatWorkspace({
			home,
			workspaces: this.deps.workspaces?.()
		});
		this.chatWorkspacePath = ensured.path;
		this.chatWorkspace = ensured.workspace;
		if (this.chatWorkspace === void 0 && ensured.id !== void 0) this.chatWorkspace = this.deps.workspaces?.()?.get(ensured.id);
	}
};
function mapRemoteError(error, fallback) {
	if (error instanceof PluginSessionError) return error;
	if (error instanceof DeepSeekWebError) {
		if (error.code === ERROR_CODES$1.REMOTE_SESSION) return new PluginSessionError("that DeepSeek Web conversation was not found", ERROR_CODES.REMOTE_SESSION_NOT_FOUND);
		return new PluginSessionError(error.message, error.code);
	}
	return new PluginSessionError(error instanceof Error ? error.message : String(error), fallback);
}
//#endregion
//#region src/commands.ts
const ON_TEXT = "Clean mode on. Later turns send only your text, without system prompt, tools, or skills. Send /clean again to turn it off.";
const OFF_TEXT = "Clean mode off. Later turns use the normal system prompt, tools, and skills.";
function handleCleanCommand(rawInput, agent) {
	const text = rawInput.trim();
	const sessionId = agent.session.id;
	if (sessionId.length === 0) return {
		kind: "error",
		text: "Usage: /clean [message]"
	};
	if (isCleanMode(sessionId)) {
		setCleanMode(sessionId, false);
		return {
			kind: "success",
			text: OFF_TEXT
		};
	}
	setCleanMode(sessionId, true);
	if (text.length === 0) return {
		kind: "success",
		text: ON_TEXT
	};
	const message = createUserMessage({
		content: [{
			type: "text",
			text
		}],
		source: { kind: "user" }
	});
	try {
		if (agent.followup !== void 0) agent.followup(message);
		else if (agent.steer !== void 0) agent.steer(message);
		else {
			setCleanMode(sessionId, false);
			return {
				kind: "error",
				text: "This session cannot send a clean message."
			};
		}
	} catch (error) {
		setCleanMode(sessionId, false);
		throw error;
	}
	return {
		kind: "success",
		text: ON_TEXT
	};
}
function registerCommands(ctx, service) {
	ctx.inject(["commands"], (injected) => {
		injected.commands.register({
			name: "deepseek-web",
			description: "DeepSeek Web account commands",
			handler: async (invocation) => {
				const [action] = (invocation.rawInput ?? invocation.text ?? "status").trim().split(/\s+/);
				if (action === "login") return {
					kind: "success",
					text: `DeepSeek Web: ${(await service.login({ resetProfile: true })).status}`
				};
				if (action === "logout") {
					await service.logout();
					return {
						kind: "success",
						text: "DeepSeek Web signed out"
					};
				}
				if (action === "doctor") {
					const doctor = await service.doctor();
					return {
						kind: doctor.ok ? "success" : "error",
						text: doctor.checks.map((check) => `${check.name}: ${check.detail}`).join("\n")
					};
				}
				return {
					kind: "success",
					text: `DeepSeek Web: ${(await service.status()).status}`
				};
			}
		});
		injected.commands.register({
			name: "clean",
			description: "Toggle sending only your text, without system prompt, tools, or skills",
			input: { hint: "message" },
			handler: (invocation) => {
				const agent = invocation.agent;
				if (agent === void 0) return {
					kind: "error",
					text: "Usage: /clean [message]"
				};
				return handleCleanCommand(invocation.rawInput ?? "", agent);
			}
		});
	});
}
//#endregion
//#region src/service.ts
var DeepSeekWebService = class {
	options;
	auth;
	constructor(options) {
		this.options = options;
		this.auth = new BrowserAuthCoordinator({
			resolveHome: options.resolveHome,
			storeCredential: options.storeCredential,
			clearCredential: options.clearCredential,
			validateCredential: options.validateCredential,
			readStoredAccount: async () => {
				try {
					const token = await options.resolveCredential();
					if (token === void 0) return void 0;
					return options.validateCredential(token);
				} catch {
					return;
				}
			}
		});
	}
	status() {
		return this.auth.status();
	}
	resolveToken() {
		return this.options.resolveCredential();
	}
	login(options) {
		const browser = this.options.config().browser;
		return this.auth.signIn({
			preferred: browser.preferred,
			allowManagedDownload: browser.allowManagedDownload,
			resetProfile: options?.resetProfile === true
		});
	}
	async logout(clearProfile = true) {
		await this.auth.signOut({ clearProfile });
		this.options.onSignOut?.();
	}
	cancel() {
		return this.auth.cancel();
	}
	async doctor() {
		const checks = [];
		const status = await this.status();
		checks.push({
			name: "auth",
			ok: status.status === "signed-in",
			detail: status.status
		});
		const pool = new PowWorkerPool();
		try {
			const kind = await pool.solverKind();
			checks.push({
				name: "pow",
				ok: kind === "wasm",
				detail: kind
			});
		} catch (error) {
			checks.push({
				name: "pow",
				ok: false,
				detail: error instanceof Error ? error.message : String(error)
			});
		} finally {
			await pool.dispose();
		}
		try {
			const core = await loadProtocolCore();
			checks.push({
				name: "Protocol core ABI",
				ok: core.abiVersion === 2,
				detail: String(core.abiVersion)
			});
			checks.push({
				name: "Protocol WASM",
				ok: true,
				detail: "OK"
			});
			const text = core.pathlessFixture();
			checks.push({
				name: "SSE pathless fixture",
				ok: text === "<dsh_tool_calls>",
				detail: text === "<dsh_tool_calls>" ? "OK" : text
			});
		} catch (error) {
			checks.push({
				name: "Protocol WASM",
				ok: false,
				detail: error instanceof Error ? error.message : String(error)
			});
		}
		return {
			ok: checks.every((check) => check.ok),
			checks
		};
	}
};
//#endregion
//#region src/index.ts
const name = "llm-deepseek-web";
const inject = ["llm"];
const Config = z.object({
	tokenEnv: z.string().role("credential-ref").default(DEFAULT_CONFIG.tokenEnv).volatile(),
	defaultModel: z.union(["default", "expert"]).default("default").volatile(),
	thinking: z.union(["enabled", "disabled"]).default("enabled").volatile(),
	streamIdleTimeoutMs: z.number().volatile(),
	maxToolProtocolBytes: z.number().volatile(),
	maxToolCallsPerTurn: z.number().volatile(),
	maxProtocolRepairAttempts: z.number().volatile(),
	maxToolResultBytes: z.number().volatile(),
	browser: z.object({
		preferred: z.union([
			"auto",
			"chrome",
			"edge",
			"brave",
			"chromium",
			"managed"
		]),
		allowManagedDownload: z.boolean()
	}).volatile()
});
/** Bundle entry id; the new settings service keys forms by profile entry id. */
const NS = SETTINGS_NS;
/** Reduce schemastery volatile refs (\`.get()\`) to plain values. */
function unwrapVolatile(value) {
	if (value === null || typeof value !== "object") return value;
	if (typeof value.get === "function") return unwrapVolatile(value.get());
	if (Array.isArray(value)) return value.map(unwrapVolatile);
	const out = {};
	for (const [key, item] of Object.entries(value)) out[key] = unwrapVolatile(item);
	return out;
}
function apply(ctx, config) {
	let current = () => unwrapVolatile(config);
	let lastRaw;
	let lastGood;
	const options = () => {
		const raw = current();
		if (raw === lastRaw && lastGood !== void 0) return lastGood;
		try {
			lastRaw = raw;
			lastGood = resolveConfig(raw);
			return lastGood;
		} catch (error) {
			if (lastGood === void 0) throw error;
			lastRaw = raw;
			ctx.logger.error("dsh-deepseek-web-free: keeping last good configuration after invalid settings");
			ctx.logger.error(error);
			return lastGood;
		}
	};
	options();
	const resolveCredential = async () => {
		const ref = credentialRef(options().tokenEnv);
		const credentials = ctx.get("credentials");
		if (credentials !== void 0) {
			const hit = await credentials.resolve(ref);
			if (hit !== void 0 && hit.value.length > 0) return hit.value.replace(/^Bearer\s+/i, "");
		}
		throw new LlmError(`dsh-deepseek-web-free: missing credential ${options().tokenEnv}; sign in from Settings or CLI`, ERROR_CODES$1.MISSING_CREDENTIAL);
	};
	const storeCredential = async (token) => {
		const credentials = ctx.get("credentials");
		if (credentials === void 0) throw new Error("credentials service unavailable");
		await credentials.set(credentialRef(options().tokenEnv), token);
	};
	const clearCredential = async () => {
		const credentials = ctx.get("credentials");
		if (credentials === void 0) return;
		await credentials.unset(credentialRef(options().tokenEnv));
	};
	const client = new CompatDeepSeekWebClient();
	const adapter = new DeepSeekWebAdapter({
		options,
		resolveCredential,
		client
	});
	let remoteSessions;
	ctx.llm.registerConfigurableProviders([{
		provider: PROVIDER,
		displayName: "DeepSeek Web",
		settingsNs: NS,
		settingsPath: []
	}]);
	ctx.llm.registerAdapter([PROVIDER], adapter);
	const service = new DeepSeekWebService({
		resolveHome: () => resolveDshHome(),
		resolveCredential: async () => {
			try {
				return await resolveCredential();
			} catch {
				return;
			}
		},
		storeCredential,
		clearCredential,
		validateCredential: async (token, signal) => {
			return { accountHash: (await client.currentUser(token, signal)).accountHash };
		},
		config: options,
		onSignOut: () => {
			adapter.clearAccountCache();
			remoteSessions?.clear();
		}
	});
	ctx.provide("deepSeekWeb", service);
	const mirrorCwd = () => join(resolveDshHome(), "deepseek-web", "workspace");
	remoteSessions = new RemoteSessionService({
		auth: service,
		client,
		persistence: () => ctx.get("sessionPersistence"),
		workspaces: () => ctx.get("workspaceRegistry"),
		agents: () => ctx.get("agents"),
		sessions: () => ctx.get("sessions"),
		agentPresets: () => ctx.get("agentPresets"),
		home: () => resolveDshHome(),
		cwd: mirrorCwd,
		ensureCwd: async (path) => {
			await mkdir(path, { recursive: true });
		}
	});
	ctx.inject(["workspaceRegistry"], (injected) => {
		injected.effect(() => {
			ensureDeepSeekChatWorkspace({
				home: resolveDshHome(),
				workspaces: injected.get("workspaceRegistry")
			}).catch((error) => {
				injected.logger.error("dsh-deepseek-web-free: DeepSeek Chat workspace");
				injected.logger.error(error);
			});
			return () => void 0;
		}, "dsh-deepseek-web-free: DeepSeek Chat workspace");
	});
	ctx.inject(["webServer"], (injected) => {
		injected.effect(() => {
			const auth = registerAuthRoutes(injected.webServer, service);
			const sessions = registerSessionRoutes(injected.webServer, remoteSessions);
			return () => {
				auth();
				sessions();
				remoteSessions?.clear();
			};
		}, "dsh-deepseek-web-free: host routes");
	});
	registerCommands(ctx, service);
	// The legacy settings-section hook was removed in dsh 0.2.x: the settings
	// service now derives its forms straight from a plugin's volatile Config fields,
	// keyed by the profile entry id (which equals NS here). Keep the page policy
	// manual because this plugin ships its own settings section.
	ctx.inject(["settings"], (child) => {
		child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
	});
}
//#endregion
export { Config, DeepSeekWebAdapter, PROVIDER, apply, inject, name };

//# sourceMappingURL=index.js.map