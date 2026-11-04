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
		const STATUS_PATH = "/plugins/dsh-deepseek-web/auth/status";
		const LOGIN_PATH = "/plugins/dsh-deepseek-web/auth/login";
		const CANCEL_PATH = "/plugins/dsh-deepseek-web/auth/cancel";
		const LOGOUT_PATH = "/plugins/dsh-deepseek-web/auth/logout";
		const DOCTOR_PATH = "/plugins/dsh-deepseek-web/doctor";
		const FORK_PATH = "/plugins/dsh-deepseek-web/fork";
		const WEBPANEL_TOKEN_PATH = "/plugins/dsh-deepseek-web/webpanel/token";
		const IMPORT_PATH = "/plugins/dsh-deepseek-web/auth/import";
		/** Pushes a token captured inside the web panel back to the Host credential store. */
		async function importTokenFromPanel(token) {
			await pluginFetch(IMPORT_PATH, {
				method: "POST",
				body: JSON.stringify({ token })
			});
		}
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
		//#region src/client/webpanel-bus.ts
		const listeners$1 = /* @__PURE__ */ new Set();
		function dispatch(request) {
			for (const listener of [...listeners$1]) try {
				listener(request);
			} catch {}
		}
		function openWebPanel(url) {
			dispatch(url === void 0 ? {} : { url });
		}
		/** Ask the panel to flip between hidden and shown (only meaningful for the ball). */
		function toggleWebPanel() {
			dispatch({ toggle: true });
		}
		function subscribeWebPanel(listener) {
			listeners$1.add(listener);
			return () => {
				listeners$1.delete(listener);
			};
		}
		//#endregion
		//#region src/client/webpanel-prefs.ts
		const WEBPANEL_DEFAULT_URL = "https://chat.deepseek.com";
		/**
		* One storage identity for every panel surface. The docked sidebar tab and the
		* floating whale window MUST pass the same value: the Desktop browser host keys
		* its partition by it, so a mismatch silently produces two separate browser
		* sessions (sign in on one surface, the other still shows signed out).
		*/
		const WEBPANEL_WORKSPACE_KEY = "dsh-deepseek-web-free-panel";
		const STORAGE_KEY = "dsh.deepseek-web.webpanel.v1";
		const DEFAULT_WEBPANEL_PREFS = {
			enabled: true,
			position: "sidebar",
			ball: null,
			winOffset: null,
			win: null,
			winSize: null
		};
		const listeners = /* @__PURE__ */ new Set();
		function readPoint(value) {
			if (value === null || typeof value !== "object") return null;
			const candidate = value;
			if (typeof candidate.x !== "number" || typeof candidate.y !== "number") return null;
			if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return null;
			return {
				x: Math.round(candidate.x),
				y: Math.round(candidate.y)
			};
		}
		function readSize(value) {
			if (value === null || typeof value !== "object") return null;
			const candidate = value;
			if (typeof candidate.width !== "number" || typeof candidate.height !== "number") return null;
			if (!Number.isFinite(candidate.width) || !Number.isFinite(candidate.height)) return null;
			return {
				width: Math.round(candidate.width),
				height: Math.round(candidate.height)
			};
		}
		function normalizePosition(value) {
			return value === "ball" || value === "float" ? "ball" : "sidebar";
		}
		/** Derive a ball-relative offset from the legacy absolute window position. */
		function deriveOffset(win, ball) {
			if (win === null || ball === null) return null;
			return {
				x: win.x - ball.x,
				y: win.y - ball.y
			};
		}
		function loadPrefs() {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw === null || raw.length === 0) return { ...DEFAULT_WEBPANEL_PREFS };
				const parsed = JSON.parse(raw);
				const ball = readPoint(parsed.ball);
				const legacyWin = readPoint(parsed.win);
				return {
					enabled: parsed.enabled !== false,
					position: normalizePosition(parsed.position),
					ball,
					winOffset: readPoint(parsed.winOffset) ?? deriveOffset(legacyWin, ball),
					win: legacyWin,
					winSize: readSize(parsed.winSize)
				};
			} catch {
				return { ...DEFAULT_WEBPANEL_PREFS };
			}
		}
		function savePrefs(next) {
			const normalized = {
				enabled: next.enabled,
				position: normalizePosition(next.position),
				ball: readPoint(next.ball),
				winOffset: readPoint(next.winOffset),
				win: null,
				winSize: readSize(next.winSize)
			};
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
			} catch {}
			for (const listener of [...listeners]) try {
				listener(normalized);
			} catch {}
		}
		function subscribePrefs(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
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
			const [prefs, setPrefs] = (0, react.useState)(() => typeof localStorage === "undefined" ? { ...DEFAULT_WEBPANEL_PREFS } : loadPrefs());
			const signingIn = isSigningIn(state.status);
			(0, react.useEffect)(() => subscribePrefs((next) => setPrefs(next)), []);
			const updatePrefs = (next) => {
				setPrefs(next);
				savePrefs(next);
			};
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
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						style: titleStyle,
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: introStyle,
						children: t("intro")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: introStyle,
						children: t("introPermanent")
					})
				] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
					style: rowsStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
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
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
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
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							style: rowCardStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									style: cardTitleStyle,
									children: t("panelSection")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: cardIntroStyle,
									children: t("panelSectionIntro")
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: rowHeadStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: rowIdentityStyle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: prefs.enabled ? "done" : "warning" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: rowNameStyle,
											children: t("panelEnable")
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: rowActionsStyle,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											size: "sm",
											onClick: () => updatePrefs({
												...prefs,
												enabled: !prefs.enabled
											}),
											children: prefs.enabled ? t("panelOn") : t("panelOff")
										})
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: metaStyle,
									children: t("panelEnableHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: rowHeadStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: rowNameStyle,
										children: t("panelPosition")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: rowActionsStyle,
										children: [["sidebar", t("panelPositionSidebar")], ["ball", t("panelPositionBall")]].map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: prefs.position === value ? "primary" : "ghost",
											size: "sm",
											onClick: () => updatePrefs({
												...prefs,
												position: value
											}),
											children: label
										}, value))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: metaStyle,
									children: t("panelPositionHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: editorActionsStyle,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										disabled: !prefs.enabled,
										onClick: () => {
											if (prefs.position === "sidebar" && props.openPanelTab !== void 0) props.openPanelTab();
											else openWebPanel();
										},
										children: t("panelOpenNow")
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: metaStyle,
									children: t("panelShortcut")
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/WebPanelAuthBanner.tsx
		const CSS_ID = "dsh-deepseek-web-free/webpanel-auth";
		const CSS = [
			".dsw-webpanel-auth{flex:none;display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d99b1a) 12%,transparent)}",
			".dsw-webpanel-auth-text{flex:1 1 auto;min-width:0;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}",
			".dsw-webpanel-auth-btn{flex:none;height:24px;padding:0 10px;border:0;border-radius:999px;background:var(--dsw-alias-brand-primary,#4d6bfe);color:#fff;font:inherit;font-size:11px;cursor:pointer}",
			".dsw-webpanel-auth-btn:disabled{opacity:.6;cursor:default}"
		];
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_ID)}]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = CSS.join("");
			document.head.append(tag);
		}
		/**
		* Shown inside the panel whenever the Host has no stored credential. It exists so a
		* brand-new user learns that one sign-in is permanent, instead of signing in inside
		* the page and losing that session when the in-memory guest partition dies.
		*
		* It also closes the reverse direction: a sign-in performed inside the embedded page
		* is read back and pushed to the Host store, so the settings page and the model list
		* pick it up without any manual step.
		*/
		function WebPanelAuthBanner(props) {
			const t = props.t;
			const [state, setState] = (0, react.useState)("unknown");
			const [signingIn, setSigningIn] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			const [syncError, setSyncError] = (0, react.useState)("");
			const signedInRef = (0, react.useRef)(props.onSignedIn);
			signedInRef.current = props.onSignedIn;
			const signedOutRef = (0, react.useRef)(props.onSignedOut);
			signedOutRef.current = props.onSignedOut;
			const readTokenRef = (0, react.useRef)(props.readPageToken);
			readTokenRef.current = props.readPageToken;
			const previous = (0, react.useRef)("unknown");
			const lastTried = (0, react.useRef)("");
			const readStatus = (0, react.useCallback)(async () => {
				try {
					const signedIn = (await pluginFetch(STATUS_PATH))?.status === "signed-in";
					const before = previous.current;
					previous.current = signedIn ? "in" : "out";
					setState(signedIn ? "in" : "out");
					if (before === "in" && !signedIn) signedOutRef.current?.();
					if (before !== "in" && signedIn) signedInRef.current?.();
					return signedIn;
				} catch {
					setState("unknown");
					return false;
				}
			}, []);
			/**
			* Poll both sides. Reading the page token on a timer (not only on navigation)
			* is what makes "sign in inside the embedded page" work reliably: DeepSeek's
			* login is a single-page flow, so no navigation event is guaranteed.
			*/
			const tick = (0, react.useCallback)(async () => {
				if (await readStatus()) {
					setSyncError("");
					return;
				}
				const reader = readTokenRef.current;
				if (reader === void 0) return;
				const token = await reader();
				if (token === null || token.length === 0 || token === lastTried.current) return;
				lastTried.current = token;
				try {
					await importTokenFromPanel(token);
					setSyncError("");
					await readStatus();
				} catch (caught) {
					setSyncError(caught instanceof Error ? caught.message : String(caught));
				}
			}, [readStatus]);
			(0, react.useEffect)(() => {
				tick();
				const timer = window.setInterval(() => {
					tick();
				}, 3e3);
				return () => window.clearInterval(timer);
			}, [tick]);
			const signIn = (0, react.useCallback)(async () => {
				if (signingIn) return;
				setSigningIn(true);
				setFailed(false);
				setSyncError("");
				try {
					await pluginFetch(LOGIN_PATH, {
						method: "POST",
						body: JSON.stringify({})
					});
					for (let attempt = 0; attempt < 80; attempt += 1) {
						await new Promise((resolve) => {
							window.setTimeout(resolve, 1500);
						});
						if (await readStatus()) {
							signedInRef.current?.();
							return;
						}
					}
					setFailed(true);
				} catch {
					setFailed(true);
				} finally {
					setSigningIn(false);
				}
			}, [readStatus, signingIn]);
			if (state !== "out") return null;
			const text = syncError.length > 0 ? `同步失败：${syncError}` : failed ? t("panelSignInFailed") : t("panelSignInHint");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsw-webpanel-auth",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsw-webpanel-auth-text",
					children: text
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dsw-webpanel-auth-btn",
					disabled: signingIn,
					onClick: () => {
						signIn();
					},
					children: signingIn ? t("panelSigningIn") : t("panelSignInAction")
				})]
			});
		}
		//#endregion
		//#region src/client/webpanel-guest.ts
		const EMPTY_SNAPSHOT = {
			phase: "idle",
			url: "",
			title: "",
			loading: false,
			canGoBack: false,
			canGoForward: false
		};
		function desktopBrowserBridge() {
			const carrier = globalThis.dshDesktop;
			if (carrier === void 0 || carrier === null) return void 0;
			if (carrier.protocolVersion !== 1) return void 0;
			const bridge = carrier.browser;
			if (bridge === void 0 || typeof bridge.acquire !== "function") return void 0;
			return bridge;
		}
		/**
		* Seeds `localStorage.userToken` before the SPA boots.
		*
		* chat.deepseek.com persists its session as
		* `userToken = {"value":"<token>","__version":"0"}` in localStorage; writing
		* that value and reloading makes the page sign itself in without a second
		* interactive login. PoW, WebSocket and every API call then run natively inside
		* the guest, which is why no HTTP proxy is needed.
		*/
		function seedScript(token) {
			return [
				"(function () {",
				"  try {",
				"    var wanted = " + JSON.stringify(JSON.stringify({
					value: token,
					__version: "0"
				})) + ";",
				"    var current = localStorage.getItem(\"userToken\");",
				"    if (current === wanted) return \"unchanged\";",
				"    localStorage.setItem(\"userToken\", wanted);",
				"    return \"seeded\";",
				"  } catch (error) {",
				"    return \"failed:\" + (error && error.message ? error.message : String(error));",
				"  }",
				"})()"
			].join("\n");
		}
		/**
		* Reads the session the page itself established, if any. Returns the bare token
		* string (never the JSON envelope) so it can be validated by the Host.
		*/
		const HARVEST_SCRIPT = [
			"(function () {",
			"  function unwrap(raw) {",
			"    if (typeof raw !== \"string\" || raw.length === 0) return null;",
			"    if (raw.charAt(0) !== \"{\") return raw;",
			"    try {",
			"      var parsed = JSON.parse(raw);",
			"      if (parsed && typeof parsed.value === \"string\") return parsed.value;",
			"      if (parsed && typeof parsed.token === \"string\") return parsed.token;",
			"      return null;",
			"    } catch (error) {",
			"      return null;",
			"    }",
			"  }",
			"  function looksLikeToken(value) {",
			"    return typeof value === \"string\" && value.length >= 24 && /[A-Za-z0-9._-]{24,}/.test(value);",
			"  }",
			"  try {",
			"    // The page normally keeps its session here; accept both the JSON envelope and a bare string.",
			"    var direct = unwrap(localStorage.getItem(\"userToken\"));",
			"    if (looksLikeToken(direct)) return direct;",
			"    // Fallbacks: any localStorage entry whose key mentions a token, plus a JWT-looking value.",
			"    var best = null;",
			"    for (var i = 0; i < localStorage.length; i += 1) {",
			"      var key = String(localStorage.key(i) || \"\");",
			"      var value = unwrap(localStorage.getItem(key));",
			"      if (!looksLikeToken(value)) continue;",
			"      if (key.toLowerCase().indexOf(\"token\") >= 0) return value;",
			"      if (best === null && value.indexOf(\"eyJ\") === 0) best = value;",
			"    }",
			"    return best;",
			"  } catch (error) {",
			"    return null;",
			"  }",
			"})()"
		].join("\n");
		var WebPanelGuest = class {
			options;
			element;
			lease;
			releaseOpenRequest;
			seeded = /* @__PURE__ */ new Set();
			snapshot = { ...EMPTY_SNAPSHOT };
			listeners = /* @__PURE__ */ new Set();
			pendingUrl;
			disposed = false;
			/** Self-heal for the "blank window" case: retry a navigation that never left about:blank. */
			loadRetries = 0;
			watchdog;
			/** Reverse sync bookkeeping: tokens already handed back to the Host. */
			harvested = /* @__PURE__ */ new Set();
			harvestRetries = 0;
			constructor(options) {
				this.options = options;
			}
			getSnapshot = () => this.snapshot;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			update(patch) {
				this.snapshot = {
					...this.snapshot,
					...patch
				};
				for (const listener of [...this.listeners]) listener();
			}
			readGuest() {
				const element = this.element;
				if (element === void 0) return;
				try {
					this.update({
						url: element.getURL(),
						title: element.getTitle(),
						loading: element.isLoading(),
						canGoBack: element.canGoBack(),
						canGoForward: element.canGoForward()
					});
				} catch {}
			}
			/** Creates the guest element and mounts it into `container`. */
			async attach(container, url) {
				if (this.disposed) return;
				if (this.element !== void 0) {
					this.pendingUrl = url;
					this.navigate(url);
					return;
				}
				const bridge = desktopBrowserBridge();
				if (bridge === void 0) {
					this.update({
						phase: "error",
						message: "desktop-browser-unavailable"
					});
					return;
				}
				this.pendingUrl = url;
				this.update({ phase: "attaching" });
				let reservation;
				try {
					reservation = await bridge.acquire(this.options.workspaceKey);
				} catch (error) {
					this.update({
						phase: "error",
						message: error instanceof Error ? error.message : String(error)
					});
					return;
				}
				if (this.disposed) {
					bridge.release(reservation.lease).catch(() => void 0);
					return;
				}
				this.lease = reservation.lease;
				const element = document.createElement("webview");
				element.className = "dsw-webpanel-webview";
				element.dataset.deepseekWebpanelFrame = "webview";
				element.setAttribute("name", reservation.lease);
				element.setAttribute("partition", reservation.partition);
				element.setAttribute("allowpopups", "");
				element.setAttribute("src", "about:blank#" + reservation.lease);
				this.element = element;
				this.releaseOpenRequest = bridge.onOpenRequested(reservation.lease, (target) => {
					this.options.onExternalLink(target);
				});
				element.addEventListener("dom-ready", () => {
					if (this.disposed) return;
					const current = element.getURL();
					this.update({ phase: "loading" });
					if (current.startsWith("about:blank")) {
						const target = this.pendingUrl;
						if (target !== void 0) this.navigate(target);
						return;
					}
					this.loadRetries = 0;
					this.disarmWatchdog();
					this.readGuest();
					this.seedToken(current);
					this.harvestToken(current);
				});
				element.addEventListener("did-navigate", () => {
					const current = element.getURL();
					if (current.length > 0 && !current.startsWith("about:")) {
						this.loadRetries = 0;
						this.disarmWatchdog();
						this.harvestRetries = 0;
					}
					this.readGuest();
				});
				element.addEventListener("did-navigate-in-page", () => {
					this.harvestRetries = 0;
					this.readGuest();
					this.harvestToken(element.getURL());
				});
				element.addEventListener("did-navigate-in-page", () => this.readGuest());
				element.addEventListener("did-start-loading", () => this.update({ loading: true }));
				element.addEventListener("did-stop-loading", () => {
					this.update({ loading: false });
					if (this.snapshot.phase !== "error") this.update({ phase: "ready" });
					this.readGuest();
					this.harvestToken(element.getURL());
				});
				element.addEventListener("page-title-updated", () => this.readGuest());
				element.addEventListener("did-fail-load", (event) => {
					const detail = event;
					if (detail.isMainFrame === false) return;
					if (detail.errorCode === -3) return;
					this.update({
						phase: "error",
						message: detail.errorDescription ?? "load-failed"
					});
				});
				element.addEventListener("destroyed", () => {
					this.element = void 0;
					this.disarmWatchdog();
					this.update({
						...EMPTY_SNAPSHOT,
						phase: "idle"
					});
				});
				container.appendChild(element);
			}
			/**
			* Sometimes the guest never leaves about:blank (attach race, a swallowed
			* renderer error, a stale lease): a watchdog re-issues the navigation a few
			* times so the window self-heals instead of staying blank until manually
			* reloaded.
			*/
			armWatchdog() {
				this.disarmWatchdog();
				this.watchdog = window.setTimeout(() => {
					this.watchdog = void 0;
					const element = this.element;
					if (this.disposed || element === void 0) return;
					let current = "";
					try {
						current = element.getURL();
					} catch {
						return;
					}
					if (current.length > 0 && !current.startsWith("about:")) return;
					if (this.loadRetries >= 3) return;
					this.loadRetries += 1;
					const target = this.pendingUrl;
					if (target !== void 0) this.navigate(target);
				}, 6e3);
			}
			disarmWatchdog() {
				if (this.watchdog !== void 0) window.clearTimeout(this.watchdog);
				this.watchdog = void 0;
			}
			async seedToken(url) {
				const element = this.element;
				if (element === void 0) return;
				if (!url.startsWith("https://chat.deepseek.com")) return;
				if (this.seeded.has(url)) return;
				this.seeded.add(url);
				let token;
				try {
					token = await this.options.resolveToken();
				} catch {
					return;
				}
				if (token === void 0 || token.length === 0) return;
				if (this.element !== element) return;
				let outcome;
				try {
					outcome = await element.executeJavaScript(seedScript(token), true);
				} catch {
					return;
				}
				if (outcome === "seeded" && this.element === element) element.reload();
			}
			/**
			* Reverse sync: when the user signs in inside the guest, the page owns the
			* session (`localStorage.userToken`) while the Host credential store knows
			* nothing about it — and this guest partition is in-memory, so that session
			* dies with the window. Read it back so one sign-in inside the panel becomes a
			* permanent Host credential (settings page + model list + next restart).
			*/
			async harvestToken(url) {
				const element = this.element;
				if (element === void 0) return;
				if (!url.startsWith("https://chat.deepseek.com")) return;
				if (this.harvestRetries >= 8) return;
				this.harvestRetries += 1;
				let value;
				try {
					value = await element.executeJavaScript(HARVEST_SCRIPT, true);
				} catch {
					return;
				}
				if (typeof value !== "string" || value.length < 16) return;
				if (this.harvested.has(value)) return;
				let hostToken;
				try {
					hostToken = await this.options.resolveToken();
				} catch {
					hostToken = void 0;
				}
				if (hostToken === value) return;
				this.harvested.add(value);
				this.options.onPageToken?.(value);
			}
			navigate(url) {
				this.pendingUrl = url;
				const element = this.element;
				if (element === void 0) return;
				this.update({
					phase: "loading",
					url
				});
				this.armWatchdog();
				element.loadURL(url).catch((error) => {
					const message = error instanceof Error ? error.message : String(error);
					if (message.includes("ERR_ABORTED")) return;
					this.update({
						phase: "error",
						message
					});
				});
			}
			back() {
				this.element?.goBack();
			}
			forward() {
				this.element?.goForward();
			}
			reload() {
				const element = this.element;
				if (element === void 0) return;
				this.seeded.clear();
				element.reload();
			}
			/**
			* Reads the page-side session token, if the page holds one right now. Used by
			* the panel's slow poll so a sign-in done at any moment is picked up even when
			* no navigation event fires.
			*/
			async readPageToken() {
				const element = this.element;
				if (element === void 0) return null;
				try {
					const value = await element.executeJavaScript(HARVEST_SCRIPT, true);
					return typeof value === "string" && value.length >= 16 ? value : null;
				} catch {
					return null;
				}
			}
			/**
			* Drops the page-side session so this surface follows a Host-side sign-out.
			* Without this the guest keeps its own cookie/localStorage login and looks
			* signed in while the settings page already shows "signed out".
			*/
			async clearSession() {
				const element = this.element;
				if (element === void 0) return;
				this.seeded.clear();
				this.harvested.clear();
				this.harvestRetries = 0;
				try {
					await element.executeJavaScript("(function () { try { localStorage.removeItem(\"userToken\"); return \"ok\" } catch (error) { return \"err\" } })()", true);
				} catch {}
				element.reload();
			}
			stop() {
				this.element?.stop();
			}
			async dispose() {
				if (this.disposed) return;
				this.disposed = true;
				this.disarmWatchdog();
				this.releaseOpenRequest?.();
				this.releaseOpenRequest = void 0;
				const element = this.element;
				const lease = this.lease;
				this.element = void 0;
				this.lease = void 0;
				if (element !== void 0 && element.parentNode !== null) element.parentNode.removeChild(element);
				const bridge = desktopBrowserBridge();
				if (bridge !== void 0 && lease !== void 0) await bridge.release(lease).catch(() => void 0);
				this.update({
					...EMPTY_SNAPSHOT,
					phase: "idle"
				});
			}
		};
		//#endregion
		//#region src/client/DeepSeekWebPanel.tsx
		const PANEL_CSS_ID$1 = "dsh-deepseek-web-free/webpanel";
		const BALL_SIZE = 52;
		const BALL_MARGIN = 12;
		const WIN_WIDTH = 420;
		const WIN_HEIGHT = 640;
		const WIN_MIN_WIDTH = 320;
		const WIN_MIN_HEIGHT = 420;
		const DRAG_THRESHOLD = 4;
		const PANEL_CSS$1 = [
			".dsw-webpanel-host{position:fixed;inset:0;z-index:1200;pointer-events:none}",
			".dsw-webpanel-ball{position:fixed;width:52px;height:52px;padding:0;border-radius:50%;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 6px 20px rgba(0,0,0,.18);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;touch-action:none;user-select:none;transition:transform .12s ease,box-shadow .12s ease}",
			".dsw-webpanel-ball:hover{transform:translateY(-1px) scale(1.03);box-shadow:0 10px 26px rgba(0,0,0,.24)}",
			".dsw-webpanel-ball:active{transform:scale(.97)}",
			".dsw-webpanel-ball-icon{display:inline-flex;align-items:center;justify-content:center;pointer-events:none}",
			".dsw-webpanel-win{position:fixed;pointer-events:auto;display:flex;flex-direction:column;overflow:hidden;border-radius:14px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);box-shadow:0 18px 48px rgba(0,0,0,.28);animation:dsw-webpanel-in .16s ease-out}",
			"@keyframes dsw-webpanel-in{from{transform:translateY(8px) scale(.985);opacity:.4}to{transform:none;opacity:1}}",
			".dsw-webpanel-rz{position:absolute;z-index:3;touch-action:none}",
			".dsw-webpanel-rz-e{top:0;right:0;bottom:0;width:6px;cursor:ew-resize}",
			".dsw-webpanel-rz-s{left:0;right:0;bottom:0;height:6px;cursor:ns-resize}",
			".dsw-webpanel-rz-se{right:0;bottom:0;width:14px;height:14px;cursor:nwse-resize}",
			".dsw-webpanel-tab{display:flex;flex-direction:column;flex:1;min-height:0;height:100%;background:var(--dsw-alias-bg-base)}",
			".dsw-webpanel-head{flex:none;display:flex;align-items:center;height:44px;gap:6px;padding:0 8px;border-bottom:1px solid var(--dsw-alias-border-l2);cursor:move;user-select:none;touch-action:none}",
			".dsw-webpanel-head button,.dsw-webpanel-head input{cursor:auto}",
			".dsw-webpanel-iconbtn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .12s ease,color .12s ease;overflow:hidden}",
			".dsw-webpanel-iconbtn:hover{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}",
			".dsw-webpanel-iconbtn:disabled{opacity:.35;cursor:default;background:transparent;color:var(--dsw-alias-label-secondary)}",
			".dsw-webpanel-iconbtn-close:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent);color:var(--dsw-alias-state-error-primary)}",
			".dsw-webpanel-address{flex:1 1 0;min-width:90px;height:28px;margin:0 2px;padding:0 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none;text-overflow:ellipsis;cursor:text}",
			".dsw-webpanel-address:focus{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base)}",
			".dsw-webpanel-address::placeholder{color:var(--dsw-alias-label-tertiary)}",
			".dsw-webpanel-auth{flex:none;display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#d99b1a) 12%,transparent)}",
			".dsw-webpanel-auth-text{flex:1 1 auto;min-width:0;font-size:11px;line-height:1.45;color:var(--dsw-alias-label-secondary)}",
			".dsw-webpanel-auth-btn{flex:none;height:24px;padding:0 10px;border:0;border-radius:999px;background:var(--dsw-alias-brand-primary,#4d6bfe);color:#fff;font:inherit;font-size:11px;cursor:pointer}",
			".dsw-webpanel-auth-btn:disabled{opacity:.6;cursor:default}",
			".dsw-webpanel-body{position:relative;flex:1;min-height:0;display:flex}",
			".dsw-webpanel-frame{display:flex;flex:1;min-width:0;min-height:0}",
			".dsw-webpanel-webview{-webkit-app-region:no-drag;border:0;flex:auto;width:100%;min-width:0;height:100%;min-height:0;display:flex}",
			".dsw-webpanel-note{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-base)}",
			".dsw-webpanel-error{color:var(--dsw-alias-state-error-primary)}"
		].join("");
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(PANEL_CSS_ID$1)}]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-deepseek-web-free";
			tag.dataset.pluginCss = PANEL_CSS_ID$1;
			tag.textContent = PANEL_CSS$1;
			document.head.appendChild(tag);
		}
		const EMPTY = {
			phase: "idle",
			url: "",
			title: "",
			loading: false,
			canGoBack: false,
			canGoForward: false
		};
		/** One stable storage identity, so a panel always asks the host for the same workspace. */
		const WORKSPACE_KEY = "dsh-deepseek-web-free-panel";
		/**
		* Official DeepSeek whale mark, recolored through `currentColor` so it follows the
		* host theme (black on light surfaces, white on dark ones).
		*/
		/** Exported so the sidebar toggle can reuse the same whale mark. */
		const WHALE_ICON = "<svg viewBox=\"0 0 24 24\" width=\"34\" height=\"34\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45\"/></svg>";
		async function resolvePanelToken$1() {
			const result = await pluginFetch(WEBPANEL_TOKEN_PATH);
			if (result.status !== "signed-in") return void 0;
			const token = result.token;
			return typeof token === "string" && token.length > 0 ? token : void 0;
		}
		function openInSystemBrowser$1(url) {
			if (url.length === 0) return;
			window.open(url, "_blank", "noopener");
		}
		function viewport() {
			if (typeof window === "undefined") return {
				width: 1440,
				height: 900
			};
			return {
				width: window.innerWidth,
				height: window.innerHeight
			};
		}
		function clampPoint(point, width, height) {
			const box = viewport();
			const maxX = Math.max(BALL_MARGIN, box.width - width - BALL_MARGIN);
			const maxY = Math.max(BALL_MARGIN, box.height - height - BALL_MARGIN);
			return {
				x: Math.min(Math.max(BALL_MARGIN, Math.round(point.x)), maxX),
				y: Math.min(Math.max(BALL_MARGIN, Math.round(point.y)), maxY)
			};
		}
		function winSize() {
			const box = viewport();
			return {
				width: Math.min(WIN_WIDTH, Math.max(320, box.width - 24)),
				height: Math.min(WIN_HEIGHT, Math.max(320, box.height - 24))
			};
		}
		function defaultBall() {
			const box = viewport();
			return clampPoint({
				x: box.width - BALL_SIZE - 24,
				y: Math.round(box.height * .62)
			}, BALL_SIZE, BALL_SIZE);
		}
		/**
		* Right edge of the host sidebar, measured from our own footer toggle (the
		* toggle spans the sidebar footer, so its right edge is the sidebar edge).
		* Null when the toggle is not mounted or has no layout yet.
		*/
		function sidebarRightEdge() {
			if (typeof document === "undefined") return null;
			const el = document.querySelector(".dsw-webpanel-toggle-layer");
			if (el === null) return null;
			const rect = el.getBoundingClientRect();
			return rect.width > 0 ? Math.round(rect.right) : null;
		}
		/**
		* Park the window just to the right of the sidebar, bottom-aligned: it lands in
		* the empty lower-left corner of the main area and never covers the chat column
		* where the conversation actually renders.
		*/
		function defaultWin(_ball) {
			const box = viewport();
			const size = winSize();
			return clampPoint({
				x: (sidebarRightEdge() ?? Math.round(box.width * .18)) + 12,
				y: box.height - size.height - BALL_MARGIN
			}, size.width, size.height);
		}
		function DeepSeekWebPanel(props) {
			const t = props.t ?? ((key) => key);
			const [prefs, setPrefs] = (0, react.useState)(() => typeof localStorage === "undefined" ? { ...DEFAULT_WEBPANEL_PREFS } : loadPrefs());
			const [open, setOpen] = (0, react.useState)(false);
			const [mounted, setMounted] = (0, react.useState)(false);
			const [snapshot, setSnapshot] = (0, react.useState)(EMPTY);
			const [address, setAddress] = (0, react.useState)(WEBPANEL_DEFAULT_URL);
			const [ball, setBall] = (0, react.useState)(() => prefs.ball ?? defaultBall());
			const [winOffset, setWinOffset] = (0, react.useState)(prefs.winOffset);
			const [winSizeState, setWinSizeState] = (0, react.useState)(prefs.winSize);
			const containerRef = (0, react.useRef)(null);
			const guestRef = (0, react.useRef)();
			const pendingUrlRef = (0, react.useRef)(WEBPANEL_DEFAULT_URL);
			const ensureGuest = (0, react.useCallback)(() => {
				if (guestRef.current === void 0) guestRef.current = new WebPanelGuest({
					workspaceKey: WORKSPACE_KEY,
					resolveToken: resolvePanelToken$1,
					onPageToken: (token) => {
						importTokenFromPanel(token).catch((error) => {
							console.warn("[deepseek-web] token import failed", error);
						});
					},
					onExternalLink: (url) => openInSystemBrowser$1(url)
				});
				return guestRef.current;
			}, []);
			(0, react.useEffect)(() => () => {
				const guest = guestRef.current;
				guestRef.current = void 0;
				guest?.dispose();
			}, []);
			const show = (0, react.useCallback)((url) => {
				if (url !== void 0 && url.length > 0) pendingUrlRef.current = url;
				if (loadPrefs().position === "sidebar" && props.openPanelTab !== void 0) {
					props.openPanelTab(url);
					return;
				}
				setMounted(true);
				setOpen(true);
			}, [props.openPanelTab]);
			const toggle = (0, react.useCallback)(() => {
				if (!loadPrefs().enabled) return;
				setMounted(true);
				setOpen((current) => !current);
			}, []);
			(0, react.useEffect)(() => subscribeWebPanel((request) => {
				if (!loadPrefs().enabled) return;
				if (request.toggle === true) {
					toggle();
					return;
				}
				show(request.url);
			}), [show, toggle]);
			(0, react.useEffect)(() => subscribePrefs((next) => {
				setPrefs(next);
				if (next.ball !== null) setBall(next.ball);
				setWinOffset(next.winOffset);
				setWinSizeState(next.winSize);
				if (!next.enabled) setOpen(false);
			}), []);
			(0, react.useEffect)(() => {
				const onKeyDown = (event) => {
					if (event.defaultPrevented) return;
					if (event.key.toLowerCase() === "d" && event.shiftKey && (event.ctrlKey || event.metaKey)) {
						const current = loadPrefs();
						if (!current.enabled) return;
						event.preventDefault();
						if (current.position === "sidebar" && props.openPanelTab !== void 0) {
							props.openPanelTab();
							return;
						}
						setMounted(true);
						setOpen((value) => !value);
						return;
					}
					if (event.key === "Escape" && open) {
						event.preventDefault();
						setOpen(false);
					}
				};
				window.addEventListener("keydown", onKeyDown, true);
				return () => window.removeEventListener("keydown", onKeyDown, true);
			}, [open, props.openPanelTab]);
			(0, react.useEffect)(() => {
				if (!mounted) return;
				const container = containerRef.current;
				if (container === null) return;
				const guest = ensureGuest();
				const unsubscribe = guest.subscribe(() => setSnapshot(guest.getSnapshot()));
				setSnapshot(guest.getSnapshot());
				guest.attach(container, pendingUrlRef.current).then(() => setSnapshot(guest.getSnapshot()));
				return unsubscribe;
			}, [mounted, ensureGuest]);
			(0, react.useEffect)(() => {
				if (snapshot.url.length > 0 && !snapshot.url.startsWith("about:blank")) setAddress(snapshot.url);
			}, [snapshot.url]);
			if (prefs.position !== "ball") return null;
			const size = winSizeState ?? winSize();
			const winPos = clampPoint(winOffset === null ? defaultWin(ball) : {
				x: ball.x + winOffset.x,
				y: ball.y + winOffset.y
			}, size.width, size.height);
			const offsetOf = (point) => ({
				x: point.x - ball.x,
				y: point.y - ball.y
			});
			const drag = (event, onMove, onEnd) => {
				event.preventDefault();
				const startX = event.clientX;
				const startY = event.clientY;
				const move = (moveEvent) => onMove(moveEvent.clientX - startX, moveEvent.clientY - startY);
				const up = () => {
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", up);
					onEnd();
				};
				window.addEventListener("pointermove", move);
				window.addEventListener("pointerup", up);
			};
			const onBallPointerDown = (event) => {
				const origin = ball;
				let moved = false;
				let latest = origin;
				drag(event, (dx, dy) => {
					if (!moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) moved = true;
					if (!moved) return;
					latest = clampPoint({
						x: origin.x + dx,
						y: origin.y + dy
					}, BALL_SIZE, BALL_SIZE);
					setBall(latest);
				}, () => {
					if (moved) savePrefs({
						...loadPrefs(),
						ball: latest,
						win: null,
						winOffset
					});
					else toggle();
				});
			};
			const onHeadPointerDown = (event) => {
				const target = event.target;
				if (target !== null && target.closest("button, input") !== null) return;
				const origin = winPos;
				let latest = offsetOf(origin);
				drag(event, (dx, dy) => {
					const next = clampPoint({
						x: origin.x + dx,
						y: origin.y + dy
					}, size.width, size.height);
					latest = offsetOf(next);
					setWinOffset(latest);
				}, () => {
					savePrefs({
						...loadPrefs(),
						win: null,
						winOffset: latest
					});
				});
			};
			/** Edge/corner resize: width, height or both, clamped so the window stays on screen. */
			const onResizeDown = (event, edge) => {
				event.preventDefault();
				event.stopPropagation();
				const start = size;
				const startOffset = offsetOf(winPos);
				let latestSize = start;
				drag(event, (dx, dy) => {
					const box = viewport();
					const anchorX = ball.x + startOffset.x;
					const anchorY = ball.y + startOffset.y;
					const maxWidth = Math.max(WIN_MIN_WIDTH, box.width - anchorX - BALL_MARGIN);
					const maxHeight = Math.max(WIN_MIN_HEIGHT, box.height - anchorY - BALL_MARGIN);
					const width = edge === "s" ? start.width : Math.min(Math.max(WIN_MIN_WIDTH, start.width + dx), maxWidth);
					const height = edge === "e" ? start.height : Math.min(Math.max(WIN_MIN_HEIGHT, start.height + dy), maxHeight);
					latestSize = {
						width: Math.round(width),
						height: Math.round(height)
					};
					setWinSizeState(latestSize);
					setWinOffset(startOffset);
				}, () => {
					savePrefs({
						...loadPrefs(),
						win: null,
						winOffset: startOffset,
						winSize: latestSize
					});
				});
			};
			const submitAddress = () => {
				const raw = address.trim();
				if (raw.length === 0) return;
				guestRef.current?.navigate(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
			};
			const unavailable = snapshot.phase === "error" && snapshot.message === "desktop-browser-unavailable";
			const ICONS = {
				back: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8.8 2.8 4.6 7l4.2 4.2\"/></svg>",
				forward: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5.2 2.8 9.4 7l-4.2 4.2\"/></svg>",
				reload: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11.4 6.2a4.5 4.5 0 1 0-.9 3.4\"/><path d=\"M11.6 2.8v3.4H8.2\"/></svg>",
				stop: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"><rect x=\"3.2\" y=\"3.2\" width=\"7.6\" height=\"7.6\" rx=\"1.2\"/></svg>",
				external: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 3H3.4v7.6H11V8\"/><path d=\"M8.2 3H11v2.8\"/><path d=\"M11 3 6.8 7.2\"/></svg>",
				close: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"><path d=\"m3.4 3.4 7.2 7.2M10.6 3.4l-7.2 7.2\"/></svg>"
			};
			const tool = (label, icon, onClick, options) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: options?.danger === true ? "dsw-webpanel-iconbtn dsw-webpanel-iconbtn-close" : "dsw-webpanel-iconbtn",
				"aria-label": label,
				title: label,
				disabled: options?.disabled === true,
				onClick,
				dangerouslySetInnerHTML: { __html: icon }
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsw-webpanel-host",
				children: [mounted ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsw-webpanel-win",
					style: {
						left: winPos.x,
						top: winPos.y,
						width: size.width,
						height: size.height,
						display: open ? "flex" : "none"
					},
					role: "dialog",
					"aria-label": t("panelTitle"),
					"aria-hidden": !open,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsw-webpanel-head",
							onPointerDown: onHeadPointerDown,
							children: [
								tool(t("panelBack"), ICONS.back, () => guestRef.current?.back(), { disabled: !snapshot.canGoBack }),
								tool(t("panelForward"), ICONS.forward, () => guestRef.current?.forward(), { disabled: !snapshot.canGoForward }),
								tool(snapshot.loading ? t("panelStop") : t("panelReload"), snapshot.loading ? ICONS.stop : ICONS.reload, () => {
									if (snapshot.loading) guestRef.current?.stop();
									else guestRef.current?.reload();
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "dsw-webpanel-address",
									value: address,
									spellCheck: false,
									placeholder: t("panelAddress"),
									onChange: (event) => setAddress(event.target.value),
									onKeyDown: (event) => {
										if (event.key !== "Enter") return;
										event.preventDefault();
										submitAddress();
									}
								}),
								tool(t("panelExternal"), ICONS.external, () => openInSystemBrowser$1(snapshot.url.length > 0 ? snapshot.url : address)),
								tool(t("panelClose"), ICONS.close, () => setOpen(false), { danger: true })
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WebPanelAuthBanner, {
							t,
							onSignedIn: () => guestRef.current?.reload(),
							onSignedOut: () => {
								guestRef.current?.clearSession();
							},
							readPageToken: () => guestRef.current?.readPageToken() ?? Promise.resolve(null)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsw-webpanel-body",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									ref: containerRef,
									className: "dsw-webpanel-frame"
								}),
								snapshot.phase === "attaching" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsw-webpanel-note",
									children: t("panelConnecting")
								}) : null,
								unavailable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsw-webpanel-note",
									children: t("panelDesktopOnly")
								}) : null,
								!unavailable && snapshot.phase === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsw-webpanel-note dsw-webpanel-error",
									children: [t("panelLoadFailed"), snapshot.message !== void 0 ? ` (${snapshot.message})` : ""]
								}) : null
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsw-webpanel-rz dsw-webpanel-rz-e",
							onPointerDown: (event) => onResizeDown(event, "e")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsw-webpanel-rz dsw-webpanel-rz-s",
							onPointerDown: (event) => onResizeDown(event, "s")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsw-webpanel-rz dsw-webpanel-rz-se",
							onPointerDown: (event) => onResizeDown(event, "se")
						})
					]
				}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dsw-webpanel-ball",
					style: {
						left: ball.x,
						top: ball.y
					},
					"aria-label": open ? t("panelClose") : t("panelAction"),
					title: open ? t("panelClose") : t("panelAction"),
					"aria-expanded": open,
					onPointerDown: onBallPointerDown,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsw-webpanel-ball-icon",
						dangerouslySetInnerHTML: { __html: WHALE_ICON }
					})
				})]
			});
		}
		//#endregion
		//#region src/client/DeepSeekPanelToggle.tsx
		const PANEL_CSS_ID = "dsh-deepseek-web-free/panel-toggle";
		const PANEL_CSS = [
			".dsw-webpanel-toggle-layer{flex:none;align-items:center;width:100%;height:42px;margin:8px 0 0;display:flex;position:relative}",
			".dsw-webpanel-toggle-layer[data-wide=\"0\"]{width:36px;height:36px;margin:0}",
			".dsw-webpanel-toggle{width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);cursor:pointer;background:transparent;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}",
			".dsw-webpanel-toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsw-webpanel-toggle-layer[data-wide=\"0\"] .dsw-webpanel-toggle{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:0;padding:0}",
			".dsw-webpanel-toggle-icon{flex:none;display:inline-flex;align-items:center;justify-content:center}",
			".dsw-webpanel-toggle-icon svg{width:18px;height:18px;display:block}",
			".dsw-webpanel-toggle-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}",
			".dsw-webpanel-chooser{position:fixed;z-index:1300;min-width:150px;padding:6px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);box-shadow:0 10px 30px rgba(0,0,0,.24);display:flex;flex-direction:column;gap:2px}",
			".dsw-webpanel-chooser-title{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:4px 8px 2px;white-space:nowrap}",
			".dsw-webpanel-chooser-item{display:flex;align-items:center;gap:8px;min-height:30px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;text-align:left;white-space:nowrap}",
			".dsw-webpanel-chooser-item:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsw-webpanel-chooser-dot{width:6px;height:6px;border-radius:50%;background:transparent;flex:none}",
			".dsw-webpanel-chooser-item.is-current .dsw-webpanel-chooser-dot{background:var(--dsw-alias-label-primary)}"
		].join("");
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(PANEL_CSS_ID)}]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-deepseek-web-free";
			tag.dataset.pluginCss = PANEL_CSS_ID;
			tag.textContent = PANEL_CSS;
			document.head.appendChild(tag);
		}
		const MODES = ["ball", "sidebar"];
		/**
		* Sidebar footer toggle for the web panel. A plain click opens the default mode
		* (the position preference); hovering the button offers a small chooser that
		* switches that default between the floating ball and the docked sidebar tab.
		*/
		function DeepSeekPanelToggle(props) {
			const t = props.t ?? ((key) => key);
			const wide = props.wide !== false;
			const [prefs, setPrefs] = (0, react.useState)(() => typeof localStorage === "undefined" ? {
				enabled: true,
				position: "sidebar",
				ball: null,
				winOffset: null,
				win: null,
				winSize: null
			} : loadPrefs());
			const [chooser, setChooser] = (0, react.useState)(false);
			const [anchor, setAnchor] = (0, react.useState)({
				left: 0,
				top: 0
			});
			const layerRef = (0, react.useRef)(null);
			const closeTimer = (0, react.useRef)();
			(0, react.useEffect)(() => subscribePrefs(setPrefs), []);
			(0, react.useEffect)(() => () => {
				if (closeTimer.current !== void 0) window.clearTimeout(closeTimer.current);
			}, []);
			const openChooser = () => {
				if (closeTimer.current !== void 0) {
					window.clearTimeout(closeTimer.current);
					closeTimer.current = void 0;
				}
				if (!wide) return;
				const rect = layerRef.current?.getBoundingClientRect();
				if (rect !== void 0) {
					const width = 168;
					const preferred = rect.right + 8;
					const left = preferred + width > window.innerWidth ? Math.max(8, rect.left - width - 8) : preferred;
					setAnchor({
						left,
						top: rect.top + rect.height / 2
					});
				}
				setChooser(true);
			};
			const scheduleClose = () => {
				if (closeTimer.current !== void 0) window.clearTimeout(closeTimer.current);
				closeTimer.current = window.setTimeout(() => setChooser(false), 250);
			};
			const onToggle = () => {
				const current = loadPrefs();
				if (!current.enabled) return;
				if (current.position === "sidebar" && props.openPanelTab !== void 0) {
					props.openPanelTab();
					return;
				}
				toggleWebPanel();
			};
			const setDefault = (position) => {
				savePrefs({
					...loadPrefs(),
					position
				});
				setChooser(false);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: layerRef,
				className: "dsw-webpanel-toggle-layer",
				"data-wide": wide ? "1" : "0",
				onMouseEnter: openChooser,
				onMouseLeave: scheduleClose,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "dsw-webpanel-toggle",
					"aria-label": t("panelAction"),
					title: t("panelAction"),
					onClick: onToggle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsw-webpanel-toggle-icon",
						"aria-hidden": true,
						dangerouslySetInnerHTML: { __html: WHALE_ICON }
					}), wide ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsw-webpanel-toggle-label",
						children: t("panelAction")
					}) : null]
				}), wide && chooser ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsw-webpanel-chooser",
					role: "menu",
					"aria-label": t("panelPosition"),
					style: {
						left: anchor.left,
						top: anchor.top,
						transform: "translateY(-50%)"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsw-webpanel-chooser-title",
						children: t("panelPosition")
					}), MODES.map((mode) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						role: "menuitem",
						className: "dsw-webpanel-chooser-item" + (prefs.position === mode ? " is-current" : ""),
						onClick: () => setDefault(mode),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsw-webpanel-chooser-dot",
							"aria-hidden": true
						}), mode === "ball" ? t("panelPositionBall") : t("panelPositionSidebar")]
					}, mode))]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/DeepSeekWebPanelTab.tsx
		async function resolvePanelToken() {
			const result = await pluginFetch(WEBPANEL_TOKEN_PATH);
			if (result.status !== "signed-in") return void 0;
			const token = result.token;
			return typeof token === "string" && token.length > 0 ? token : void 0;
		}
		function openInSystemBrowser(url) {
			if (url.length === 0) return;
			window.open(url, "_blank", "noopener");
		}
		const ICONS = {
			back: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8.8 2.8 4.6 7l4.2 4.2\"/></svg>",
			forward: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5.2 2.8 9.4 7l-4.2 4.2\"/></svg>",
			reload: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11.4 6.2a4.5 4.5 0 1 0-.9 3.4\"/><path d=\"M11.6 2.8v3.4H8.2\"/></svg>",
			stop: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"><rect x=\"3.2\" y=\"3.2\" width=\"7.6\" height=\"7.6\" rx=\"1.2\"/></svg>",
			external: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 3H3.4v7.6H11V8\"/><path d=\"M8.2 3H11v2.8\"/><path d=\"M11 3 6.8 7.2\"/></svg>",
			close: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"><path d=\"m3.4 3.4 7.2 7.2M10.6 3.4l-7.2 7.2\"/></svg>"
		};
		/** Docked variant of the web panel: one right-sidebar tab, chrome fills the pane. */
		function DeepSeekWebPanelTab(props) {
			const t = props.t ?? ((key) => key);
			const tab = (props.useTabInfo?.())?.tab;
			const [snapshot, setSnapshot] = (0, react.useState)({
				phase: "idle",
				url: "",
				title: "",
				loading: false,
				canGoBack: false,
				canGoForward: false
			});
			const [address, setAddress] = (0, react.useState)(() => tab?.navigation?.params?.url ?? "https://chat.deepseek.com");
			const containerRef = (0, react.useRef)(null);
			const guestRef = (0, react.useRef)();
			const initialUrlRef = (0, react.useRef)(tab?.navigation?.params?.url ?? "https://chat.deepseek.com");
			const ensureGuest = (0, react.useCallback)(() => {
				if (guestRef.current === void 0) guestRef.current = new WebPanelGuest({
					workspaceKey: WEBPANEL_WORKSPACE_KEY,
					resolveToken: resolvePanelToken,
					onPageToken: (token) => {
						importTokenFromPanel(token).catch((error) => {
							console.warn("[deepseek-web] token import failed", error);
						});
					},
					onExternalLink: (url) => openInSystemBrowser(url)
				});
				return guestRef.current;
			}, []);
			(0, react.useEffect)(() => () => {
				const guest = guestRef.current;
				guestRef.current = void 0;
				guest?.dispose();
			}, []);
			(0, react.useEffect)(() => {
				const container = containerRef.current;
				if (container === null) return;
				const guest = ensureGuest();
				const unsubscribe = guest.subscribe(() => setSnapshot(guest.getSnapshot()));
				setSnapshot(guest.getSnapshot());
				guest.attach(container, initialUrlRef.current).then(() => setSnapshot(guest.getSnapshot()));
				return unsubscribe;
			}, [ensureGuest]);
			(0, react.useEffect)(() => {
				if (snapshot.url.length > 0 && !snapshot.url.startsWith("about:blank")) setAddress(snapshot.url);
			}, [snapshot.url]);
			const submitAddress = () => {
				const raw = address.trim();
				if (raw.length === 0) return;
				guestRef.current?.navigate(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
			};
			const unavailable = snapshot.phase === "error" && snapshot.message === "desktop-browser-unavailable";
			const rootStyle = {
				height: "100%",
				minHeight: 0,
				display: "flex",
				flexDirection: "column"
			};
			const tool = (label, icon, onClick, options) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: options?.danger === true ? "dsw-webpanel-iconbtn dsw-webpanel-iconbtn-close" : "dsw-webpanel-iconbtn",
				"aria-label": label,
				title: label,
				disabled: options?.disabled === true,
				onClick,
				dangerouslySetInnerHTML: { __html: icon }
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsw-webpanel-tab",
				style: rootStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsw-webpanel-head",
						style: { paddingLeft: 8 },
						children: [
							tool(t("panelBack"), ICONS.back, () => guestRef.current?.back(), { disabled: !snapshot.canGoBack }),
							tool(t("panelForward"), ICONS.forward, () => guestRef.current?.forward(), { disabled: !snapshot.canGoForward }),
							tool(snapshot.loading ? t("panelStop") : t("panelReload"), snapshot.loading ? ICONS.stop : ICONS.reload, () => {
								if (snapshot.loading) guestRef.current?.stop();
								else guestRef.current?.reload();
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dsw-webpanel-address",
								value: address,
								spellCheck: false,
								placeholder: t("panelAddress"),
								onChange: (event) => setAddress(event.target.value),
								onKeyDown: (event) => {
									if (event.key !== "Enter") return;
									event.preventDefault();
									submitAddress();
								}
							}),
							tool(t("panelExternal"), ICONS.external, () => openInSystemBrowser(snapshot.url.length > 0 ? snapshot.url : address)),
							tool(t("panelClose"), ICONS.close, () => tab?.actions?.close?.(), { danger: true })
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WebPanelAuthBanner, {
						t,
						onSignedIn: () => guestRef.current?.reload(),
						onSignedOut: () => {
							guestRef.current?.clearSession();
						},
						readPageToken: () => guestRef.current?.readPageToken() ?? Promise.resolve(null)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsw-webpanel-body",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								ref: containerRef,
								className: "dsw-webpanel-frame"
							}),
							snapshot.phase === "attaching" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsw-webpanel-note",
								children: t("panelConnecting")
							}) : null,
							unavailable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsw-webpanel-note",
								children: t("panelDesktopOnly")
							}) : null,
							!unavailable && snapshot.phase === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsw-webpanel-note dsw-webpanel-error",
								children: [t("panelLoadFailed"), snapshot.message !== void 0 ? ` (${snapshot.message})` : ""]
							}) : null
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/host-menu.tsx
		const HOST_MENU_CSS_ID = "dsh-deepseek-web-free/host-menu";
		const HOST_MENU_CSS = [
			".dsw-web-menu{z-index:1100;box-sizing:border-box;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-alias-bg-layer-3);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);border-radius:12px;flex-direction:column;padding:4px;display:flex;overflow:hidden}",
			".dsw-web-menu-viewport{flex:1 1 auto;flex-direction:column;min-height:0;display:flex;overflow-y:auto}",
			".dsw-web-menu-footer{flex:none;flex-direction:column;margin-top:4px;padding-top:4px;border-top:1px solid var(--dsw-alias-border-l2);display:flex}",
			".dsw-web-menu-item{cursor:pointer;width:100%;min-height:40px;color:var(--dsw-alias-label-primary);text-align:left;background:transparent;border:none;border-radius:10px;align-items:center;gap:8px;padding:8px 10px;font:inherit;font-size:14px;line-height:22px;display:flex}",
			".dsw-web-menu-item:hover:not(:disabled),.dsw-web-menu-item:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
			".dsw-web-menu-item:disabled{opacity:.4;cursor:default}",
			".dsw-web-menu-item-icon{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-secondary)}",
			".dsw-web-menu-item-label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}",
			".dsw-web-menu-label{color:var(--dsw-alias-label-tertiary);padding:8px 10px;font-size:12px;line-height:18px}",
			".dsw-web-menu-separator{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l2);border:none}",
			".dsw-web-menu-sentinel{flex:none;height:1px;width:100%;pointer-events:none}",
			".dsw-web-menu-row{align-items:center;gap:4px;display:flex}",
			".dsw-web-menu-row>.dsw-web-menu-item{flex:1 1 auto;min-width:0}",
			".dsw-web-menu-side{flex:none;height:28px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px;line-height:18px}",
			".dsw-web-menu-side:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}"
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
					children: [props.items.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HostMenuEntryView, {
						entry,
						onSelect: props.onSelect,
						onPanel: props.onPanel
					}, entry.id)), onReachEnd !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: sentinelRef,
						className: "dsw-web-menu-sentinel",
						"aria-hidden": true
					}) : null]
				}), footer !== void 0 && footer.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsw-web-menu-footer",
					role: "presentation",
					children: footer.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HostMenuEntryView, {
						entry,
						onSelect: props.onSelect,
						onPanel: props.onPanel
					}, entry.id))
				}) : null]
			});
		}
		function HostMenuEntryView(props) {
			const { entry, onSelect, onPanel } = props;
			if ("type" in entry && entry.type === "separator") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("hr", { className: "dsw-web-menu-separator" });
			if ("type" in entry && entry.type === "label") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsw-web-menu-label",
				role: "presentation",
				children: entry.text
			});
			const row = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
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
			if (entry.panelUrl === void 0 || onPanel === void 0) return row;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsw-web-menu-row",
				children: [row, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dsw-web-menu-side",
					title: entry.panelLabel,
					"aria-label": entry.panelLabel,
					onClick: () => onPanel(entry.panelUrl),
					children: entry.panelLabel
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
			introPermanent: "Sign in once and it is permanent: the settings page, the model list and the embedded web panel share the same stored credential, so no re-login after a restart.",
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
			forkFailed: "Could not fork this conversation.",
			panelAction: "DeepSeek web panel",
			panelSignInHint: "Not signed in. Sign in once here and both the panel and the model list stay signed in — no re-login after a restart.",
			panelSignInAction: "Sign in",
			panelSigningIn: "Waiting for sign-in…",
			panelSignInFailed: "Sign-in did not complete. Try again.",
			panelTitle: "DeepSeek Web",
			panelAddress: "Enter an HTTP(S) address",
			panelGo: "Go",
			panelBack: "Back",
			panelForward: "Forward",
			panelReload: "Reload",
			panelStop: "Stop",
			panelExternal: "Open in system browser",
			panelFullscreen: "Full width",
			panelRestore: "Restore width",
			panelClose: "Close",
			panelResize: "Drag to resize",
			panelConnecting: "Attaching the embedded browser…",
			panelLoadFailed: "The page could not be loaded.",
			panelDesktopOnly: "The embedded DeepSeek panel needs the DSH desktop app. Open the address in a browser instead.",
			panelSection: "Web panel",
			panelSectionIntro: "Show the real chat.deepseek.com inside DSH. The panel reuses your saved DeepSeek account, so it opens already signed in.",
			panelEnable: "Enable the web panel",
			panelEnableHint: "When off, the sidebar entry and the keyboard shortcut stay disabled.",
			panelPosition: "Position",
			panelPositionSidebar: "Sidebar",
			panelPositionBall: "Floating ball",
			panelPositionHint: "Sidebar: the panel docks in the right sidebar and never covers the chat. Floating ball: a draggable ball opens a movable chat window.",
			panelShortcut: "Ctrl+Shift+D opens the panel. Esc closes the window.",
			panelOpenNow: "Open the panel",
			panelOn: "On",
			panelOff: "Off",
			panelOpenShort: "Web"
		};
		const zh = {
			nav: "DeepSeek Web",
			title: "DeepSeek Web",
			intro: "通过隔离浏览器登录 chat.deepseek.com。DSH 不会使用你日常的 Chrome 配置。",
			introPermanent: "登录一次即永久生效：设置页、模型列表与内嵌网页面板共用同一份宿主凭据，重启 DSH 后无需重新登录。",
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
			forkFailed: "无法派生该会话。",
			panelAction: "DeepSeek 网页面板",
			panelSignInHint: "尚未登录。在这里登录一次，面板和模型列表都会永久生效，重启后无需再登录。",
			panelSignInAction: "一键登录",
			panelSigningIn: "等待登录完成…",
			panelSignInFailed: "登录未完成，请重试。",
			panelTitle: "DeepSeek 网页",
			panelAddress: "输入 HTTP(S) 地址",
			panelGo: "前往",
			panelBack: "后退",
			panelForward: "前进",
			panelReload: "刷新",
			panelStop: "停止",
			panelExternal: "在系统浏览器打开",
			panelFullscreen: "占满宽度",
			panelRestore: "恢复宽度",
			panelClose: "关闭",
			panelResize: "拖动调整宽度",
			panelConnecting: "正在挂载内嵌浏览器…",
			panelLoadFailed: "页面加载失败。",
			panelDesktopOnly: "内嵌 DeepSeek 面板需要 DSH 桌面端。可以改用系统浏览器打开该地址。",
			panelSection: "网页面板",
			panelSectionIntro: "在 DSH 里直接显示真实的 chat.deepseek.com。面板复用已保存的 DeepSeek 账号，打开即为登录状态。",
			panelEnable: "启用网页面板",
			panelEnableHint: "关闭后，侧栏入口与快捷键都不再生效。",
			panelPosition: "位置",
			panelPositionSidebar: "侧边栏",
			panelPositionBall: "悬浮球",
			panelPositionHint: "侧边栏：面板停靠在右侧栏，与对话互不遮挡；悬浮球：屏幕上有个可拖动的鲸鱼球，点开是可拖动的对话窗口。",
			panelShortcut: "Ctrl+Shift+D 打开面板，Esc 关闭窗口。",
			panelOpenNow: "立即打开面板",
			panelOn: "已启用",
			panelOff: "已停用",
			panelOpenShort: "网页"
		};
		//#endregion
		//#region src/client/slot-ids.ts
		const SIDEBAR_ACTION_SLOT = "sidebar.footer.action";
		const SIDEBAR_ACTION_ID = "deepseek-web";
		const FORK_ACTION_SLOT = "conversation.chat.assistant-actions";
		const FORK_ACTION_ID = "deepseek-web-fork";
		const PANEL_SLOT = "shell.overlay";
		const PANEL_ID = "deepseek-web-panel";
		const PANEL_TAB_KIND = "deepseek-web-panel";
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
			"workspaces",
			"sidebarRight",
			"sidebarRightTabs"
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
			const openPanelTab = (url) => {
				try {
					ctx.sidebarRight?.openTab?.(PANEL_TAB_KIND, url !== void 0 && url.length > 0 ? { params: { url } } : {});
				} catch {}
			};
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "deepseek-web",
				order: 16,
				label: () => t("nav"),
				inject: () => ({
					t,
					openPanelTab
				})
			}, DeepSeekWebSettings));
			ctx.slots.inject(SIDEBAR_ACTION_SLOT, () => ctx.slots.register({
				name: SIDEBAR_ACTION_SLOT,
				id: SIDEBAR_ACTION_ID,
				order: 20,
				locale: namespace,
				inject: () => ({
					t,
					openPanelTab
				})
			}, DeepSeekPanelToggle));
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
			ctx.slots.inject(PANEL_SLOT, () => ctx.slots.register({
				name: PANEL_SLOT,
				id: PANEL_ID,
				order: 40,
				locale: namespace,
				inject: () => ({
					t,
					openPanelTab
				})
			}, DeepSeekWebPanel));
			ctx.effect(() => ctx.sidebarRightTabs?.register?.({
				id: PANEL_TAB_KIND,
				kind: PANEL_TAB_KIND,
				priority: "builtin",
				title: () => t("panelTitle"),
				multiple: true,
				keepMounted: true
			}), "dsh-deepseek-web-free: panel tab type");
			ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: PANEL_TAB_KIND,
				locale: namespace,
				inject: () => ({
					t,
					openFloatPanel: openWebPanel
				})
			}, DeepSeekWebPanelTab));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
