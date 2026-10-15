# Changelog

本 fork（npm 包名 `dsh-deepseek-web-free`）相对上游 [`y-wi/dsh-deepseek-web@1.0.3`](https://github.com/y-wi/dsh-deepseek-web) 的改动记录。

## 1.0.8

- **侧边栏会话浮层背景改为不透明**。`.dsw-web-menu` 原本沿用宿主的
  `background:var(--dsw-specific-menu)`，而该 token 在浅色主题是 `#f8f9fa94`（alpha 58%）、
  深色主题是 `#43454a73`（alpha 45%）。宿主自己的弹层是**两件套**：
  半透明底色 **加** `backdrop-filter: blur(...)` 磨砂；本插件是自己往 `document.body`
  里挂的普通 div，装不了 `backdrop-filter`（祖先链上没有可模糊的合成层），
  只抄了一半 → 底色半透明、背后内容直接透出来。
  现改用 `background:var(--dsw-alias-bg-layer-3)`（浅色 `#fff` / 深色 `#353638`，
  两个主题取值**都完全不透明**），这是 DSH 给"抬升面板"用的不透明表面色，
  视觉上与"菜单色叠在层三底色上"的结果只差 4/255（浅）与 8/255（深）。

- 教训（通用）：**抄宿主弹层的配色时，先确认宿主是不是"半透明底 + backdrop-filter"两件套。**
  只抄 `background` 不会得到同样的观感；要么把 backdrop-filter 一并抄来，
  要么换成不透明的等价 token。判定"某 token 是否透明"不能只看名字，
  必须把 var 链解析到最终字面色值（看 `#rrggbbaa` 的 aa）。

## 1.0.7

- 🔴 **修改名遗留的路径切片 bug**（1.0.6 改名时漏改，导致侧边栏会话列表整块不可用）。
  `lib/index.js` 的 `registerSessionRoutes` 里用**硬编码长度**切掉路由前缀：
  `const rest = url.pathname.slice(34);` —— `34` 恰好是旧前缀
  `/plugins/dsh-deepseek-web/sessions` 的字符数。改名后新前缀
  `/plugins/dsh-deepseek-web-free/sessions` 长 39，切片从第 34 位开始会切出 `"sions"`，
  于是 `rest` 既不等于 `""` 也匹配不上 `/history` / `/materialize` 正则，
  **所有 sessions 请求都被插件自己的兜底分支回成 404**
  （`{"error":"not found","code":"DEEPSEEK_WEB_PROTOCOL"}`）。
  而 `/auth/status`、`/account`、`/doctor` 是 `kind:"exact"` 路由、不经过切片，
  所以「登录能成功、会话列表却是空/报错」。
  现在改为 `url.pathname.slice(SESSIONS_PATH.length)`，前缀长度由常量自身决定，
  以后改名/改前缀不会再漏。

- 说明（**有意保留，勿改**）：`lib/config-DACadRbL.js` 的 `profileDir()` / `cacheDir()`
  仍用旧名拼路径 —— `<DSH_HOME>/browser-profiles/dsh-deepseek-web` 与
  `<DSH_HOME>/cache/dsh-deepseek-web/browser`。这是**故意不改**的：磁盘上该目录已存在，
  里面是免退出登录用的浏览器 profile；改名等于把用户登录态丢掉。数据目录名与包名解耦，
  两者不一致是预期状态。
- 教训：改名类改动**不能只搜字符串字面量**。凡是用长度/偏移量解析路径的地方
  （`slice(n)` / `substring(n)` / `substr(n)` / `pathname.length - k`）都要一并核查；
  本文档上一版（1.0.6）已声明"全部路由前缀已改"，但长度常量没有被当成前缀的派生量。

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
