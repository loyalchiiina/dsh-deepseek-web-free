# Security policy

> ⚠️ **停用公告（2026-11-17）**：2026-11-17 作者实测账号因违反用户使用规范被禁言至 2026-11-20 16:21；1.0.44 起已删除在 DSH 中直接选 DeepSeek Web 模型对话的功能，只保留悬浮球与侧边栏打开官方 chat.deepseek.com 网页面板；请勿再用旧版本复用网页登录态发起对话。
> ⚠️ **Deprecation notice (2026-11-17)**: On 2026-11-17 the author's own test account was muted until 16:21 on 2026-11-20 for violating the user terms; starting with 1.0.44 the ability to chat by selecting a DeepSeek Web model directly inside DSH has been removed, leaving only the floating ball and sidebar shortcuts that open the official chat.deepseek.com web panel; do not reuse an old version to start chats with a web login session.

**已发生真实账号封禁案例**：旧版（≤1.0.43）存在真实账号封禁案例，请勿继续使用；本机 1.0.44 已移除 DSH 内对话链但**面板内手动与官方网页交互仍由官方服务端风控管辖**。账号风险不再是「可能违反条款」，而是已发生的真实禁言：复用网页登录态在 DSH 内发起对话是被禁言的直接触发场景，1.0.44 已连根删除该链路。

A real account ban has already occurred: versions ≤1.0.43 carry a real account-ban case, do not keep using them; local 1.0.44 removed the in-DSH chat chain, but **manual interaction with the official page inside the panel remains subject to the official server-side risk control**.

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
