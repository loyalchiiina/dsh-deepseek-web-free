# Changelog

本 fork（npm 包名 `dsh-deepseek-web-free`）相对上游 [`y-wi/dsh-deepseek-web@1.0.3`](https://github.com/y-wi/dsh-deepseek-web) 的改动记录。

## 1.0.10 — 2026-10-19

**修 1.0.9 里如实标注为「已知问题」的那个真 bug：TUI 永远不挂载。**

| 项 | 内容 |
| --- | --- |
| 症状 | `exports["./tui"]` 与 `lib/tui.js` 都在，但 TUI profile 里 `deepSeekWeb` 服务不存在、`/deepseek-web` 命令不可用——永远不会被自动挂载 |
| 根因 | `cordis.patch.yml` 的 `insert` 只有 1 条（`llm-deepseek-web-free`），缺少上游那条 TUI 条目。1.0.6 改包名时，上游的 `deepseek-web-tui` / `dsh-deepseek-web/tui` 两条 insert 只改出了一条 |
| 修法 | 补回第二条：`- id: deepseek-web-free-tui` / `name: dsh-deepseek-web-free/tui` / `inject: [deepSeekWeb]` |
| 取证 | 上游 `dsh-deepseek-web@1.0.3` 的 `package/cordis.patch.yml`（`npm pack` 解包实测）确有两条 insert；本 fork 修前只有一条。子路径挂载语法在官方包里亦有先例（`dsh-ops` 的 `exports` 含 `./shell` / `./file` / `./background` / `./ptc`，`cordis.yml` 以 `name: dsh-ops/shell` 挂载） |
| 验证 | `js-yaml` 解析通过，2 个顶级条目、`insert` 含 2 条；无 BOM |

### 教训

- 🔴 **改包名时，`cordis.patch.yml` 里的 `name:` 每一行都要数一遍条数**：`insert` 是数组，漏一条不会报错，插件照常启动，只是那个子能力静默消失。**「改名前有几条 insert」应当是改名操作的前置基线**，改完拿条数对比，而不是只看第一条改对了没有。
- 🔴 **`exports` 里有子路径 ≠ 会被挂载**：`exports["./tui"]` 只说明"可以被解析到"，真正决定加不加载的是 bundle patch 里那条 `insert`。两者同时存在才有效，缺任一半都是「文件在、功能不在」。
- 🔴 **1.0.9 把它标成「已知问题」是对的，但不能停在那里**：文档如实标注只是止血，真 bug 必须单独一版修掉，否则每一版都要在 README 里重复这段免责声明。

## 1.0.9 — 2026-10-19

**纯文档版本，`lib/*.js` 一行未改。** 目标是让文档与代码真实行为一致。

| # | 问题 | 修法 | 取证 |
| --- | --- | --- | --- |
| 1 | 根 `README.md` 实质内容只有一句「See the repository README for install, models, tools, and security boundaries.」——而它**指向的就是它自己**（GitHub 根 README 同为 2498 B，md5 `6b462372…`）。npm 上点开 README 等于什么都没有。 | 重写根 README：补安装、能力、模型、命令、架构、安全、数据去向各节，并从 `docs/README.md` 搬入实质内容 | `md5sum README.md` = `6b462372ca5df60cc933d6593c6f35a0`（本地）与实际 GitHub 根 README 一致；正文第 3 行即那句自指 |
| 2 | `files` 白名单不含 `docs/` → 真正的 6624 B 文档 `docs/README.md` **永远进不了 npm 包** | `files` 追加 `docs/README.md`（未加整个 `docs/`：其中 `docs/assets/` 是 6.2 MB 的 6 个 gif，只用于 GitHub 展示） | `gh api …/contents/docs/assets` 实测 6 个 gif 合计 6,252,701 B |
| 3 | README 从未提及 `bin`、`exports["./tui"]`、`exports["./invariant"]`、`login --token-stdin` | README 新增「TUI、CLI 与更新」「包导出」两节，逐项列全 | `package.json` 的 `bin` = `{"dsh-deepseek-web-free":"lib/bin.js"}`；`exports` 六项含 `./tui`、`./invariant`；`lib/bin.js:8` 判 `action === "login" && flag === "--token-stdin"` |
| 4 | README 从未提及隐私披露 | README 新增「数据去向 / 隐私边界」，把 `disclosure` 逐字段列表解释 | `package.json` 顶层 `disclosure`（**不在 `dsh` 块内**）实测值 |
| 5 | 旧 README 称「根目录就是插件本体」，与仓库实况不符（仓库根还有 `packages/ docs/ tests/ scripts/ .github/ LICENSES/ pnpm-workspace.yaml` 等） | 新增「仓库结构」表：哪些是插件本体（进包）、哪些是开发/存档目录（不进包） | `gh api …/contents/` 根目录清单实测 |
| 6 | `docs/README.md` 是上游原文：标题 `# dsh-deepseek-web`、安装命令与 npm 链接全指上游包、全文 `free` 出现 **0** 次。读者照它装会装到不含本 fork 修复的旧版 | 改写为本 fork 版：标题/包名/安装命令/徽章全换成 `-free`，新增「与上游的关系」对照表 + 6 条修复清单，上游原文保留到 `docs/upstream/README.upstream.md` | 上游原文全文 grep `free` 计数 = 0；安装命令原文为 `dsh plugin --profile web add dsh-deepseek-web` |
| 7 | `description` 只描述"在 packages/plugin 里"，对用户无信息量 | 改中英双语，讲清是 fork + 适配 DSH 0.2.x | — |
| 8 | **（核对中新发现）** 文档从未提 `cordis.patch.yml` 里那条 `agent-default-model` 覆盖 —— 装上插件会**改用户新会话的默认模型**，这是最容易被当成"DSH 坏了"的行为变化 | README 新增「装载行为与可配置项」，把补丁原文与生效优先级写清；docs 对照表与修复清单各补一条 | 本地 `cordis.patch.yml` 含 `- id: agent-default-model` / `config: {provider: deepseek-web, model: default}`；**经与上游 `gh api repos/y-wi/dsh-deepseek-web/contents/packages/plugin/cordis.patch.yml` 比对，上游也有同一块** → 属原样承袭，非本 fork 新增。但本机 `profiles/web/node_modules/dsh-deepseek-web/cordis.patch.yml` 被人为删掉了这段（注释 "Locally adjusted by DSH (2026-08-20): upstream agent-default-model override stripped"），三份副本互不一致 |
| 9 | **（核对中新发现）** 文档从未列用户可配置字段 | README 新增 `Config` schema 全字段表（10 项 + 取值范围 + 默认值 + 越界报错），并注明 `nativeSearch` **不在** schema 中（`resolveConfig` 硬编码 `"on"`） | `lib/index.js` 的 `z.object({...})` 实测；`lib/config-DACadRbL.js` 的 `resolveConfig` 中 `nativeSearch: "on"` 为字面量 |
| 10 | **（核对中新发现，未修）** 本 fork 的 `cordis.patch.yml` **缺上游那条 TUI insert 条目** —— 上游有 `deepseek-web-tui` / `dsh-deepseek-web/tui` / `inject: [deepSeekWeb]` 两条 insert，本 fork 只剩 `llm-deepseek-web-free` 一条。后果：`./tui` 导出存在但**不会被自动挂载**，TUI profile 里 `deepSeekWeb` 服务不存在 | 1.0.9 只改文档 → 在 README 与 docs 中**如实标注为已知问题并给出手工补条目的写法**；修 patch 需动 `cordis.patch.yml`（非文档），留待下一版 | 上游 patch 两条 insert vs 本 fork 一条，`gh api` 原文与本地 `cat` 直接对比 |

### 教训

- 🔴 **「README 自指」是最隐形的空文档事故**：文件存在、大小正常、CI 不报错、GitHub 能渲染，只是内容在说「去看 README」。它和「文件丢失」的症状完全不同，任何"文件非空"的检查都会放行。**判定文档是否为空壳，要读正文第一句在指什么，不要只看字节数。**
- 🔴 **`files` 白名单是发布事故的常客**：不在白名单里的文件，GitHub 上看着好好的，npm 用户一个字节都拿不到。**发布前必跑 `npm pack --dry-run` 看实际清单**，确认 README 有实质内容、`docs/` 等打算随包的目录确实在里面；`npm pack --dry-run --json` 更直观。
- 🔴 **fork 必须清掉上游的"安装指路牌"**：文档里的包名、安装命令、npm 链接、徽章仓库名，任何一处还指着上游，读者就会装错包、然后以为自己遇到的是本 fork 的 bug。改包名时 `README*` 里的 `dsh-deepseek-web` 必须逐处核查（注意别误改"上游项目地址"这类**本意就要指上游**的链接）。
- 🔴 **往 `files` 里加目录前先看目录里有什么**：`docs/` 里塞着 6.2 MB 的演示 gif，整目录入包会让 tarball 暴涨且对 npm 用户毫无用处（npm 页面不渲染包内图片）。只加真正需要的文件。
- 🔴 **函数式参数（functional options）会藏住"隐藏的全局副作用"**：`apply(ctx, config)` 里那次 `resolveConfig(raw)` 返回的 `nativeSearch: "on"` 是**硬编码字面量**，`Config` schema 里根本没有这个键。看 schema 会以为"可配置"，看默认值会以为"配置改了能生效"，实际两条路都不通。**判断某选项是否可配置，要同时看 schema 里有没有它、以及最终 resolve 时用的是 raw 还是常量。**
- 🔴 **补丁文件的"副作用"必须写进文档**：`cordis.patch.yml` 里那条 `- id: agent-default-model` 会改宿主默认模型。这类"装插件顺带改了别处配置"的行为，用户不读 patch 文件就完全无从得知，出问题时只会报「DSH 自己变了」。**凡是 patch 里出现 `- id: <宿主自身条目>` 的覆盖块，README 必须点名。**
- 🔴 **同一份文件的三处副本可能互不一致，比对时必须找出处**：本轮差点把"上游 patch 也有 `agent-default-model`"误写成"本 fork 新增"——因为本机 `profiles/web/node_modules/dsh-deepseek-web/cordis.patch.yml` 被本地改过、删掉了这段。**判断"某个行为是不是本 fork 引入的"，要拿上游仓库原文（`gh api …/contents/…`），不能拿本机某个安装副本当基准。** 三个副本状态：上游 GitHub 原文 = 有覆盖块 + 两条 insert；本 fork = 有覆盖块 + 一条 insert；本机 web profile 的上游副本 = 无覆盖块 + 一条 insert（本地手改）。
- 🔴 **改名时要数"条目个数"，不只是改字符串**：1.0.6 改包名时，上游 patch 有**两条** insert 条目，改完只剩一条（TUI 那条整个丢了），而 `./tui` 导出和 `lib/tui.js` 都还在。字符串搜索永远发现不了"少了一条"。**改名后要拿新旧文件做结构对比（条目数、层级、key 集合），不要只 grep 名字对不对。**

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
