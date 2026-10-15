# dsh-deepseek-web-free

See the repository README for install, models, tools, and security boundaries.

This package is a DeepSeek Harness plugin. It uses DeepSeek Web through a
compatibility layer, is not the official Open Platform adapter, and does not
bypass CAPTCHA/WAF or account access controls.

After browser sign-in, the sidebar footer lists DeepSeek Web conversations. Fork
to Workspace creates an independent Harness session that does not write back to
the original Web conversation. Native search stays on for `default`. `/clean`
is a session toggle that sends only the human text.

## 本 fork 的差异（`dsh-deepseek-web-free`）

本包是 [`y-wi/dsh-deepseek-web`](https://github.com/y-wi/dsh-deepseek-web) 的 fork，
包名改为 `dsh-deepseek-web-free`（上游包名 `dsh-deepseek-web` 已被原作者占用，无法同名发布）。

相对上游的改动（详见 [CHANGELOG.md](./CHANGELOG.md)）：

- **适配 DSH 0.2.1-alpha.2**：`@deepseek-ai/dsh-settings` 的 `installSettingsSection` /
  `settingsNamespace` 已被新版移除，改用 `ctx.settings.configure()` + 配置字段 `.volatile()`。
- **客户端图标换名**：`Icon*Outline16/14` 命名已废除 → `Icon*OutlineRegular`
  （否则 React error #130，槽位渲染崩）。
- **`peerDependencies` 改范围写法**：精确钉版会被 DSH 插件兼容性门禁**静默拒绝装载**。
- **上游错误不再被吞掉**：服务端 SSE `hint` 带 `type:"error"`（如 `finish_reason:"backend_err"`）时，
  原来会返回**空消息**并当作成功，毒化会话历史、下一轮报 `invalid message id`；
  现在直接抛出可见错误。

`provider` id 仍为 `deepseek-web`，浏览器 profile / 缓存目录名保持不变（避免重新登录）。

## 仓库结构

本仓库的**根目录就是插件本体**（`lib/` 构建产物 + `wasm/` 预编译协议核 + `cordis.patch.yml` + `package.json`），
npm 包 `dsh-deepseek-web-free` 发布的就是这些文件。

`packages/` 下保留上游 [`y-wi/dsh-deepseek-web`](https://github.com/y-wi/dsh-deepseek-web) **1.0.3 的 TypeScript 源码**作为存档；
`docs/upstream/` 下保留上游原仓库的 README 与工作区 `package.json`。

⚠️ 说明：1.0.4 起的修复是**直接改在 `lib/` 构建产物上**的（见 CHANGELOG），
`packages/` 里的 TS 源码**不能重新构建出**当前的 `lib/`。以 `lib/` 为准。
许可证与版权声明沿用上游（MIT）。
