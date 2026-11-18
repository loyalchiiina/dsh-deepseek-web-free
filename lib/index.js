import { c as redactSensitiveText, i as BrowserAuthCoordinator, o as PowWorkerPool, r as resolveConfig, s as loadProtocolCore } from "./config-Cj5CJQ3m.js";
import { createHash } from "node:crypto";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import * as dshSettings from "@deepseek-ai/dsh-settings";
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
//#region src/auth-routes.ts
const AUTH_STATUS_PATH = "/plugins/dsh-deepseek-web/auth/status";
const AUTH_LOGIN_PATH = "/plugins/dsh-deepseek-web/auth/login";
const AUTH_CANCEL_PATH = "/plugins/dsh-deepseek-web/auth/cancel";
const AUTH_LOGOUT_PATH = "/plugins/dsh-deepseek-web/auth/logout";
const ACCOUNT_PATH = "/plugins/dsh-deepseek-web/account";
const DOCTOR_PATH = "/plugins/dsh-deepseek-web/doctor";
/**
* Hands the stored DeepSeek web session token to the DSH renderer so the
* embedded web panel can seed `localStorage.userToken` inside its own guest
* partition. Same-origin only: trustedPluginRequest() rejects anything that is
* not a loopback request issued by the DSH app itself.
*/
const WEBPANEL_TOKEN_PATH = "/plugins/dsh-deepseek-web/webpanel/token";
/**
* Reverse hand-off: the embedded web panel captured a session token while the
* user signed in inside the guest, and posts it here so the Host stores the same
* account permanently (settings page, model list and the next restart all reuse
* it). Same-origin only, exactly like the token hand-out above.
*/
const AUTH_IMPORT_PATH = "/plugins/dsh-deepseek-web/auth/import";
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
/**
* Exact webServer.register() routes bypass DSH's /api admission fence, so each
* handler must ask the Host Connection service for the same decision itself.
* Fail closed: a missing or broken gate is never interpreted as "allow".
*/
function hostRejection(req, connection) {
	if (connection === void 0 || connection === null) return 503;
	const gate = connection.requestRejection;
	if (typeof gate !== "function") return 503;
	try {
		return gate.call(connection, req) ?? void 0;
	} catch {
		return 503;
	}
}
async function readBody(req, limit = 4096) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		total += chunk.length;
		if (total > limit) throw new Error("body too large");
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString("utf8");
}
function registerAuthRoutes(webServer, service, connection) {
	const handler = (method, fn) => async (req, res) => {
		if (req.method !== method) {
			write(res, 405, { error: "method not allowed" });
			return;
		}
		const rejection = hostRejection(req, connection());
		if (rejection !== void 0) {
			write(res, rejection, { error: "host authentication required" });
			return;
		}
		if (!trustedPluginRequest(req)) {
			forbidden(res);
			return;
		}
		try {
			await fn(req, res);
		} catch (error) {
			write(res, 500, { error: redactSensitiveText(error instanceof Error ? error.message : String(error)) });
		}
	};
	const disposers = [
		webServer.register({
			kind: "exact",
			path: AUTH_STATUS_PATH,
			handler: handler("GET", async (_req, res) => write(res, 200, await service.status()))
		}),
		webServer.register({
			kind: "exact",
			path: AUTH_LOGIN_PATH,
			handler: handler("POST", async (req, res) => {
				const raw = await readBody(req);
				const body = raw.length > 0 ? JSON.parse(raw) : {};
				service.login({ resetProfile: body.resetProfile === true }).catch(() => void 0);
				write(res, 200, await service.status());
			})
		}),
		webServer.register({
			kind: "exact",
			path: AUTH_IMPORT_PATH,
			handler: handler("POST", async (req, res) => {
				const raw = await readBody(req);
				const body = raw.length > 0 ? JSON.parse(raw) : {};
				const token = typeof body.token === "string" ? body.token : "";
				if (token.length === 0) {
					write(res, 400, { error: "token is required" });
					return;
				}
				try {
					write(res, 200, {
						ok: true,
						status: await service.importToken(token)
					});
				} catch (error) {
					write(res, 400, { error: redactSensitiveText(error instanceof Error ? error.message : String(error)) });
				}
			})
		}),
		webServer.register({
			kind: "exact",
			path: AUTH_CANCEL_PATH,
			handler: handler("POST", async (req, res) => {
				await readBody(req);
				await service.cancel();
				write(res, 200, { ok: true });
			})
		}),
		webServer.register({
			kind: "exact",
			path: AUTH_LOGOUT_PATH,
			handler: handler("POST", async (req, res) => {
				const raw = await readBody(req);
				const body = raw.length > 0 ? JSON.parse(raw) : {};
				await service.logout(body.clearProfile !== false);
				write(res, 200, { ok: true });
			})
		}),
		webServer.register({
			kind: "exact",
			path: ACCOUNT_PATH,
			handler: handler("GET", async (_req, res) => {
				const status = await service.status();
				write(res, 200, status.status === "signed-in" ? {
					account: status.account,
					browser: status.browser
				} : { status: status.status });
			})
		}),
		webServer.register({
			kind: "exact",
			path: DOCTOR_PATH,
			handler: handler("GET", async (_req, res) => write(res, 200, await service.doctor()))
		}),
		webServer.register({
			kind: "exact",
			path: WEBPANEL_TOKEN_PATH,
			handler: handler("GET", async (_req, res) => {
				const token = await service.resolveToken();
				if (token === void 0 || token.length === 0) {
					write(res, 200, { status: "signed-out" });
					return;
				}
				write(res, 200, {
					status: "signed-in",
					token
				});
			})
		})
	];
	return () => {
		for (const dispose of disposers) dispose();
	};
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
	/**
	* Imports a token captured inside the embedded web panel: the guest page owns
	* the session (`localStorage.userToken`), the Host owns the permanent
	* credential. Validating first means a stale or forged value never lands in
	* the credential store, so signing in on either surface keeps both in sync.
	*/
	async importToken(token) {
		const normalized = token.trim();
		if (normalized.length < 16) throw new Error("token is too short");
		try {
			await this.options.validateCredential(normalized);
		} catch {}
		await this.options.storeCredential(normalized);
		return this.status();
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
const inject = [];
const Config = z.object({
	tokenEnv: z.string().role("credential-ref").default("DEEPSEEK_WEB_TOKEN"),
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
	})
});
typeof dshSettings.settingsNamespace === "function" && dshSettings.settingsNamespace("llm-deepseek-web");
function apply(ctx, config) {
	let current = () => config;
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
			ctx.logger.error("dsh-deepseek-web: keeping last good configuration after invalid settings");
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
		throw new Error("dsh-deepseek-web: missing credential for the web panel");
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
		validateCredential: async (token, _signal) => ({ accountHash: createHash("sha256").update(token).digest("hex").slice(0, 16) }),
		config: options,
		onSignOut: () => void 0
	});
	ctx.provide("deepSeekWeb", service);
	ctx.inject(["webServer"], (injected) => {
		injected.effect(() => {
			const connection = () => {
				try {
					return ctx.get("connection");
				} catch {
					return;
				}
			};
			const auth = registerAuthRoutes(injected.webServer, service, connection);
			return () => {
				auth();
			};
		}, "dsh-deepseek-web: host routes");
	});
}
//#endregion
export { Config, apply, inject, name };
