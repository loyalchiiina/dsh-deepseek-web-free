window.__ModuleLoader__.load({
	id: "dsh-deepseek-web-free",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
		const STATUS_PATH = "/plugins/dsh-deepseek-web-free/auth/status";
		const LOGIN_PATH = "/plugins/dsh-deepseek-web-free/auth/login";
		const CANCEL_PATH = "/plugins/dsh-deepseek-web-free/auth/cancel";
		const LOGOUT_PATH = "/plugins/dsh-deepseek-web-free/auth/logout";
		const DOCTOR_PATH = "/plugins/dsh-deepseek-web-free/doctor";
		const SESSIONS_PATH = "/plugins/dsh-deepseek-web-free/sessions";
		const FORK_PATH = "/plugins/dsh-deepseek-web-free/fork";
		var PluginApiError = class extends Error {
			code;
			status;
			constructor(message, status, code) {
				super(message);
				this.name = "PluginApiError";
				this.status = status;
				this.code = code;
			}
		};
		function sessionsListPath(options) {
			const params = new URLSearchParams();
			if (options?.cursor) params.set("cursor", options.cursor);
			if (options?.limit !== void 0) params.set("limit", String(options.limit));
			if (options?.refresh === true) params.set("refresh", "1");
			const query = params.toString();
			return query.length === 0 ? SESSIONS_PATH : `${SESSIONS_PATH}?${query}`;
		}
		function materializePath(chatSessionId) {
			return `${SESSIONS_PATH}/${encodeURIComponent(chatSessionId)}/materialize`;
		}
		async function pluginFetch(path, init) {
			const headers = new Headers(init?.headers);
			if (!headers.has("accept")) headers.set("accept", "application/json");
			if (init?.body !== void 0 && !headers.has("content-type")) headers.set("content-type", "application/json");
			const response = await fetch(path, {
				credentials: "same-origin",
				...init,
				headers
			});
			const text = await response.text();
			let body = null;
			if (text.length > 0) try {
				body = JSON.parse(text);
			} catch {
				throw new PluginApiError(`DeepSeek Web ${path} returned ${response.status}`, response.status);
			}
			if (!response.ok) {
				const record = body;
				throw new PluginApiError(record?.error ?? `DeepSeek Web ${path} returned ${response.status}`, response.status, record?.code);
			}
			return body;
		}
		//#endregion
		//#region src/client/DeepSeekWebSettings.tsx
		const sectionStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 12,
			maxWidth: 720,
			color: "var(--dsw-alias-label-primary)"
		};
		const titleStyle = {
			margin: 0,
			fontSize: 16,
			lineHeight: "24px",
			fontWeight: 500,
			color: "var(--dsw-alias-label-primary)"
		};
		const introStyle = {
			margin: "6px 0 0",
			fontSize: 14,
			lineHeight: "22px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const rowsStyle = {
			listStyle: "none",
			margin: "12px 0 0",
			padding: 0,
			display: "flex",
			flexDirection: "column",
			gap: 8
		};
		const rowCardStyle = {
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 12,
			padding: "12px 14px",
			display: "flex",
			flexDirection: "column",
			gap: 12
		};
		const rowHeadStyle = {
			display: "flex",
			alignItems: "center",
			gap: 10
		};
		const rowIdentityStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 8,
			minWidth: 0
		};
		const rowNameStyle = {
			fontSize: 14,
			lineHeight: "22px",
			fontWeight: 500,
			color: "var(--dsw-alias-label-primary)"
		};
		const rowTagStyle = {
			flex: "none",
			padding: "1px 6px",
			border: "1px solid var(--dsw-alias-border-l3)",
			borderRadius: 4,
			fontSize: 11,
			lineHeight: "16px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const rowActionsStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			marginLeft: "auto"
		};
		const metaStyle = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const errorStyle = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-state-error-primary)"
		};
		const cardTitleStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "22px",
			fontWeight: 500,
			color: "var(--dsw-alias-label-primary)"
		};
		const cardIntroStyle = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const editorActionsStyle = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 8
		};
		const outputStyle = {
			margin: 0,
			padding: "12px 14px",
			borderRadius: 12,
			background: "var(--dsw-alias-bg-module-platform)",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			lineHeight: "18px",
			whiteSpace: "pre-wrap",
			overflow: "auto",
			maxHeight: 240
		};
		function isSigningIn(status) {
			return status === "detecting-browser" || status === "installing-browser" || status === "launching-browser" || status === "waiting-for-login" || status === "validating";
		}
		function statusCopy(t, state) {
			switch (state.status) {
				case "signed-in": return t("signedIn");
				case "signed-out": return t("signedOut");
				case "loading": return t("loadingAccount");
				case "detecting-browser": return t("detectingBrowser");
				case "installing-browser": return state.progress === void 0 ? t("installingBrowser") : `${t("installingBrowser")} ${Math.round(state.progress * 100)}%`;
				case "launching-browser": return t("launchingBrowser");
				case "waiting-for-login": return t("waitingForLogin");
				case "validating": return t("validating");
				case "error": return t("requestFailed");
			}
		}
		function statusDot(status) {
			if (status === "signed-in") return "done";
			if (status === "error") return "error";
			if (isSigningIn(status) || status === "loading") return "ongoing";
			return "warning";
		}
		function DeepSeekWebSettings(props) {
			const t = props.t ?? ((key) => key);
			const [state, setState] = (0, react.useState)({ status: "loading" });
			const [doctor, setDoctor] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const signingIn = isSigningIn(state.status);
			const refresh = (0, react.useCallback)(async () => {
				const next = await pluginFetch(STATUS_PATH);
				if (typeof next?.status === "string") setState(next);
			}, []);
			(0, react.useEffect)(() => {
				refresh().catch((caught) => {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				});
				const timer = setInterval(() => {
					refresh().catch(() => void 0);
				}, 1e3);
				return () => clearInterval(timer);
			}, [refresh, t]);
			const run = async (fn, allowDuringBusy = false) => {
				if (busy && !allowDuringBusy) return;
				setBusy(true);
				setError("");
				try {
					await fn();
					await refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: sectionStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					style: titleStyle,
					children: t("title")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: introStyle,
					children: t("intro")
				})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
					style: rowsStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						style: rowCardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: rowHeadStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: rowIdentityStyle,
									role: "status",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: statusDot(state.status) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: rowNameStyle,
											children: statusCopy(t, state)
										}),
										state.status === "signed-in" && state.browser ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: rowTagStyle,
											children: state.browser.kind
										}) : null
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: rowActionsStyle,
									children: [
										signingIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											size: "sm",
											disabled: busy && !signingIn,
											onClick: () => void run(async () => {
												await pluginFetch(CANCEL_PATH, {
													method: "POST",
													body: "{}"
												});
											}, true),
											children: t("cancel")
										}) : null,
										state.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											size: "sm",
											disabled: busy,
											onClick: () => void run(async () => {
												await pluginFetch(LOGIN_PATH, {
													method: "POST",
													body: JSON.stringify({ resetProfile: false })
												});
											}),
											children: busy ? t("working") : t("reconnect")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "ghost",
											size: "sm",
											disabled: busy,
											onClick: () => void run(async () => {
												await pluginFetch(LOGOUT_PATH, {
													method: "POST",
													body: JSON.stringify({ clearProfile: true })
												});
											}),
											children: t("signOut")
										})] }) : null,
										state.status === "signed-out" || state.status === "error" || state.status === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "primary",
											size: "sm",
											disabled: busy || signingIn,
											onClick: () => void run(async () => {
												await pluginFetch(LOGIN_PATH, {
													method: "POST",
													body: JSON.stringify({ resetProfile: true })
												});
											}),
											children: busy ? t("working") : state.status === "error" ? t("loginAgain") : t("signIn")
										}) : null
									]
								})]
							}),
							state.status === "signed-in" && state.account ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								style: metaStyle,
								children: [
									t("account"),
									" ",
									state.account.accountHash.slice(0, 8),
									"…"
								]
							}) : null,
							state.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: state.message
							}) : null,
							error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: error
							}) : null
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						style: rowCardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								style: cardTitleStyle,
								children: t("diagnostics")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: cardIntroStyle,
								children: t("diagnosticsIntro")
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: editorActionsStyle,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: busy,
									onClick: () => void run(async () => {
										const result = await pluginFetch(DOCTOR_PATH);
										setDoctor(JSON.stringify(result, null, 2));
									}),
									children: busy ? t("working") : t("doctor")
								})
							}),
							doctor ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								style: outputStyle,
								children: doctor
							}) : null
						]
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/DeepSeekSessionsPopover.tsx
		const MENU_REFRESH = "::refresh";
		const MENU_RETRY = "::retry";
		const MENU_SIGN_IN = "::signin";
		function sessionMenuEntries(state, t, options) {
			const openingId = options?.openingId;
			const error = options?.error;
			const items = [];
			if (error !== void 0) items.push({
				type: "label",
				id: "open-error",
				text: error
			});
			if (state.phase === "signed-out") items.push({
				type: "label",
				id: "signed-out",
				text: t("sessionsSignedOut")
			});
			else if ((state.phase === "idle" || state.phase === "loading") && state.items.length === 0) items.push({
				id: "::loading",
				label: t("sessionsLoading"),
				disabled: true
			});
			else if (state.phase === "error" && state.items.length === 0) items.push({
				type: "label",
				id: "error",
				text: state.error
			});
			else if (state.phase === "ready" && state.items.length === 0) items.push({
				type: "label",
				id: "empty",
				text: t("sessionsEmpty")
			});
			else {
				for (const item of state.items) {
					const opening = openingId === item.chatSessionId;
					items.push({
						id: item.chatSessionId,
						label: opening ? `${item.title || item.chatSessionId}  ${t("sessionsOpening")}` : item.title || item.chatSessionId,
						disabled: openingId !== void 0
					});
				}
				if (state.phase === "loading-more") items.push({
					id: "::loading",
					label: t("sessionsLoading"),
					disabled: true
				});
			}
			const footer = [];
			if (state.phase === "signed-out") footer.push({
				id: MENU_SIGN_IN,
				label: t("sessionsSignIn")
			});
			else if (state.phase === "error" && state.items.length === 0) footer.push({
				id: MENU_RETRY,
				label: t("sessionsRetry")
			});
			else if (state.phase === "ready" || state.phase === "loading-more") footer.push({
				id: MENU_REFRESH,
				label: t("sessionsRefresh"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {})
			});
			return footer.length > 0 ? {
				items,
				footer
			} : { items };
		}
		//#endregion
		//#region src/client/host-menu.tsx
		const HOST_MENU_CSS_ID = "dsh-deepseek-web-free/host-menu";
		const HOST_MENU_CSS = [
			".dsw-web-menu{z-index:1100;box-sizing:border-box;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);border-radius:12px;flex-direction:column;padding:4px;display:flex;overflow:hidden}",
			".dsw-web-menu-viewport{flex:1 1 auto;flex-direction:column;min-height:0;display:flex;overflow-y:auto}",
			".dsw-web-menu-footer{flex:none;flex-direction:column;margin-top:4px;padding-top:4px;border-top:1px solid var(--dsw-alias-border-l2);display:flex}",
			".dsw-web-menu-item{cursor:pointer;width:100%;min-height:40px;color:var(--dsw-alias-label-primary);text-align:left;background:transparent;border:none;border-radius:10px;align-items:center;gap:8px;padding:8px 10px;font:inherit;font-size:14px;line-height:22px;display:flex}",
			".dsw-web-menu-item:hover:not(:disabled),.dsw-web-menu-item:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
			".dsw-web-menu-item:disabled{opacity:.4;cursor:default}",
			".dsw-web-menu-item-icon{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-secondary)}",
			".dsw-web-menu-item-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}",
			".dsw-web-menu-label{color:var(--dsw-alias-label-tertiary);padding:8px 10px;font-size:12px;line-height:18px}",
			".dsw-web-menu-separator{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l2);border:none}",
			".dsw-web-menu-sentinel{flex:none;height:1px;width:100%;pointer-events:none}"
		].join("");
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(HOST_MENU_CSS_ID)}]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-deepseek-web-free";
			tag.dataset.pluginCss = HOST_MENU_CSS_ID;
			tag.textContent = HOST_MENU_CSS;
			document.head.appendChild(tag);
		}
		function HostMenuPanel(props) {
			const footer = props.footer;
			const viewportRef = (0, react.useRef)(null);
			const sentinelRef = (0, react.useRef)(null);
			const onReachEnd = props.onReachEnd;
			const onReachEndRef = (0, react.useRef)(onReachEnd);
			onReachEndRef.current = onReachEnd;
			(0, react.useEffect)(() => {
				if (onReachEnd === void 0) return;
				const root = viewportRef.current;
				const sentinel = sentinelRef.current;
				if (root === null || sentinel === null) return;
				if (typeof IntersectionObserver === "undefined") return;
				const observer = new IntersectionObserver((entries) => {
					if (entries.some((entry) => entry.isIntersecting)) onReachEndRef.current?.();
				}, {
					root,
					rootMargin: "48px 0px",
					threshold: 0
				});
				observer.observe(sentinel);
				return () => observer.disconnect();
			}, [onReachEnd, props.items.length]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: props.panelRef,
				className: "dsw-web-menu",
				role: "menu",
				"aria-label": props.label,
				style: props.style,
				onKeyDown: props.onKeyDown,
				onClick: (event) => event.stopPropagation(),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: viewportRef,
					className: "dsw-web-menu-viewport",
					role: "presentation",
					children: [props.items.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HostMenuEntry, {
						entry,
						onSelect: props.onSelect
					}, entry.id)), onReachEnd !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: sentinelRef,
						className: "dsw-web-menu-sentinel",
						"aria-hidden": true
					}) : null]
				}), footer !== void 0 && footer.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsw-web-menu-footer",
					role: "presentation",
					children: footer.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HostMenuEntry, {
						entry,
						onSelect: props.onSelect
					}, entry.id))
				}) : null]
			});
		}
		function HostMenuEntry(props) {
			const { entry, onSelect } = props;
			if ("type" in entry && entry.type === "separator") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("hr", { className: "dsw-web-menu-separator" });
			if ("type" in entry && entry.type === "label") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsw-web-menu-label",
				role: "presentation",
				children: entry.text
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "menuitem",
				className: "dsw-web-menu-item",
				disabled: entry.disabled === true,
				onClick: () => onSelect(entry.id),
				children: [entry.icon !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsw-web-menu-item-icon",
					"aria-hidden": true,
					children: entry.icon
				}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsw-web-menu-item-label",
					children: entry.label
				})]
			});
		}
		const POPOVER_Z_INDEX = 1100;
		function clamp(value, min, max) {
			if (max < min) return min;
			return Math.min(Math.max(value, min), max);
		}
		/**
		* Sit a compact menu on the trigger. Prefer above it, growing upward, so a
		* changing list height does not jump from the top of the viewport.
		*/
		function positionSessionPopover(input) {
			const width = input.width ?? Math.max(input.anchor.width, 240);
			input.wide;
			const cap = Math.min(input.height ?? 320, 320);
			const gap = input.gap ?? 4;
			const margin = input.margin ?? 8;
			const maxLeft = Math.max(margin, input.viewport.width - width - margin);
			const left = clamp(input.anchor.left, margin, maxLeft);
			const spaceAbove = input.anchor.top - gap - margin;
			const spaceBelow = input.viewport.height - input.anchor.bottom - gap - margin;
			if ((spaceAbove >= 96 || spaceAbove >= spaceBelow) && spaceAbove > 0) return {
				left,
				width,
				maxHeight: Math.max(96, Math.min(cap, spaceAbove)),
				bottom: input.viewport.height - input.anchor.top + gap
			};
			return {
				left,
				width,
				maxHeight: Math.max(96, Math.min(cap, Math.max(spaceBelow, 96))),
				top: clamp(input.anchor.bottom + gap, margin, Math.max(margin, input.viewport.height - 96 - margin))
			};
		}
		const SIGNING_IN = /* @__PURE__ */ new Set([
			"detecting-browser",
			"installing-browser",
			"launching-browser",
			"waiting-for-login",
			"validating"
		]);
		function mergeItems(existing, incoming) {
			const seen = new Set(existing.map((item) => item.chatSessionId));
			const next = [...existing];
			for (const item of incoming) {
				if (seen.has(item.chatSessionId)) continue;
				seen.add(item.chatSessionId);
				next.push(item);
			}
			return next;
		}
		function nextAutoRefreshDelay(minMs, maxMs, random = Math.random) {
			if (maxMs <= minMs) return minMs;
			return Math.round(minMs + random() * (maxMs - minMs));
		}
		function defaultDelay(ms, signal) {
			return new Promise((resolve, reject) => {
				if (signal?.aborted) {
					reject(new DOMException("aborted", "AbortError"));
					return;
				}
				const timer = setTimeout(resolve, ms);
				const onAbort = () => {
					clearTimeout(timer);
					reject(new DOMException("aborted", "AbortError"));
				};
				signal?.addEventListener("abort", onAbort, { once: true });
			});
		}
		function defaultRemoteSessionsApi() {
			return {
				async status(signal) {
					return await pluginFetch(STATUS_PATH, { signal });
				},
				async login(signal) {
					await pluginFetch(LOGIN_PATH, {
						method: "POST",
						body: JSON.stringify({ resetProfile: true }),
						signal
					});
				},
				async list(options) {
					return await pluginFetch(sessionsListPath({
						cursor: options?.cursor,
						refresh: options?.refresh
					}), { signal: options?.signal });
				},
				async materialize(chatSessionId, signal) {
					return await pluginFetch(materializePath(chatSessionId), {
						method: "POST",
						body: "{}",
						signal
					});
				}
			};
		}
		var RemoteSessionsController = class {
			api;
			generation = 0;
			inflight;
			loginAbort;
			syncTimer;
			syncing = false;
			/** True after a successful cursor page. Auto-refresh must not wipe those rows. */
			pagedBeyondFirst = false;
			listeners = /* @__PURE__ */ new Set();
			state = {
				phase: "idle",
				items: []
			};
			autoRefreshMinMs;
			autoRefreshMaxMs;
			loginPollMs;
			random;
			delay;
			constructor(api = defaultRemoteSessionsApi(), options) {
				this.api = api;
				this.autoRefreshMinMs = options?.autoRefreshMinMs ?? 1e3;
				this.autoRefreshMaxMs = options?.autoRefreshMaxMs ?? 4e3;
				this.loginPollMs = options?.loginPollMs ?? 400;
				this.random = options?.random ?? Math.random;
				this.delay = options?.delay ?? defaultDelay;
			}
			getSnapshot() {
				return this.state;
			}
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			startBackgroundSync() {
				if (this.syncing) return;
				this.syncing = true;
				this.armBackgroundSync();
			}
			stopBackgroundSync() {
				this.syncing = false;
				if (this.syncTimer !== void 0) {
					clearTimeout(this.syncTimer);
					this.syncTimer = void 0;
				}
			}
			cancel() {
				this.generation += 1;
				this.inflight?.abort();
				this.inflight = void 0;
				this.loginAbort?.abort();
				this.loginAbort = void 0;
				if (this.state.phase === "loading" || this.state.phase === "loading-more") this.emit(this.state.items.length === 0 ? {
					phase: "idle",
					items: []
				} : {
					phase: "ready",
					items: this.state.items,
					nextCursor: "nextCursor" in this.state ? this.state.nextCursor : void 0
				});
			}
			dispose() {
				this.stopBackgroundSync();
				this.cancel();
				this.listeners.clear();
			}
			async ensureLoaded(refresh = false) {
				if (!refresh && (this.state.phase === "ready" || this.inflight !== void 0)) return;
				await this.load({ refresh });
			}
			async refresh() {
				this.pagedBeyondFirst = false;
				await this.load({ refresh: true });
			}
			async retry() {
				await this.load({ refresh: this.state.items.length === 0 });
			}
			async loadMore() {
				if (this.state.phase !== "ready" || this.state.nextCursor === void 0) return;
				await this.load({ cursor: this.state.nextCursor });
			}
			async beginLogin() {
				this.loginAbort?.abort();
				const controller = new AbortController();
				this.loginAbort = controller;
				try {
					await this.api.login?.(controller.signal);
					if (controller.signal.aborted) return;
					this.emit({
						phase: "loading",
						items: []
					});
					const signedIn = await this.waitForSignedIn(controller.signal);
					if (controller.signal.aborted || !signedIn) {
						if (!controller.signal.aborted) this.emit({
							phase: "signed-out",
							items: []
						});
						return;
					}
					await this.load({ refresh: true });
				} catch (error) {
					if (controller.signal.aborted) return;
					if ((error instanceof PluginApiError ? error.code : void 0) === "MISSING_CREDENTIAL") {
						this.emit({
							phase: "signed-out",
							items: []
						});
						return;
					}
					this.emit({
						phase: "error",
						items: [],
						error: error instanceof Error ? error.message : String(error)
					});
				} finally {
					if (this.loginAbort === controller) this.loginAbort = void 0;
				}
			}
			async openRemote(chatSessionId) {
				return this.api.materialize(chatSessionId);
			}
			emit(state) {
				this.state = state;
				for (const listener of this.listeners) listener();
			}
			armBackgroundSync() {
				if (!this.syncing) return;
				if (this.syncTimer !== void 0) clearTimeout(this.syncTimer);
				const wait = nextAutoRefreshDelay(this.autoRefreshMinMs, this.autoRefreshMaxMs, this.random);
				this.syncTimer = setTimeout(() => {
					this.syncTimer = void 0;
					this.tickBackgroundSync();
				}, wait);
			}
			shouldSkipAutoRefresh() {
				return this.pagedBeyondFirst || this.inflight !== void 0 || this.loginAbort !== void 0 || this.state.phase === "loading" || this.state.phase === "loading-more";
			}
			async tickBackgroundSync() {
				if (!this.syncing) return;
				if (!this.shouldSkipAutoRefresh()) await this.load({
					refresh: true,
					source: "auto"
				});
				this.armBackgroundSync();
			}
			async waitForSignedIn(signal) {
				let sawSigningIn = false;
				while (!signal.aborted) {
					const status = await this.api.status(signal);
					if (signal.aborted) return false;
					if (status.status === "signed-in") return true;
					if (status.status === "error") {
						const message = status.message;
						throw new Error(typeof message === "string" ? message : "login failed");
					}
					if (SIGNING_IN.has(status.status)) sawSigningIn = true;
					else if (sawSigningIn && status.status === "signed-out") return false;
					await this.delay(this.loginPollMs, signal);
				}
				return false;
			}
			async load(options) {
				if (options.source === "auto" && this.shouldSkipAutoRefresh()) return;
				const gen = ++this.generation;
				this.inflight?.abort();
				const controller = new AbortController();
				this.inflight = controller;
				const kept = this.state.items;
				if (!(options.cursor === void 0 && kept.length > 0)) this.emit({
					phase: options.cursor !== void 0 ? "loading-more" : "loading",
					items: kept,
					...options.cursor === void 0 ? {} : { nextCursor: options.cursor }
				});
				try {
					const status = await this.api.status(controller.signal);
					if (gen !== this.generation) return;
					if (status.status !== "signed-in") {
						this.pagedBeyondFirst = false;
						this.emit({
							phase: "signed-out",
							items: []
						});
						return;
					}
					const page = await this.api.list({
						cursor: options.cursor,
						refresh: options.refresh === true && options.cursor === void 0,
						signal: controller.signal
					});
					if (gen !== this.generation) return;
					const items = options.cursor === void 0 ? page.items : mergeItems(kept, page.items);
					if (options.cursor !== void 0) this.pagedBeyondFirst = true;
					this.emit({
						phase: "ready",
						items,
						nextCursor: page.nextCursor
					});
				} catch (error) {
					if (gen !== this.generation || controller.signal.aborted) return;
					if ((error instanceof PluginApiError ? error.code : void 0) === "MISSING_CREDENTIAL") {
						this.emit({
							phase: "signed-out",
							items: kept
						});
						return;
					}
					this.emit({
						phase: "error",
						items: kept,
						error: error instanceof Error ? error.message : String(error)
					});
				} finally {
					if (this.inflight === controller) this.inflight = void 0;
				}
			}
		};
		//#endregion
		//#region src/client/DeepSeekSidebarAction.tsx
		const SIDEBAR_CSS_ID = "dsh-deepseek-web-free/sidebar-action";
		const SIDEBAR_CSS = [
			".dsw-web-sessions-layer{flex:none;align-items:center;width:100%;height:42px;margin:8px 0 0;display:flex;position:relative}",
			".dsw-web-sessions-layer[data-wide=\"0\"]{width:36px;height:36px;margin:0}",
			".dsw-web-sessions-badge{width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);cursor:pointer;background:transparent;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}",
			".dsw-web-sessions-badge:hover,.dsw-web-sessions-badge[data-active]{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsw-web-sessions-layer[data-wide=\"0\"] .dsw-web-sessions-badge{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:0;padding:0}",
			".dsw-web-sessions-icon{flex:none;display:inline-flex;align-items:center}",
			".dsw-web-sessions-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}"
		].join("");
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(SIDEBAR_CSS_ID)}]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-deepseek-web-free";
			tag.dataset.pluginCss = SIDEBAR_CSS_ID;
			tag.textContent = SIDEBAR_CSS;
			document.head.appendChild(tag);
		}
		function panelStyle$1(placement) {
			return {
				position: "fixed",
				left: placement.left,
				width: placement.width,
				maxHeight: placement.maxHeight,
				zIndex: POPOVER_Z_INDEX,
				...placement.bottom !== void 0 ? { bottom: placement.bottom } : { top: placement.top }
			};
		}
		function DeepSeekSidebarAction(props) {
			const t = props.t ?? ((key) => key);
			const wide = props.wide !== false;
			const [open, setOpen] = (0, react.useState)(false);
			const [openingId, setOpeningId] = (0, react.useState)();
			const [openError, setOpenError] = (0, react.useState)();
			const [placement, setPlacement] = (0, react.useState)();
			const rootRef = (0, react.useRef)(null);
			const triggerRef = (0, react.useRef)(null);
			const controllerRef = (0, react.useRef)();
			if (controllerRef.current === void 0) controllerRef.current = new RemoteSessionsController();
			const controller = controllerRef.current;
			const state = (0, react.useSyncExternalStore)((listener) => controller.subscribe(listener), () => controller.getSnapshot(), () => controller.getSnapshot());
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, setOpen);
			const placeNow = (0, react.useCallback)(() => {
				const trigger = triggerRef.current;
				if (trigger === null) return void 0;
				const rect = trigger.getBoundingClientRect();
				return positionSessionPopover({
					anchor: rect,
					viewport: {
						width: window.innerWidth,
						height: window.innerHeight
					},
					wide,
					width: Math.max(rect.width, 220)
				});
			}, [wide]);
			(0, react.useEffect)(() => {
				controller.startBackgroundSync();
				controller.ensureLoaded();
			}, [controller]);
			(0, react.useEffect)(() => {
				if (!open) {
					setOpeningId(void 0);
					return;
				}
				setOpenError(void 0);
				controller.ensureLoaded();
			}, [open, controller]);
			(0, react.useLayoutEffect)(() => {
				if (!open) return;
				const update = () => {
					const next = placeNow();
					if (next !== void 0) setPlacement(next);
				};
				update();
				window.addEventListener("resize", update);
				window.addEventListener("scroll", update, true);
				return () => {
					window.removeEventListener("resize", update);
					window.removeEventListener("scroll", update, true);
				};
			}, [
				open,
				placeNow,
				state.items.length,
				state.phase
			]);
			(0, react.useEffect)(() => () => controller.dispose(), [controller]);
			const menu = sessionMenuEntries(state, t, {
				openingId,
				error: openError
			});
			const onSelect = (id) => {
				if (id === "::refresh") {
					controller.refresh();
					return;
				}
				if (id === "::retry") {
					controller.retry();
					return;
				}
				if (id === "::signin") {
					controller.beginLogin();
					return;
				}
				if (id.startsWith("::")) return;
				openRemote(id);
			};
			const openRemote = async (chatSessionId) => {
				if (openingId !== void 0) return;
				setOpeningId(chatSessionId);
				setOpenError(void 0);
				try {
					const result = await controller.openRemote(chatSessionId);
					await props.openSession?.(result.sessionId);
					setOpen(false);
					triggerRef.current?.focus();
				} catch (error) {
					setOpenError(error instanceof Error ? error.message : t("sessionsOpenFailed"));
				} finally {
					setOpeningId(void 0);
				}
			};
			const onReachEnd = (0, react.useCallback)(() => {
				controller.loadMore();
			}, [controller]);
			const onKeyDown = (event) => {
				if (event.key !== "Escape") return;
				event.stopPropagation();
				setOpen(false);
				triggerRef.current?.focus();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: "dsw-web-sessions-layer",
				"data-wide": wide ? "1" : "0",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					ref: triggerRef,
					type: "button",
					className: "dsw-web-sessions-badge",
					"data-active": open ? "" : void 0,
					"aria-label": t("sessionsAction"),
					"aria-expanded": open,
					"aria-haspopup": "menu",
					onClick: () => {
						if (open) {
							setOpen(false);
							return;
						}
						const next = placeNow();
						if (next !== void 0) setPlacement(next);
						setOpen(true);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsw-web-sessions-icon",
						"aria-hidden": true,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutlineRegular, { size: wide ? 14 : 18 })
					}), wide ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsw-web-sessions-label",
						children: t("sessionsAction")
					}) : null]
				}), open && placement !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HostMenuPanel, {
					label: t("sessionsTitle"),
					items: menu.items,
					footer: menu.footer,
					onSelect,
					onKeyDown,
					onReachEnd: state.phase === "ready" && state.nextCursor !== void 0 ? onReachEnd : void 0,
					style: panelStyle$1(placement)
				}) : null]
			});
		}
		//#endregion
		//#region src/client/WorkspaceForkPopover.tsx
		function workspaceMenuEntries(t, workspaces, options) {
			const items = [];
			if (options?.error !== void 0) items.push({
				type: "label",
				id: "fork-error",
				text: options.error
			});
			if (workspaces.length === 0) items.push({
				type: "label",
				id: "fork-empty",
				text: t("forkEmptyWorkspaces")
			});
			else for (const workspace of workspaces) items.push({
				id: workspace.id,
				label: workspace.title || workspace.path,
				disabled: options?.pending === true
			});
			return {
				items,
				footer: [{
					id: "::cancel",
					label: t("forkCancel"),
					disabled: options?.pending === true
				}]
			};
		}
		//#endregion
		//#region src/client/ForkToWorkspaceAction.tsx
		const FORK_CSS_ID = "dsh-deepseek-web-free/fork-action";
		const FORK_CSS = [
			".dsw-web-fork-layer{position:relative;display:inline-flex;order:1;flex:none}",
			"[data-turn-tail] [class*=\"actions\"]>span[class*=\"timeEnd\"],[data-turn-tail] [class*=\"actions\"]>span[class*=\"timeStart\"]{order:2}",
			".dsw-web-fork-action{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:6px;border:none;border-radius:28px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}",
			".dsw-web-fork-action:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dsw-web-fork-action:disabled{opacity:.4;cursor:default}"
		].join("");
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(FORK_CSS_ID)}]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-deepseek-web-free";
			tag.dataset.pluginCss = FORK_CSS_ID;
			tag.textContent = FORK_CSS;
			document.head.appendChild(tag);
		}
		function panelStyle(placement) {
			return {
				position: "fixed",
				left: placement.left,
				width: placement.width,
				maxHeight: placement.maxHeight,
				zIndex: POPOVER_Z_INDEX,
				...placement.bottom !== void 0 ? { bottom: placement.bottom } : { top: placement.top }
			};
		}
		function ForkToWorkspaceAction(props) {
			const t = props.t ?? ((key) => key);
			const messageId = props.messageId;
			const sourceSessionId = props.sourceSessionId ?? props.sessionId;
			const [open, setOpen] = (0, react.useState)(false);
			const [pending, setPending] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			const [workspaces, setWorkspaces] = (0, react.useState)([]);
			const [placement, setPlacement] = (0, react.useState)();
			const rootRef = (0, react.useRef)(null);
			const triggerRef = (0, react.useRef)(null);
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, setOpen);
			const visibleWorkspaces = (0, react.useMemo)(() => workspaces.filter((workspace) => workspace.path.length > 0), [workspaces]);
			const menu = workspaceMenuEntries(t, visibleWorkspaces, {
				pending,
				error
			});
			const placeNow = (0, react.useCallback)(() => {
				const trigger = triggerRef.current;
				if (trigger === null) return void 0;
				const rect = trigger.getBoundingClientRect();
				return positionSessionPopover({
					anchor: rect,
					viewport: {
						width: window.innerWidth,
						height: window.innerHeight
					},
					wide: true,
					width: Math.max(rect.width, 220)
				});
			}, []);
			(0, react.useLayoutEffect)(() => {
				if (!open) return;
				const update = () => {
					const next = placeNow();
					if (next !== void 0) setPlacement(next);
				};
				update();
				window.addEventListener("resize", update);
				window.addEventListener("scroll", update, true);
				return () => {
					window.removeEventListener("resize", update);
					window.removeEventListener("scroll", update, true);
				};
			}, [
				open,
				placeNow,
				visibleWorkspaces.length
			]);
			if (messageId === void 0 || sourceSessionId === void 0) return null;
			const prefetch = () => {
				if (props.loadWorkspaces === void 0) return;
				props.loadWorkspaces().then(setWorkspaces).catch(() => void 0);
			};
			const onOpen = async () => {
				setError(void 0);
				const next = placeNow();
				if (next !== void 0) setPlacement(next);
				setOpen(true);
				try {
					setWorkspaces(await (props.loadWorkspaces?.() ?? Promise.resolve([])));
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("forkFailed"));
				}
			};
			const onSelect = async (id) => {
				if (id === "::cancel") {
					setOpen(false);
					triggerRef.current?.focus();
					return;
				}
				if (pending) return;
				setPending(true);
				setError(void 0);
				try {
					const result = await pluginFetch(FORK_PATH, {
						method: "POST",
						body: JSON.stringify({
							sourceSessionId,
							messageId,
							workspaceId: id
						})
					});
					if (typeof result.childSessionId !== "string") throw new Error(t("forkFailed"));
					await props.openSession?.(result.childSessionId);
					setOpen(false);
					triggerRef.current?.focus();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("forkFailed"));
				} finally {
					setPending(false);
				}
			};
			const onKeyDown = (event) => {
				if (event.key !== "Escape") return;
				event.stopPropagation();
				setOpen(false);
				triggerRef.current?.focus();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: "dsw-web-fork-layer",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: t("forkAction"),
					side: "bottom",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						ref: triggerRef,
						type: "button",
						className: "dsw-web-fork-action",
						"aria-label": t("forkAction"),
						"aria-expanded": open,
						"aria-haspopup": "menu",
						disabled: pending,
						onMouseEnter: prefetch,
						onFocus: prefetch,
						onClick: () => {
							if (open) setOpen(false);
							else onOpen();
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, {})
					})
				}), open && placement !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HostMenuPanel, {
					label: t("forkTitle"),
					items: menu.items,
					footer: menu.footer,
					onSelect: (id) => {
						onSelect(id);
					},
					onKeyDown,
					style: panelStyle(placement)
				}) : null]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const en = {
			nav: "DeepSeek Web",
			title: "DeepSeek Web",
			intro: "Sign in with chat.deepseek.com in an isolated browser. DSH never uses your everyday Chrome profile.",
			loadingAccount: "Loading account…",
			signedIn: "Signed in",
			signedOut: "Not signed in",
			detectingBrowser: "Looking for a browser…",
			installingBrowser: "Installing a managed browser…",
			launchingBrowser: "Opening the isolated browser…",
			waitingForLogin: "Waiting for you to sign in…",
			validating: "Validating the captured session…",
			signIn: "Sign in with DeepSeek",
			loginAgain: "Sign in again",
			reconnect: "Reconnect",
			signOut: "Sign out",
			cancel: "Cancel",
			working: "Working…",
			doctor: "Run diagnostics",
			diagnostics: "Diagnostics",
			diagnosticsIntro: "Checks whether a session is signed in and whether the PoW solver is available.",
			requestFailed: "The DeepSeek Web account request failed.",
			account: "Account",
			browser: "Browser",
			sessionsAction: "DeepSeek Web chats",
			sessionsTitle: "DeepSeek Web chats",
			sessionsEmpty: "No conversations yet.",
			sessionsSignedOut: "Sign in to browse DeepSeek Web conversations.",
			sessionsLoading: "Loading conversations…",
			sessionsRefresh: "Refresh",
			sessionsRetry: "Retry",
			sessionsOpening: "Opening…",
			sessionsOpenFailed: "Could not open that conversation.",
			sessionsSignIn: "Sign in",
			forkAction: "Fork to Workspace",
			forkTitle: "Fork to Workspace",
			forkIntro: "Create an independent Harness session in a workspace. Later replies will not change the original conversation.",
			forkEmptyWorkspaces: "No workspaces yet. Create one in the sidebar first.",
			forkCancel: "Cancel",
			forking: "Forking…",
			forkFailed: "Could not fork this conversation."
		};
		const zh = {
			nav: "DeepSeek Web",
			title: "DeepSeek Web",
			intro: "通过隔离浏览器登录 chat.deepseek.com。DSH 不会使用你日常的 Chrome 配置。",
			loadingAccount: "正在加载账户信息…",
			signedIn: "已登录",
			signedOut: "尚未登录",
			detectingBrowser: "正在查找浏览器…",
			installingBrowser: "正在安装托管浏览器…",
			launchingBrowser: "正在打开隔离浏览器…",
			waitingForLogin: "请在弹出的窗口中登录…",
			validating: "正在校验登录会话…",
			signIn: "使用 DeepSeek 登录",
			loginAgain: "重新登录",
			reconnect: "重新连接",
			signOut: "退出登录",
			cancel: "取消",
			working: "处理中…",
			doctor: "运行诊断",
			diagnostics: "诊断",
			diagnosticsIntro: "检查当前是否已登录，以及 PoW 求解器是否可用。",
			requestFailed: "DeepSeek Web 账户请求失败。",
			account: "账号",
			browser: "浏览器",
			sessionsAction: "DeepSeek Web 会话",
			sessionsTitle: "DeepSeek Web 会话",
			sessionsEmpty: "还没有会话。",
			sessionsSignedOut: "登录后即可浏览 DeepSeek Web 会话。",
			sessionsLoading: "正在加载会话…",
			sessionsRefresh: "刷新",
			sessionsRetry: "重试",
			sessionsOpening: "正在打开…",
			sessionsOpenFailed: "无法打开该会话。",
			sessionsSignIn: "去登录",
			forkAction: "派生到工作区",
			forkTitle: "派生到工作区",
			forkIntro: "在选定工作区创建独立的 Harness 会话。之后的续聊不会写入原来的对话。",
			forkEmptyWorkspaces: "还没有工作区。请先在侧栏创建一个。",
			forkCancel: "取消",
			forking: "正在派生…",
			forkFailed: "无法派生该会话。"
		};
		//#endregion
		//#region src/client/slot-ids.ts
		const SIDEBAR_ACTION_SLOT = "sidebar.footer.action";
		const SIDEBAR_ACTION_ID = "deepseek-web";
		const FORK_ACTION_SLOT = "conversation.chat.assistant-actions";
		const FORK_ACTION_ID = "deepseek-web-fork";
		//#endregion
		//#region src/client/wait-for-session.ts
		function sessionIsListed(sessions, sessionId) {
			const snapshot = sessions?.list?.getSnapshot?.();
			if (snapshot === void 0) return false;
			if (Array.isArray(snapshot.ids) && snapshot.ids.includes(sessionId)) return true;
			if (snapshot.byId !== void 0 && snapshot.byId[sessionId] !== void 0) return true;
			if (Array.isArray(snapshot.items) && snapshot.items.some((row) => row.id === sessionId)) return true;
			return false;
		}
		async function waitForListedSession(sessions, sessionId, options) {
			if (sessions === void 0 || typeof sessions.open !== "function") throw new Error("Harness sessions are unavailable");
			const timeoutMs = options?.timeoutMs ?? 8e3;
			const deadline = Date.now() + timeoutMs;
			const listed = () => sessionIsListed(sessions, sessionId);
			if (listed()) return;
			await sessions.refresh?.();
			if (listed()) return;
			await new Promise((resolve, reject) => {
				let settled = false;
				let poll;
				let timer;
				let unsubscribe;
				const finish = (next) => {
					if (settled) return;
					settled = true;
					if (poll !== void 0) clearInterval(poll);
					if (timer !== void 0) clearTimeout(timer);
					unsubscribe?.();
					options?.signal?.removeEventListener("abort", onAbort);
					next();
				};
				const onAbort = () => {
					finish(() => reject(/* @__PURE__ */ new Error("cancelled")));
				};
				const check = () => {
					if (listed()) finish(resolve);
				};
				unsubscribe = sessions.list?.subscribe?.(check);
				options?.signal?.addEventListener("abort", onAbort);
				poll = setInterval(() => {
					if (options?.signal?.aborted) {
						onAbort();
						return;
					}
					Promise.resolve(sessions.refresh?.()).then(check, check);
				}, 50);
				timer = setTimeout(() => {
					finish(() => reject(/* @__PURE__ */ new Error("the conversation is not yet visible in Harness")));
				}, Math.max(0, deadline - Date.now()));
				check();
			});
		}
		async function openHarnessSession(sessions, sessionId, options) {
			await waitForListedSession(sessions, sessionId, options);
			sessions.open(sessionId);
		}
		//#endregion
		//#region src/client/index.tsx
		const name = "dsh-deepseek-web-free-client";
		const inject = [
			"slots",
			"locale",
			"sessions",
			"workspaces"
		];
		function workspaceChoices(workspaces) {
			return (workspaces?.list?.getSnapshot()?.items ?? []).flatMap((item) => {
				const id = item.workspaceId ?? item.id;
				if (id === void 0 || typeof item.path !== "string") return [];
				return [{
					id,
					title: item.title ?? item.path,
					path: item.path
				}];
			}).sort((left, right) => {
				if (left.title === "DeepSeek Chat") return -1;
				if (right.title === "DeepSeek Chat") return 1;
				return 0;
			});
		}
		function apply(ctx) {
			const namespace = "settings.deepseek-web";
			ctx.effect(() => ctx.locale.register(namespace, {
				zh,
				en
			}), "dsh-deepseek-web-free: settings copy");
			const t = ctx.locale.bind(namespace);
			const openSession = (sessionId) => openHarnessSession(ctx.sessions, sessionId);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "deepseek-web",
				order: 16,
				label: () => t("nav"),
				inject: () => ({ t })
			}, DeepSeekWebSettings));
			ctx.slots.inject(SIDEBAR_ACTION_SLOT, () => ctx.slots.register({
				name: SIDEBAR_ACTION_SLOT,
				id: SIDEBAR_ACTION_ID,
				order: 20,
				locale: namespace,
				inject: () => ({
					t,
					openSession
				})
			}, DeepSeekSidebarAction));
			ctx.slots.inject(FORK_ACTION_SLOT, () => ctx.slots.register({
				name: FORK_ACTION_SLOT,
				id: FORK_ACTION_ID,
				order: 100,
				locale: namespace,
				inject: (sessionId) => ({
					t,
					sourceSessionId: sessionId,
					openSession,
					loadWorkspaces: async () => {
						await ctx.workspaces?.refresh?.();
						return workspaceChoices(ctx.workspaces);
					}
				})
			}, ForkToWorkspaceAction));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
