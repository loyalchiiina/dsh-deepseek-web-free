<div align="center">

# dsh-deepseek-web-free

**将 DeepSeek 网页端接入 DeepSeek Harness —— `y-wi/dsh-deepseek-web` 的 fork**

[English](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/README.en.md) · [中文](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/README.md) · [安装](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/INSTALL.md) · [npm](https://www.npmjs.com/package/dsh-deepseek-web-free) · [根 README](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/README.md)

[![npm](https://img.shields.io/npm/v/dsh-deepseek-web-free?color=1d4ed8&label=npm)](https://www.npmjs.com/package/dsh-deepseek-web-free)
[![license](https://img.shields.io/github/license/loyalchiiina/dsh-deepseek-web-free?color=334155)](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/dsh-deepseek-web-free?color=1e293b)](https://nodejs.org)

**开源 TypeScript 集成层** · 预编译 WASM 协议核心

<h3>
请严格遵循相关使用政策，禁止将此项目用于反代等破坏系统正常运行的行为，仅限个人学习使用
</h3>

</div>

非官方 Provider。本仓库开放 Harness **集成层与传输层**；协议兼容由随包分发的预编译 WebAssembly 提供。

本项目与 DeepSeek **无隶属或背书关系**。使用你自己的 DeepSeek 账号。插件不会绕过 CAPTCHA、WAF 或账号访问控制；交互式验证在隔离浏览器窗口中完成。

> 📌 这份文档是**本 fork 的版本**。上游原文存档在 [`upstream/README.upstream.md`](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/upstream/README.upstream.md)，两者内容不同：上游文档里的安装命令、npm 链接、徽章全部指向 `dsh-deepseek-web`（上游包），照它装会装到**不含本 fork 修复的旧版**。

## 与上游的关系

| 项 | 上游 `y-wi/dsh-deepseek-web` | 本 fork `dsh-deepseek-web-free` |
| --- | --- | --- |
| npm 包名 | `dsh-deepseek-web` | **`dsh-deepseek-web-free`** |
| GitHub | `y-wi/dsh-deepseek-web` | `loyalchiiina/dsh-deepseek-web-free` |
| 基线版本 | 1.0.3 | 1.0.3 起 fork，当前见 [CHANGELOG](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/CHANGELOG.md) |
| `provider` id | `deepseek-web` | `deepseek-web`（**不变**） |
| 模型 id | `default` / `expert` | `default` / `expert`（**不变**） |
| 浏览器 profile 目录 | `browser-profiles/dsh-deepseek-web` | **同名不变**（改名会丢登录态） |
| `cordis.patch.yml` 条目 | `id: llm-deepseek-web` + `id: deepseek-web-tui`（两条 insert） | 只有 `id: llm-deepseek-web-free` 一条，**缺 TUI 条目**（见下文第 8 条） |
| 默认模型覆盖 | 含 `- id: agent-default-model` | **同样含**（原样承袭，非本 fork 新增） |

上游包名 `dsh-deepseek-web` 已被原作者占用，无法同名发布，所以本 fork 只能改名到 `-free`。

本 fork 相对上游的实质修复（逐条证据见 [CHANGELOG](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/CHANGELOG.md)）：

1. **适配 DSH 0.2.1-alpha.2** —— `@deepseek-ai/dsh-settings` 移除了 `installSettingsSection` / `settingsNamespace` 导出，ESM 具名导入缺名会在链接期直接 SyntaxError。改用 `ctx.inject(["settings"], child => child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)))`，配置字段标 `.volatile()`，并监听 `loader/volatile-update` 清缓存。
2. **客户端图标换名** —— `Icon*Outline14/16` 已废除，改 `Icon*OutlineRegular`（stroke 1）/ `*OutlineMedium`（stroke 1.3），否则 React error #130 槽位渲染崩。
3. **`peerDependencies` 改范围写法** —— 精确钉版（如 `^0.1.0-rc.7`）会被 DSH 插件兼容性门禁**整体拒绝装载且零日志静默跳过**。
4. **不再吞掉上游错误** —— 服务端 SSE `hint` 事件带 `type:"error"`（如 `finish_reason:"backend_err"`）时，上游返回空消息并当作成功，毒化会话历史、下一轮报 `invalid message id`。现在直接抛可见的 `DEEPSEEK_WEB_HTTP` 并带服务端原文。
5. **修「登录成功但会话列表空」** —— 改名后遗留硬编码 `url.pathname.slice(34)`，34 恰是旧路由前缀长度，新前缀长 39，切出 `"sions"` 导致所有 sessions 请求落到兜底 404。改为 `slice(SESSIONS_PATH.length)`。
6. **侧边栏浮层背景改不透明** —— 宿主用的是「半透明底 + backdrop-filter blur」两件套，插件挂在 `document.body` 上装不了 backdrop-filter，抄半透明 token 会透出底下内容。改用不透明的 `var(--dsw-alias-bg-layer-3)`。
7. **⚠️ 装载补丁会覆盖默认模型（上游行为，原样承袭）** —— `cordis.patch.yml` 含一条 `- id: agent-default-model` / `config: {provider: deepseek-web, model: default}`。装上后**新会话默认模型变成 `deepseek-web/default`**；你若曾显式保存过默认模型，保存值优先。不想改的话装完到设置里重选一次。详见[根 README](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/README.md#装载行为与可配置项)。
8. **⚠️ 已知问题：patch 缺 TUI 条目** —— 上游 patch 有两条 `insert` 条目（`llm-deepseek-web` + `deepseek-web-tui`），本 fork 改名后只剩一条。本包仍带 `./tui` 导出，但**不会自动挂载**，要在 TUI profile 里手工补一条 `id: dsh-deepseek-web-free-tui` / `name: dsh-deepseek-web-free/tui` / `inject: [deepSeekWeb]`。只用 Web 界面则不受影响。**1.0.9 只改文档，未修此问题。**

## 安装

需要 DeepSeek Harness **0.1.0-rc.7**（或兼容版本），Node `^22.19.0 || >=24.0.0`。

```bash
dsh plugin --profile web add dsh-deepseek-web-free
dsh plugin --profile web peers check
dsh web
```

设置 → DeepSeek Web → Sign in with DeepSeek。确认 Provider `deepseek-web` 出现，模型 `default` / `expert` 可见。

DSH / Cordis / React 由运行时 `$DSH_HOME/profiles/node_modules` 提供，不会在插件目录再装一份。

<details>
<summary>TUI、CLI 与更新</summary>

```bash
dsh plugin --profile dsh-tui add dsh-deepseek-web-free
dsh-tui
```

```bash
dsh plugin --profile web exec dsh-deepseek-web-free status
dsh plugin --profile web exec dsh-deepseek-web-free login
dsh plugin --profile web exec dsh-deepseek-web-free doctor
dsh plugin --profile web update dsh-deepseek-web-free
```

无界面回退（不能替代浏览器登录）：

```bash
dsh plugin --profile web exec dsh-deepseek-web-free login --token-stdin
```

`--token-stdin` 从 stdin 读一行 token，调上游 `currentUser()` 校验，只打印脱敏后的账号哈希前缀与凭证键名，**不落盘、不写凭证**。

完整说明见 [INSTALL.md](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/INSTALL.md)。

</details>

## 能力

（图片资源在仓库 `docs/assets/` 下，不进 npm 包。）

<table>
<tr>
<td>
<img src="https://raw.githubusercontent.com/loyalchiiina/dsh-deepseek-web-free/main/docs/assets/showcase-login.gif" alt="设置中用隔离浏览器登录 DeepSeek Web" width="720">
<p><b>隔离浏览器登录。</b> 用独立浏览器登录 <code>chat.deepseek.com</code>，不读取日常 Chrome / Edge 配置。凭证只保存在 DSH 存储中。</p>
</td>
</tr>
<tr>
<td>
<img src="https://raw.githubusercontent.com/loyalchiiina/dsh-deepseek-web-free/main/docs/assets/showcase-switch.gif" alt="在输入栏切换 DeepSeek Web 模型与 DeepThink 推理等级" width="720">
<p><b>切换模型。</b> 可在 <code>DeepSeek Web</code> 与 <code>DeepSeek Web Expert</code> 之间切换，并选择 DeepThink 推理等级。底部显示当轮耗时与首 token 延迟。</p>
</td>
</tr>
<tr>
<td>
<img src="https://raw.githubusercontent.com/loyalchiiina/dsh-deepseek-web-free/main/docs/assets/showcase-list.gif" alt="侧栏浮层列出 DeepSeek Web 网页会话" width="720">
<p><b>网页会话列表。</b> 侧栏底部打开浮层，列出 DeepSeek 网页端上的会话，可刷新与滚动加载。</p>
</td>
</tr>
<tr>
<td>
<img src="https://raw.githubusercontent.com/loyalchiiina/dsh-deepseek-web-free/main/docs/assets/showcase-load.gif" alt="从浮层打开网页会话并在 Harness 中接续" width="720">
<p><b>接续网页会话。</b> 点选一条会话后在 Harness 里打开；replay 有效时续写原来的网页会话。导入时只保留用户原文。</p>
</td>
</tr>
<tr>
<td>
<img src="https://raw.githubusercontent.com/loyalchiiina/dsh-deepseek-web-free/main/docs/assets/showcase-fork.gif" alt="把助手消息派生到选定工作区后独立续聊" width="720">
<p><b>派生到工作区。</b> 把 DeepSeek 网页端的会话派生到你选择的工作区。派生后的会话不写回原来的网页会话。</p>
</td>
</tr>
<tr>
<td>
<img src="https://raw.githubusercontent.com/loyalchiiina/dsh-deepseek-web-free/main/docs/assets/showcase-clean.gif" alt="使用斜杠命令 /clean 只发送用户原文" width="720">
<p><b><code>/clean</code>。</b> 会话开关。打开后后续每一轮只发送你的原文（不含系统提示、工具、skills），可配合接续聊天接近网页端效果。再执行一次关闭。</p>
</td>
</tr>
</table>

| 能力 | 说明 |
| --- | --- |
| DSH 原生工具 | 将 DeepSeek 网页端接入 Harness；插件把模型输出转成工具请求。FS / Shell / MCP / 审批由 Harness 执行 |
| 网页搜索 | 始终开启官方网页端 Web Search；Expert 不能搜；不是 DSH `web_search` |
| 预构建 WASM | 安装无需 Rust / wasm-pack；token 与 cookie **不进入** WASM |

详见 [remote-sessions.md](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/remote-sessions.md)。

## 架构

| 层 | 职责 |
| --- | --- |
| TypeScript 开源层 | HTTP、SSE、浏览器登录、凭证、DSH 适配器、工具桥、回放 |
| 预编译 WASM 核心 | 协议兼容与 PoW |

DeepSeek Web 没有官方 function calling。插件只解析模型输出；适配器**从不**执行 shell、读盘或 MCP。

## 模型

| ID | 说明 |
| --- | --- |
| `deepseek-web/default` | DeepSeek Web |
| `deepseek-web/expert` | DeepSeek Web Expert |

思考为 `on` / `off`（默认 `on`）。网页原生搜索跟随官方 Web Search 开关。`default` 的每一轮（含续写和 `/clean`）都会打开，插件设置里不能关掉。Expert 在协议上不能搜索。引用来源会出现在时间线上；不会注册 DSH `web_search` 提供方。输入模态目前为**纯文本**——传 `ImageBlock` 会直接抛错，不会静默丢弃。

## 命令

斜杠命令不会把 `/…` 原文发给模型。

- `/deepseek-web [status|login|logout|doctor]` — 账号相关
- `/clean [message]` — 当前会话开关。打开后后续每一轮只发送你的原文（不含系统提示、工具、skills）。再执行一次 `/clean` 关闭。

## 安全

- 不要打印 `.credentials.yaml`、Bearer token、CDP 地址或浏览器配置目录的绝对路径
- 登录只使用插件隔离 profile
- 凭证只写入 DSH 凭证存储

披露流程见 [SECURITY.md](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/SECURITY.md)。浏览器登录细节见 [browser-auth.md](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/browser-auth.md)。

## 数据去向 / 隐私边界

摘要（完整逐条说明见[根 README](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/README.md#数据去向--隐私边界)）：

- 云端调用：`cloud: true`，唯一外联目标是 `https://chat.deepseek.com`（**不是** `api.deepseek.com`）
- 凭证：键名 `DEEPSEEK_WEB_TOKEN`，只存 DSH 凭证存储（`dsh-credentials`）
- 文件系统：只碰插件隔离浏览器 profile
- 管辖：`PIPL(CN)`；保留期：`session`

## 文档

- [安装](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/INSTALL.md)
- [贡献](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/CONTRIBUTING.md)
- [English README](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/README.en.md)
- [上游原文存档](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/upstream/README.upstream.md)
- [上游项目](https://github.com/y-wi/dsh-deepseek-web)

## 许可证

TypeScript 集成层为 MIT。预编译核心见 [LICENSE](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/LICENSE) 与上游仓库的 `LICENSES/PROTOCOL_CORE.txt`。第三方声明：[THIRD_PARTY_NOTICES.md](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/THIRD_PARTY_NOTICES.md)。
