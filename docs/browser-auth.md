# Browser auth

> ⚠️ **停用公告（2026-11-17）**：2026-11-17 作者实测账号因违反用户使用规范被禁言至 2026-11-20 16:21；1.0.44 起已删除在 DSH 中直接选 DeepSeek Web 模型对话的功能，只保留悬浮球与侧边栏打开官方 chat.deepseek.com 网页面板；请勿再用旧版本复用网页登录态发起对话。
> ⚠️ **Deprecation notice (2026-11-17)**: On 2026-11-17 the author's own test account was muted until 16:21 on 2026-11-20 for violating the user terms; starting with 1.0.44 the ability to chat by selecting a DeepSeek Web model directly inside DSH has been removed, leaving only the floating ball and sidebar shortcuts that open the official chat.deepseek.com web panel; do not reuse an old version to start chats with a web login session.

Browser login uses an isolated profile, CDP orchestration, strict origin
filtering (`https://chat.deepseek.com` only), credential validation, and
redaction. The settings-page diagnostic card keeps a secondary entry that
reuses `LOGIN_PATH`; since 1.0.44 the isolated-browser credential path is
**only for panel guest-token write-back and troubleshooting**, never for an LLM
adapter, never to capture a Bearer token for DSH chat, and never to start
conversations inside DSH.

The plugin does not read the default browser profile, does not capture
cross-site traffic, and does not return tokens to the frontend.
