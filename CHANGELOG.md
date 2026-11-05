## 1.0.32

发布工程性修复（不改运行代码，功能与 1.0.31 一致）：
- **修复 CI 全红**：根 `package.json` 的 `typecheck` / `test` / `build` 脚本改为按 workspace 递归执行（`pnpm -r typecheck` / `pnpm -r build`），并补回原本缺失的 `pack:plugin`（`pnpm --filter ./packages/plugin pack --pack-destination packages/plugin`）。此前根目录缺少 `tsconfig.json` 却执行 `tsc -p tsconfig.json`，CI 报 `TS5058: The specified path does not exist: 'tsconfig.json'`，导致 6 个 matrix job 全部失败。
- **清理发布包**：移除 `lib/` 下 15 个开发遗留备份文件（`client.js.bak-1.0.12-float` … `1.0.25-pre`、`client.js.orig-1.0.10`、`index.js.bak-26.11.05-00.18`），并将 `files` 白名单从整目录 `"lib"` 收紧为 `lib/*.js` / `lib/*.d.ts` / `lib/*.map`。npm 包文件数 42 → 27，不再夹带内部历史/调试版本。
- 运行代码（`lib/client.js`、`lib/index.js` 等）无任何改动，功能与 1.0.31 完全一致。

## 1.0.31

本次升级新增（相对上游 1.0.3 基线，均由本插件维护者新增，非上游原有）：
- **支持图片输入**：在 DSH 里发送图片时，读取附件字节并上传到 DeepSeek（`/api/v0/file/upload_file` → 轮询 `fetch_files`），以 `ref_file_ids` 随消息发送，模型即可识图；`default` 模型 `inputModalities` 增加 `image`。支持 PNG / JPEG / WebP / GIF，单张上限 5 MB。
- **修复**：读取 DSH 图片附件时兼容 `sha256:` 前缀的 attachmentId，并改用「环境变量 / 库 / 用户主目录 `.dsh`」多候选路径解析（修复部分环境下解析出错误目录导致的 ENOENT）。
- **README / 效果图**：功能描述改为「文本 + 图片」并更新能力表；效果图整体替换为 4 张新截图（网页面板、面板内对话 + 换模型、位置切换、设置页），移除旧 gif。

维护者贡献与来源说明：
- 本插件基于上游 [y-wi/dsh-deepseek-web](https://github.com/y-wi/dsh-deepseek-web) 1.0.3 基线。以下为**本插件维护者自行新增/改造**的部分（非上游原有）：
  - **内嵌网页面板**：侧栏标签页 + 鲸鱼悬浮球（登录一次双向同步）——维护者新增。
  - **网页搜索（智能搜索）全程开启**：`nativeSearch` 固定为始终开启，主对话每轮都带官方网页搜索。
  - **移除 Expert（专家）模式**：原作者的 Expert 分支所依赖的网页端行为已变更，不再适用于最新 chat.deepseek.com 网页端与最新 DSH 版本，故模型列表不再提供 Expert。
  - **图片输入**（本版 1.0.31）：见上。
  - 持续适配最新网页端与最新 DSH 版本。
- 上游原有能力：把 DeepSeek 网页端当作 LLM 模型使用（基础文本对话）。
- 参考：本版「图片输入」的思路参考开源项目 [agent2api](https://github.com/aimod-cc/agent2api)（其 deepseek-web provider 为 Rust 实现）；两者协议一致（upload_file → fetch_files 轮询 → ref_file_ids），本插件用自身 compat 层独立实现，**未复制其代码**。

## 1.0.30

- 文档与市场描述更新：README 增加「网页面板（侧栏标签页 / 鲸鱼悬浮球、登录一次双向同步、跨重启记忆）」能力说明；新增**醒目免责声明**（仅供个人方便使用、可能存在账号风险、作者不承担责任）。
- `package.json` 的 `description` 重写为包含「内嵌网页面板」的中英双语描述，`keywords` 增加 `deepseek-web` / `webview` / `sidebar-panel`，用于插件市场展示。
## 1.0.29

- 未登录提示文字按用户要求改为**黑色（#111）**、字号 15px → **19px**（大两号）、字重 700，并同样以内联样式固定（防主题覆盖）。红底大按钮保持 56px 不变。
## 1.0.28

- 未登录提示条改**红色**（`#d92c2c → #c81e2b` 渐变），关键颜色改用**内联样式**（上一版用主题变量，实际渲染成米黄条 + 黑按钮）；
- 「一键登录」字号放大到 **56px / 800 字重 / 112px 高通栏白底红字**按钮（原 15px），成为面板里视觉权重最大的元素；CSS 容器 id 升为 `dsh-deepseek-web/webpanel-auth4`。
## 1.0.27

- 未登录提示条再放大：改为**品牌实色大色块**（上下两行布局、占满面板宽度）——标题行 14.5px/600 白字 + 28px 钥匙图标，「一键登录」改为**通栏白底按钮**（44px 高、15px/700、圆角 12、投影）。CSS 容器 id 升为 `dsh-deepseek-web/webpanel-auth3`。
## 1.0.26

- 未登录提示条重做：品牌色渐变底、钥匙图标、正文 13px/500、按钮 34px 高（13.5px/600、圆角 10、投影、hover 提亮），并把 CSS 容器 id 升级为 `dsh-deepseek-web/webpanel-auth2` 以避开旧样式缓存。
## 1.0.25

- 修复「在网页面板里退出账号后，设置页仍显示已登录，再打开面板还要重新登录」：面板每 3 秒轮询时若发现页面已无 token 且停在 `/sign_in`，则反向调用宿主 `/auth/logout` 清掉旧凭据（此前只有「网页登录 → 宿主」单向同步，没有「网页退出 → 宿主」）。
- 已登录过一次的访客（`sawPageSession`）连续 2 次轮询即判定退出；从未登录过的（种子 token 已失效）等 6 次（约 18 秒）再判定，避免页面加载期间误清好凭据。
- `WebPanelGuest` 新增 `currentUrl()`，面板与侧栏 tab 均向提示条传 `readPageUrl`。
## 1.0.24

- 修复：在设置页已登录的情况下，侧栏 tab 能免登直接对话，但悬浮球窗口仍停在 sign_in 白页。原因是宿主凭据从「未登录」变为「已登录」时没有触发面板重新种 token。现在状态转为已登录会立即重载并重新注入 token，悬浮球打开即进对话。

## 1.0.23

- 登录/退出真正双向同步（设置页 ↔ 网页面板）：面板每 3 秒同时检查宿主凭据与网页自身会话，网页里登录的 token 会被读回并写入宿主凭据库，设置页 1 秒内转为已登录。
- 抓取时机不再依赖导航事件：DeepSeek 登录是单页流程，原实现只在 `dom-ready` / `did-stop-loading` 抓一次，容易漏。
- 宿主 `importToken` 改为「先存后验」：账号探测（currentUser）被 PoW/限流/断网挡住时不再丢弃 token，避免面板已登录而设置页永远未登录。
- 同步失败时面板提示条会直接显示失败原因，便于定位，不再静默。
## 1.0.22

- 修复侧边栏 tab 形态不同步登录态：该形态创建浏览器页时没有接上「页面登录后回传 token」的钩子，导致在侧栏面板里登录后，设置页仍显示未登录。
- 侧边栏 tab 与悬浮窗现在共用同一个浏览器分区常量（`WEBPANEL_WORKSPACE_KEY`），登录态必然一致。
- 新增双向同步：在设置页点退出后，面板里的网页会话也会被清掉（`WebPanelGuest.clearSession()`），不再出现「设置页已退出、面板还登着」。
- 面板未登录提示条抽成共用组件 `WebPanelAuthBanner`，两种形态都能一键登录，并在登录成功后自动刷新网页。
- token 抓取加固：支持 `userToken` 裸字符串与 JSON 信封、`*token*` 键名、JWT 形态值；单页路由跳转（`did-navigate-in-page`）也会重新触发抓取，登录后不再漏抓。
# Changelog

## 1.0.21

### Fixed

- **所有插件接口 404（严重）**：客户端打包时把 `/plugins/dsh-deepseek-web/...` 这些**宿主路由路径**也一起重命名成了 `/plugins/dsh-deepseek-web-free/...`（1.0.13 起的移植脚本全局正则误伤），而宿主注册的是原名 → 设置页「/auth/status returned 404」、面板 token 注入与登录统一全部失效。移植脚本改为只在**非 `/plugins/` 前缀**的模块 id 上重命名。
- 该 bug 也是「面板里登录不是永久登录」的一半原因：`GET /webpanel/token` 404 → 面板拿不到宿主 token，只能手登且关窗即丢。

## 1.0.20

### Added

- 登录统一（反向同步）：在网页面板里登录后，插件自动从页面的 `localStorage.userToken` 取回该会话 token，校验通过后写入宿主凭据库 —— 与设置页登录同一份永久凭据，重启 DSH 后模型列表与面板都无需重新登录。
- 面板顶部未登录提示条：检测到宿主未登录时显示说明与「一键登录」按钮，调用宿主登录流程（弹出浏览器完成登录）并轮询状态，成功后自动刷新面板。

### Fixed

- 新用户只会在面板里手动登录、退出后即失效的问题：面板运行在内存分区（每次启动换新 partition），此前没有反向同步，导致「面板登录 ≠ 永久登录」。

## 1.0.19

### Fixed

- 侧栏「位置」悬停弹层移出侧栏、从侧栏右边缘外侧弹出（垂直对齐入口按钮），不再盖住会话列表；右侧空间不足时自动翻到左侧。

## 1.0.18

### Changed

- 悬浮窗口默认停靠位置改为「主区左下角」：左边从左侧栏右边缘起（读取 `.dsw-webpanel-toggle-layer` 的 right，取不到时回退到视口宽度 18%），纵向底部对齐。窗口不再压住中部对话列。
- 未手动拖过窗口时，拖动鲸鱼球窗口保持该停靠位，不再横跨到屏幕最右侧。

## 1.0.17

### Changed

- 悬浮窗口默认停靠位置改为贴屏幕最右侧、纵向与鲸鱼球对齐（用户随后澄清不是想要的位置，1.0.18 再改）。

## 1.0.16

### Fixed

- 悬停「位置」选择器整块看不见：侧栏底部容器 overflow:hidden 裁掉了绝对定位弹层。改为 position:fixed + z-index:1300，按按钮 getBoundingClientRect 定位（1.0.15 的写法完全不可见）。
- 网页面板空白自愈：webview 加载 6 秒后仍停在 about:blank 时自动重试 navigate，最多 3 次。

### Changed

- 侧栏入口文案去掉「打开」二字（中英文同步）。

## 1.0.15

### Changed

- 悬浮窗口改为**相对鲸鱼球的偏移**（winOffset）存储：拖动鲸鱼球时窗口跟着走，恢复 1.0.13 的耦合手感。
- 旧版绝对坐标 win 字段降级为迁移用（deriveOffset），保存时强制写 win:null。
## 1.0.14

- 侧栏底部按钮改为「网页面板」开关：点一下按「位置」分派 —— 侧边栏 → 打开右侧栏 tab；悬浮球 → 展开/收起窗口（再点一次即收起）。
- 悬浮球窗口支持拉伸：右缘调宽、下缘调高、右下角双向拖拽（最小 320×420，不会拖出屏幕），尺寸自动记忆；标题栏自由拖动保持不变。
- 悬浮球鲸鱼图标放大（26→34px），撑满球体、去掉多余留白。
- 移除侧栏底部原有的「DeepSeek Web 会话」弹层入口（会话列表按钮），改为面板开关；会话续聊与「派生到工作区」不受影响。
- 设置页「网页面板」分区同步更新：「位置」改为「侧边栏 / 悬浮球」，「立即打开面板」按位置分派。
- 原有能力全部保留：provider `deepseek-web` 模型列表、default/expert、thinking、联网搜索、派生到工作区、隔离 browser profile、免登录 token 注入。
## 1.0.13

- 删除「浮层」形态，改为「悬浮球」：屏幕上常驻一颗可拖动的圆形按钮，点开是可拖动的小对话窗口（420×640），位置分别记忆。
- 悬浮球图标改用官方 DeepSeek 鲸鱼标志，并以 `currentColor` 上色 —— 浅色主题显示黑色、深色主题显示白色，不再是原来的蓝色。
- 悬浮球与窗口都支持自由拖动：按下移动超过 4px 才算拖动，否则视为点击展开/收起；窗口默认停在球的左侧、底部对齐，超出屏幕会自动收回可视区。
- 设置页「位置」选项改为「侧边栏 / 悬浮球」，默认侧边栏；原来的「面板宽度」百分比档位随浮层一起删除。
- 侧边栏形态完整保留：`Ctrl/Cmd+Shift+D` 在侧边栏位置下打开该 tab，在悬浮球位置下展开窗口；`Esc` 关闭窗口。
- 侧栏「DeepSeek Web 会话」弹层背景改为不透明（`--dsw-alias-bg-layer-3`），避免聊天内容透出。
- 旧配置自动迁移：以前存下的 `position: "float"` 会被识别为 `"ball"`，不需要手动改。
- 原有能力全部保留：provider `deepseek-web` 模型列表、default/expert、thinking、联网搜索、派生到工作区、隔离 browser profile、免登录 token 注入。

## 1.0.12

- 网页面板新增「侧边栏」形态：把 DeepSeek 网页注册成右侧栏里的一个独立 tab，与内置「浏览器」tab 并列，可随时开关、与对话互不遮挡。
- 设置页「网页面板」分区新增「位置」选项（侧边栏 / 浮层），默认侧边栏；「立即打开面板」与 `Ctrl/Cmd+Shift+D` 按所选位置分派。
- 侧栏会话菜单与「在面板打开」深链改为按位置分派：侧边栏位置下直接在该 tab 里打开对应会话，浮层位置下仍走抽屉。
- 浮层形态完整保留，可在设置里切回。

## 1.0.11 — DeepSeek 网页面板（浮层）

- 新增「网页面板」：在 DSH 界面内以右侧浮层直接打开 chat.deepseek.com，登录态由 Host 侧凭据自动注入（`localStorage.userToken`），无需在浮层内重新登录。
- 浮层注册到 `shell.overlay`（id `deepseek-web-panel`，order 40）：默认 70% 宽、左缘可拖拽调宽并记忆、`Ctrl/Cmd+Shift+D` 唤出/收起、`Esc` 关闭、关闭时保留 webview 页面不卸载。
- 新增 Host 路由 `GET /plugins/dsh-deepseek-web-free/webpanel/token`（同源限定，返回 `{status:"signed-in",token}` 或 `{status:"signed-out"}`）。
- 侧栏「DeepSeek Web 会话」弹层：每个会话行新增右侧小按钮「在面板打开」（深链 `chat.deepseek.com/a/chat/s/<id>`），底部新增「DeepSeek 网页面板」入口。
- 设置页新增「网页面板」分区：启用开关、宽度档位（50/60/70/80/100%）、立即打开、快捷键提示。
- 原有能力全部保留：provider `deepseek-web` 模型列表、default/expert、thinking、联网搜索、派生到工作区、隔离 browser profile。
- 修复：`src/index.ts` 的 `setSource` 隐式 any（TS7006）。

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
