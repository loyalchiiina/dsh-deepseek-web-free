# Changelog

本 fork（npm 包名 `dsh-deepseek-web-free`）相对上游 [`y-wi/dsh-deepseek-web@1.0.3`](https://github.com/y-wi/dsh-deepseek-web) 的改动记录。

## 1.0.6

- **改名**：包名 `dsh-deepseek-web` → `dsh-deepseek-web-free`（上游包名被原作者占用，无法同名发布）。
  同步改：`cordis.patch.yml` 的 insert `name` 与条目 id、`lib/client.js` 的 `__ModuleLoader__` bundle id、
  全部 `/plugins/dsh-deepseek-web/...` 路由前缀、`bin` 名、README 标题。
  **未改**：`provider` id 仍为 `deepseek-web`（保持既有会话与模型选择兼容）；
  浏览器 profile 目录（`browser-profiles/`）与缓存目录名也保持不变，避免用户重新登录。
- 增加本 CHANGELOG，并把 `CHANGELOG.md` 加入 npm `files` 白名单。

## 1.0.5

- 🔴 **修「上游错误被吞掉」——比报错更坏的故障模式**。
  上游在收到服务端的 SSE `hint` 事件（`{"type":"error","content":"...","finish_reason":"backend_err"}`）时
  会返回一条**空内容消息并当作正常结束**，DSH 因此把空回复写进会话历史；
  下一轮带 `parentMessageId` 重放时服务端回 `invalid message id`（`DEEPSEEK_WEB_PROTOCOL`），
  表现为「插件不报错、但对话不能用」。
  现在 `event === "hint" && hint.type === "error"` 直接抛 `DEEPSEEK_WEB_HTTP` 错误，
  带上服务端原文（如「服务器暂时不可用」），并在读取循环的 catch 里取消连接。
  选 `HTTP` 而非 `PROTOCOL` 是有意的：`PROTOCOL` 会触发「重建会话 + 重试一次」，
  在上游整体故障时只会多等一轮。

## 1.0.4

- **适配 DSH 0.2.1-alpha.2**。新版 `@deepseek-ai/dsh-settings` 移除了
  `installSettingsSection` / `settingsNamespace` 两个导出（ESM 具名导入在链接期校验，缺名即 SyntaxError）。
  改为官方新模型：`ctx.inject(["settings"], (child) => child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)))`
  ＋ 配置字段标 `.volatile()`，并监听 `loader/volatile-update` 清除配置 memo 缓存
  （volatile 包装对象引用恒定，不监听会导致热更新后仍读旧值且不报错）。
- **客户端图标换名**：新版 `dsh-client-ui-primitives` 已废除 `Icon*Outline14/16` 命名，
  改为 `Icon*OutlineRegular`（stroke 1）/ `*OutlineMedium`（stroke 1.3）。
  不改会命中 React error #130，槽位渲染崩。
- **`peerDependencies` 改为范围写法**（`>=0.1.7-rc.1 <0.2.0-0 || >=0.2.0-rc.1 <0.3.0-0`）。
  DSH 装载插件前跑兼容性门禁，把 peer 里所有 `@deepseek-ai/dsh*` 项与运行时版本比对，
  精确钉版（原 `^0.1.0-rc.7`）会被整体拒绝装载，且**静默跳过、零日志**。

## 上游基线

- 1.0.3 及以前：见上游仓库。
