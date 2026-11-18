# Install dsh-deepseek-web

> ⚠️ **停用公告（2026-11-17）**：2026-11-17 作者实测账号因违反用户使用规范被禁言至 2026-11-20 16:21；1.0.44 起已删除在 DSH 中直接选 DeepSeek Web 模型对话的功能，只保留悬浮球与侧边栏打开官方 chat.deepseek.com 网页面板；请勿再用旧版本复用网页登录态发起对话。
> ⚠️ **Deprecation notice (2026-11-17)**: On 2026-11-17 the author's own test account was muted until 16:21 on 2026-11-20 for violating the user terms; starting with 1.0.44 the ability to chat by selecting a DeepSeek Web model directly inside DSH has been removed, leaving only the floating ball and sidebar shortcuts that open the official chat.deepseek.com web panel; do not reuse an old version to start chats with a web login session.

Requires DeepSeek Harness **0.1.0-rc.7** (or compatible), Node `^22.19.0 || >=24.0.0`.

## Web profile

```bash
dsh plugin --profile web add dsh-deepseek-web
dsh plugin --profile web peers check
dsh web
```

Host Cordis, DSH, Schemastery, and React packages are optional peers supplied
by the DSH profile runtime (`$DSH_HOME/profiles/node_modules`). They are not
installed as copies under the plugin. Client UI injects are provided by DSH
ModuleLoader, not by npm peer installation.

Open Settings → DeepSeek Web → **Open the panel to sign in** (or open the sidebar
tab / floating ball directly). Sign in on the official chat.deepseek.com page
inside the DSH web panel; the plugin stores the token in DSH and the settings
page, sidebar tab and floating ball share one login state.

Check:

- only the floating ball and sidebar shortcuts open the official chat.deepseek.com web panel; there is no DSH provider `deepseek-web` and no model `default` / `expert` to select in the DSH model list
- no DSH chat uses the web login session; DSH conversations never consume the panel login state or bypass API quota
- auth status returns public state only (no token)

After sign-in, use the official chat.deepseek.com web panel opened by the sidebar tab or floating ball. 1.0.44 removed RemoteSessionService, session routes, chat forking, right-click hand-off and the `/clean` command chain; the old remote-session flow is kept only as a historical archive: [docs/remote-sessions.md](./docs/remote-sessions.md).

## TUI

## CLI

```bash
dsh plugin --profile web exec dsh-deepseek-web status
dsh plugin --profile web exec dsh-deepseek-web login
```

Headless fallback (not a substitute for browser login):

```bash
dsh plugin --profile web exec dsh-deepseek-web login --token-stdin
```

Unofficial integration. Users are responsible for complying with applicable
upstream terms.
