# Security policy


**功能范围**：本插件仅提供悬浮球与侧边栏，用于打开官方 chat.deepseek.com **网页面板**；在 DSH 中直接选 DeepSeek Web 模型对话的功能自 1.0.44 起已移除。

**Scope**: This plugin only provides a floating ball and the sidebar that open the official chat.deepseek.com **web panel**; in-DSH chat with a DeepSeek Web model was removed in 1.0.44.

Report credential leaks privately to the repository owner. Prefer GitHub
private vulnerability reporting when it is available.

This plugin authenticates with the user's own DeepSeek account. It does not
bypass CAPTCHA, WAF, or account access controls. It never reads the user's
default browser profile.

Do not paste into issues, fixtures, or logs:

- Bearer tokens
- cookies
- Authorization headers
- raw browser profiles

Tests use the documented literal `Bearer TEST_ONLY_TOKEN`.

1.0.44 removed RemoteSessionService, session routes, chat forking and the command chain: no session list, history, materialize, or Fork remains on the Host. The browser client never receives the bearer token, cookies, or raw authentication material; sign-in is only for the official chat.deepseek.com web panel opened by the floating ball / sidebar.

Since 1.0.43 every host HTTP route under /plugins/dsh-deepseek-web/ passes
through ctx.connection.requestRejection(req) before its handler (DSH
framework Host/Origin admission and browser authentication), in addition to
the plugin-owned trustedPluginRequest loopback/same-origin check. A missing
or broken gate fails closed with 503; unadmitted requests get 401/403.
