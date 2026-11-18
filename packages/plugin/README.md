# dsh-deepseek-web

> ⚠️ **停用公告（2026-11-17）**：2026-11-17 作者实测账号因违反用户使用规范被禁言至 2026-11-20 16:21；1.0.44 起已删除在 DSH 中直接选 DeepSeek Web 模型对话的功能，只保留悬浮球与侧边栏打开官方 chat.deepseek.com 网页面板；请勿再用旧版本复用网页登录态发起对话。
> ⚠️ **Deprecation notice (2026-11-17)**: On 2026-11-17 the author's own test account was muted until 16:21 on 2026-11-20 for violating the user terms; starting with 1.0.44 the ability to chat by selecting a DeepSeek Web model directly inside DSH has been removed, leaving only the floating ball and sidebar shortcuts that open the official chat.deepseek.com web panel; do not reuse an old version to start chats with a web login session.

See the repository README for install and security boundaries.

This package is a DeepSeek Harness plugin. It uses DeepSeek Web through a
compatibility layer, is not the official Open Platform adapter, and does not
bypass CAPTCHA/WAF or account access controls.

After signing in on the official page inside the DSH web panel, only the floating ball and sidebar open the official chat.deepseek.com web panel; there is no DSH model to select and no DSH chat. Deprecated as of 1.0.44: the old sidebar conversation list, Fork to Workspace, `default` model search and `/clean` chain have all been removed after a real account-ban case; do not reuse an old version's web login session to start chats.
