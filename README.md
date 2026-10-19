<div align="center">

# dsh-deepseek-web-free

**把 DeepSeek 网页端接入 DeepSeek Harness —— `y-wi/dsh-deepseek-web` 的 fork**

[English](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/README.en.md) · [安装](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/INSTALL.md) · [npm](https://www.npmjs.com/package/dsh-deepseek-web-free) · [CHANGELOG](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/CHANGELOG.md)

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

## 关于本 fork

本包是 [`y-wi/dsh-deepseek-web`](https://github.com/y-wi/dsh-deepseek-web) 的 fork。上游包名 `dsh-deepseek-web` 已被原作者占用，无法同名发布，故本 fork 的 npm 包名改为 **`dsh-deepseek-web-free`**。

**装包请认准名字 `dsh-deepseek-web-free`。** 装成 `dsh-deepseek-web` 拿到的就是上游原版，不含下面这些修复。

相对上游（基线 1.0.3）的改动，逐条见 [CHANGELOG.md](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/CHANGELOG.md)：

| 改动 | 说明 |
| --- | --- |
| 适配 DSH 0.2.1-alpha.2 | `@deepseek-ai/dsh-settings` 移除了 `installSettingsSection` / `settingsNamespace` 导出（ESM 具名导入缺名 = 链接期 SyntaxError）→ 改用 `ctx.settings.configure()`，配置字段标 `.volatile()` |
| 客户端图标换名 | `Icon*Outline14/16` 已废除 → `Icon*OutlineRegular` / `*OutlineMedium`（否则 React error #130，槽位渲染崩） |
| `peerDependencies` 改范围写法 | 精确钉版会被 DSH 插件兼容性门禁**静默拒绝装载**且零日志 |
| 不再吞掉上游错误 | 服务端 SSE `hint` 带 `type:"error"`（如 `finish_reason:"backend_err"`）时，原来返回**空消息并当作成功**，毒化历史、下一轮报 `invalid message id`；现在直接抛出可见错误 |
| 修会话列表空 | 改名后遗留 `pathname.slice(34)` 硬编码 —— 34 是旧前缀长度，新前缀长 39，切出 `"sions"` 导致所有 sessions 请求 404 |

**保持不变的部分（有意为之，勿改）**：`provider` id 仍是 `deepseek-web`；浏览器 profile 目录仍用旧名 `browser-profiles/dsh-deepseek-web`、缓存目录仍用 `cache/dsh-deepseek-web/browser` —— 改名会导致已登录用户丢失登录态。

## 安装

需要 DeepSeek Harness **0.1.0-rc.7**（或兼容版本），Node `^22.19.0 || >=24.0.0`。

```bash
dsh plugin --profile web add dsh-deepseek-web-free
dsh plugin --profile web peers check
dsh web
```

然后到 **设置 → DeepSeek Web → Sign in with DeepSeek**。确认 Provider `deepseek-web` 出现，模型 `default` / `expert` 可见。

DSH / Cordis / React 由运行时 `$DSH_HOME/profiles/node_modules` 提供，不会在插件目录再装一份。

<details>
<summary>TUI、CLI 与更新</summary>

TUI 侧由 `./tui` 导出提供（`lib/tui.js`，注册 `deepSeekWebTui` 服务与 `deepseek-web` 命令树）：

```bash
dsh plugin --profile dsh-tui add dsh-deepseek-web-free
dsh-tui
```

本包带 CLI 可执行入口 `dsh-deepseek-web-free` → `lib/bin.js`（`package.json` 的 `bin` 字段）：

```bash
dsh plugin --profile web exec dsh-deepseek-web-free status
dsh plugin --profile web exec dsh-deepseek-web-free login
dsh plugin --profile web exec dsh-deepseek-web-free doctor
```

升级：

```bash
dsh plugin --profile web update dsh-deepseek-web-free
```

**无界面回退**（`login --token-stdin`）：从 stdin 读一行 token，调上游 `currentUser()` 校验，只打印脱敏后的账号哈希前缀与「把 token 存进 DSH 凭证的哪个键名」，**不落盘、不写凭证**。它**不能替代浏览器登录**：

```bash
dsh plugin --profile web exec dsh-deepseek-web-free login --token-stdin
```

> 直接执行 `lib/bin.js`（不经 `dsh`）时，`status` / `doctor` / `login` / `logout` / `browser` 只会打印提示，让你改用 `dsh plugin ... exec` —— 因为凭证解析和浏览器 profile 都要靠 DSH 运行时。无参数则打印 usage。

</details>

<details>
<summary>包导出（供其他插件/宿主引用）</summary>

`package.json` 的 `exports` 共六项：

| 子路径 | 目标 | 用途 |
| --- | --- | --- |
| `.` | `lib/index.js` | 插件主体（宿主侧） |
| `./client` | `lib/client.js` | 客户端 `__ModuleLoader__.load` bundle |
| `./tui` | `lib/tui.js` | TUI profile 侧 |
| `./invariant` | `lib/invariant.js` | 向 `ctx.invariants` 注册包名不变量 |
| `./cordis.patch.yml` | `cordis.patch.yml` | 装载补丁 |
| `./package.json` | `package.json` | 元数据 |

</details>

## 能力

（截图资源只在 GitHub 仓库中提供，npm 包内不含 gif。）

<table>
<tr>
<td>
<img src="docs/assets/showcase-login.gif" alt="设置中用隔离浏览器登录 DeepSeek Web" width="720">
<p><b>隔离浏览器登录。</b> 用独立浏览器登录 <code>chat.deepseek.com</code>，不读取日常 Chrome / Edge 配置。凭证只保存在 DSH 存储中。</p>
</td>
</tr>
<tr>
<td>
<img src="docs/assets/showcase-switch.gif" alt="在输入栏切换 DeepSeek Web 模型与 DeepThink 推理等级" width="720">
<p><b>切换模型。</b> 可在 <code>DeepSeek Web</code> 与 <code>DeepSeek Web Expert</code> 之间切换，并选择 DeepThink 推理等级。底部显示当轮耗时与首 token 延迟。</p>
</td>
</tr>
<tr>
<td>
<img src="docs/assets/showcase-list.gif" alt="侧栏浮层列出 DeepSeek Web 网页会话" width="720">
<p><b>网页会话列表。</b> 侧栏底部打开浮层，列出 DeepSeek 网页端上的会话，可刷新与滚动加载。</p>
</td>
</tr>
<tr>
<td>
<img src="docs/assets/showcase-load.gif" alt="从浮层打开网页会话并在 Harness 中接续" width="720">
<p><b>接续网页会话。</b> 点选一条会话后在 Harness 里打开；replay 有效时续写原来的网页会话。导入时只保留用户原文。</p>
</td>
</tr>
<tr>
<td>
<img src="docs/assets/showcase-fork.gif" alt="把助手消息派生到选定工作区后独立续聊" width="720">
<p><b>派生到工作区。</b> 把 DeepSeek 网页端的会话派生到你选择的工作区。派生后的会话不写回原来的网页会话。</p>
</td>
</tr>
<tr>
<td>
<img src="docs/assets/showcase-clean.gif" alt="使用斜杠命令 /clean 只发送用户原文" width="720">
<p><b><code>/clean</code>。</b> 会话开关。打开后后续每一轮只发送你的原文（不含系统提示、工具、skills），可配合接续聊天接近网页端效果。再执行一次关闭。</p>
</td>
</tr>
</table>

| 能力 | 说明 |
| --- | --- |
| DSH 原生工具 | 将 DeepSeek 网页端接入 Harness；插件把模型输出转成工具请求。FS / Shell / MCP / 审批由 Harness 执行 |
| 网页搜索 | 始终开启官方网页端 Web Search；Expert 不能搜；不是 DSH `web_search` |
| 预构建 WASM | 安装无需 Rust / wasm-pack；token 与 cookie **不进入** WASM |

详见 [docs/remote-sessions.md](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/remote-sessions.md)。

## 模型

| ID | 名称 | 输入模态 | 网页原生搜索 |
| --- | --- | --- | --- |
| `deepseek-web/default` | DeepSeek Web | 纯文本 | 每轮开启 |
| `deepseek-web/expert` | DeepSeek Web Expert | 纯文本 | 不开启（协议上不能搜） |

思考为 `on` / `off`（默认 `on`）。`default` 的每一轮（含续写和 `/clean`）都会打开网页搜索，插件设置里关不掉。引用来源会出现在时间线上；不会注册 DSH `web_search` 提供方。

**输入模态目前为纯文本**：传入图片（`ImageBlock`）会直接抛 `DeepSeek Web does not support image understanding`，不会静默丢弃。

## 装载行为与可配置项

### ⚠️ 装载补丁会改默认模型

`cordis.patch.yml` 不只有「插入插件」，它还有一条**覆盖宿主默认模型**的补丁：

```yaml
- id: agent-default-model
  config:
    provider: deepseek-web
    model: default
```

也就是说：**装上本插件后，新会话的默认模型会变成 `deepseek-web/default`。** 如果你此前在设置里**显式保存过**默认模型，那份保存值会胜过这里的 bundle 默认值（补丁注释里写明 "A saved agent-default-model setting, when present, still wins over this bundle value"）；如果你从没手动设过，就会落到 `deepseek-web/default`。不想改默认模型的话，装完到设置里重新选一次即可。

> 这条是**上游行为，本 fork 原样承袭**（上游 `packages/plugin/cordis.patch.yml` 同样有这一块）。注意：某些本地安装的上游副本（如 `profiles/web/node_modules/dsh-deepseek-web`）被人为改过，注释写着 "Locally adjusted by DSH … upstream agent-default-model override stripped"，把这段删了 —— 那是本地改的，不是上游发布态。**判断"插件装完会不会改默认模型"，要看你实际安装的那份 `cordis.patch.yml`，别照着别处的副本推断。**

### patch 同时插入 provider 与 TUI 两个条目

上游的 `cordis.patch.yml` 除了 provider，还会顺带插入一条 TUI 条目。本 fork 与上游结构一致：

```yaml
- insert:
    - id: llm-deepseek-web-free
      name: dsh-deepseek-web-free
    - id: deepseek-web-free-tui
      name: dsh-deepseek-web-free/tui
      inject: [deepSeekWeb]
```

第二条让 `lib/tui.js`（注册 `deepSeekWebTui` 服务、提供 `/deepseek-web` 命令与 TUI 命令树）在 TUI profile 里**自动挂载**。

> **历史（v1.0.9 及更早）**：1.0.6 改包名时只改出第一条 insert，第二条被漏掉——`exports["./tui"]` 与 `lib/tui.js` 都在，但**永远不会被挂载**（`deepSeekWeb` 服务在 TUI 里不存在）。v1.0.10 补回。这个 bug 的特征是「文件在、导出在、插件启动正常，只是那个子能力静默消失」，任何"文件存在性"检查都会放行。

### 用户可配置字段

`Config` schema（`lib/index.js`，Schemastery `z.object`，全部字段标 `.volatile()`）暴露这些：

| 字段 | 类型 / 取值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `tokenEnv` | 字符串（`.role("credential-ref")`） | `DEEPSEEK_WEB_TOKEN` | 到 DSH 凭证存储里取 token 用的键名 |
| `defaultModel` | `default` \| `expert` | `default` | 新建会话用哪个模型 |
| `thinking` | `enabled` \| `disabled` | `enabled` | DeepThink 推理 |
| `streamIdleTimeoutMs` | 数字 | `180000` | SSE 空闲超时（毫秒） |
| `maxToolProtocolBytes` | 数字 | `131072` | 单次工具协议块字节上限 |
| `maxToolCallsPerTurn` | 数字，**须为 1..32 整数** | `16` | 每轮最多工具调用数；越界会抛 `maxToolCallsPerTurn must be an integer in 1..32` |
| `maxProtocolRepairAttempts` | 数字 | `2` | 协议解析失败的修复重试次数 |
| `maxToolResultBytes` | 数字 | `65536` | 单个工具结果回传上限 |
| `browser.preferred` | `auto` \| `chrome` \| `edge` \| `brave` \| `chromium` \| `managed` | `auto` | 登录用哪个浏览器；`managed` 表示由插件托管下载 |
| `browser.allowManagedDownload` | 布尔 | `true` | 允许插件自行下载托管浏览器 |

配置写坏时不会崩：`options()` 会保留上一次的好配置并打一条 `keeping last good configuration after invalid settings`。

> 注：`nativeSearch` 虽然出现在内部默认值里，但**不在** `Config` schema 中 —— `resolveConfig` 里硬编码成 `"on"`，所以用户改不了，这与下面「模型」节的描述一致。

## 命令

斜杠命令不会把 `/…` 原文发给模型。

- `/deepseek-web [status|login|logout|doctor]` — 账号相关
- `/clean [message]` — 当前会话开关。打开后后续每一轮只发送你的原文（不含系统提示、工具、skills）。再执行一次 `/clean` 关闭。

## 数据去向 / 隐私边界

`package.json` 的 `disclosure` 字段是本插件的**机器可读隐私声明**，内容与下面逐条对应：

| 字段 | 取值 | 含义 |
| --- | --- | --- |
| `cloud` | `true` | 会把对话内容发到云端服务 |
| `network` | `https://chat.deepseek.com` | **唯一**外联目标。插件不访问 `api.deepseek.com`，也不访问任何第三方域名 |
| `offlineMode` | `false` | 不支持离线使用 |
| `apiKeys[0].env` | `DEEPSEEK_WEB_TOKEN` | 凭证键名（`tokenEnv` 的默认值） |
| `apiKeys[0].storage` | `dsh-credentials` | 凭证只写进 DSH 凭证存储，不写插件目录明文 |
| `permissions.network` | `chat.deepseek.com` | 网络权限范围 |
| `permissions.filesystem` | `plugin-isolated-browser-profile` | 唯一文件系统访问范围是插件隔离的浏览器 profile |
| `permissions.env` | `DEEPSEEK_WEB_TOKEN` | 读取的环境变量只有这一个 |
| `jurisdiction` | `PIPL(CN)` | 受中华人民共和国个人信息保护法约束 |
| `retention` | `session` | 凭证/会话数据保留到会话期，不做长期归档 |

具体地：

- **发出去的是什么**：你的消息文本、系统提示、工具定义（除非 `/clean` 打开）、以及 Harness 侧的工具结果，经 `chat.deepseek.com/api/v0/` 的 HTTPS/SSE 通道发给 DeepSeek 网页端。响应只回流到本机。
- **不发出去的是什么**：插件**不**上传本地文件、不采集遥测、不内嵌任何分析 SDK。文件要想让模型看到，必须由 Harness 的读文件工具读成文本再进对话。
- **本机留下了什么**：① DSH 凭证存储里的 token（键名 `DEEPSEEK_WEB_TOKEN`）；② 插件隔离浏览器 profile，位于 DSH 主目录下的 `browser-profiles/dsh-deepseek-web`（有意沿用旧名）；③ 浏览器缓存位于 `cache/dsh-deepseek-web/browser`。这三处之外不写盘。
- **谁在执行**：DeepSeek Web 没有官方 function calling。插件只**解析**模型输出并转成工具请求；适配器**从不**执行 shell、读盘或 MCP —— 真正的执行在 Harness 侧，受 Harness 的审批门管控。

## 架构

| 层 | 职责 |
| --- | --- |
| TypeScript 开源层 | HTTP、SSE、浏览器登录、凭证、DSH 适配器、工具桥、回放 |
| 预编译 WASM 核心 | 协议兼容与 PoW |

宿主侧 HTTP 路由挂在 `/plugins/dsh-deepseek-web-free/` 前缀下（`auth/login`、`auth/logout`、`auth/cancel`、`auth/status`、`doctor`、`account`、`fork`、`sessions`）。这些是插件内部路由，不构成对外 API。

## 安全

- 不要打印 `.credentials.yaml`、Bearer token、CDP 地址或浏览器配置目录的绝对路径（`lib/bin.js` 出错时走 `redactSensitiveText` 后再写 stderr）
- 登录只使用插件隔离 profile
- 凭证只写入 DSH 凭证存储

披露流程见 [SECURITY.md](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/SECURITY.md)。浏览器登录细节见 [docs/browser-auth.md](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/browser-auth.md)。

## 仓库结构

**根目录是 npm 包 `dsh-deepseek-web-free` 的发布根**：`lib/`（构建产物）、`wasm/`（预编译协议核）、`cordis.patch.yml`、`package.json`、`README.md`、`LICENSE`、`CHANGELOG.md`、`docs/`。`files` 白名单锁定的就是这些。

仓库里另有一批**只为开发/存档服务、不进 npm 包**的目录：

| 路径 | 作用 | 进 npm 包 |
| --- | --- | --- |
| `lib/` `wasm/` `cordis.patch.yml` `package.json` `README.md` `LICENSE` `CHANGELOG.md` `docs/` | **插件本体 + 随包文档** | ✅ |
| `packages/` | 上游 `y-wi/dsh-deepseek-web` **1.0.3 的 TypeScript 源码存档**（`compat/` + `plugin/`） | ❌ |
| `docs/upstream/` | 上游原仓库的 README 与工作区 `package.json` 存档 | ❌ |
| `tests/` `scripts/` `tsconfig.base.json` `vitest.config.ts` | 测试、构建脚本、TS/Vitest 配置 | ❌ |
| `pnpm-workspace.yaml` `pnpm-lock.yaml` | 工作区与锁文件 | ❌ |
| `LICENSES/` | 预编译核心的第三方许可原文 | ❌ |
| `.github/` | CI 与模板 | ❌ |

> ⚠️ **`packages/` 里的 TS 源码不能重新构建出当前的 `lib/`。** 1.0.4 起的全部修复是直接改在 `lib/` 构建产物上的（见 CHANGELOG）。**以 `lib/` 为准**，`packages/` 只作 1.0.3 上游基线存档。

> ⚠️ 本机开发副本 `~/.dsh/local-plugins/dsh-deepseek-web-free` 只保留上表第一行的发布子集，不含 `packages/` `tests/` `scripts/` `LICENSES/` 等开发目录 —— 那是正常的，不是文件丢失。

## 文档

- [安装](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/INSTALL.md)
- [贡献](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/CONTRIBUTING.md)
- [English README](https://github.com/loyalchiiina/dsh-deepseek-web-free/blob/main/docs/README.en.md)
- [上游项目](https://github.com/y-wi/dsh-deepseek-web)

## 许可证

TypeScript 集成层为 MIT（`LICENSE`，版权声明沿用上游 "dsh-deepseek-web contributors"）。预编译核心的第三方许可原文见上游仓库的 `LICENSES/PROTOCOL_CORE.txt`（该目录不进 npm 包）。第三方声明见上游 `THIRD_PARTY_NOTICES.md`。
