<div align="center">

# dsh-deepseek-web

**Connect DeepSeek Web to DeepSeek Harness**

[English](./README.en.md) · [中文](./README.md) · [Install](./INSTALL.md) · [npm](https://www.npmjs.com/package/dsh-deepseek-web)

[![npm](https://img.shields.io/npm/v/dsh-deepseek-web?color=1d4ed8&label=npm)](https://www.npmjs.com/package/dsh-deepseek-web)
[![release](https://img.shields.io/github/v/release/y-wi/dsh-deepseek-web?color=0f172a)](https://github.com/y-wi/dsh-deepseek-web/releases)
[![license](https://img.shields.io/github/license/y-wi/dsh-deepseek-web?color=334155)](./LICENSE)
[![node](https://img.shields.io/node/v/dsh-deepseek-web?color=1e293b)](https://nodejs.org)

**Open TypeScript integration layer** · precompiled WASM protocol core  

<h3>
Please follow the applicable usage policies. Do not use this project for reverse proxies or other behavior that disrupts normal system operation. Personal learning use only.
  
</h3>

<h3>
<em>Want to quickly build an agent of your own? Try <a href="https://github.com/aifluxon/aifluxon">AIFLUXON</a>: an embeddable Agent runtime with Rust secondary development and a Python API, so you can quickly connect AI into existing programs. It unifies streaming, tools, approvals, sessions, cancellation, and budgets — for AI apps, Coding Agents, CLIs, and custom Hosts.</em>
</h3>

</div>


Unofficial provider. This repository publishes the Harness **integration and transport** layer. Protocol compatibility ships as precompiled WebAssembly.

This project is **not affiliated with or endorsed by DeepSeek**. Users sign in with their own account. The plugin does not bypass CAPTCHA, WAF, or account controls; interactive challenges complete in an isolated browser window.

## Install

Requires DeepSeek Harness **0.1.0-rc.7** (or compatible) and Node `^22.19.0 || >=24.0.0`.

```bash
dsh plugin --profile web add dsh-deepseek-web
dsh plugin --profile web peers check
dsh web
```

Settings → DeepSeek Web → Sign in with DeepSeek. Confirm provider `deepseek-web` and models `default` / `expert`.

DSH / Cordis / React come from `$DSH_HOME/profiles/node_modules`. They are not duplicated under the plugin package.

<details>
<summary>TUI, CLI, and updates</summary>

```bash
dsh plugin --profile dsh-tui add dsh-deepseek-web
dsh-tui
```

```bash
dsh plugin --profile web exec dsh-deepseek-web status
dsh plugin --profile web exec dsh-deepseek-web login
dsh plugin --profile web update dsh-deepseek-web
```

Headless fallback (not a substitute for browser login):

```bash
dsh plugin --profile web exec dsh-deepseek-web login --token-stdin
```

See [INSTALL.md](./INSTALL.md) for the full notes.

</details>

## Capabilities

<table>
<tr>
<td>
<img src="docs/assets/showcase-login.gif" alt="Sign in to DeepSeek Web from Settings with an isolated browser" width="720">
<p><b>Isolated browser login.</b> Sign in to <code>chat.deepseek.com</code> with a dedicated browser profile, not everyday Chrome or Edge. Credentials stay in DSH storage.</p>
</td>
</tr>
<tr>
<td>
<img src="docs/assets/showcase-switch.gif" alt="Switch DeepSeek Web models and DeepThink reasoning in the composer" width="720">
<p><b>Switch models.</b> Switch between <code>DeepSeek Web</code> and <code>DeepSeek Web Expert</code>, and choose the DeepThink reasoning level. The footer reports turn timing and time-to-first-token.</p>
</td>
</tr>
<tr>
<td>
<img src="docs/assets/showcase-list.gif" alt="Sidebar popover listing DeepSeek Web conversations" width="720">
<p><b>Web conversation list.</b> The sidebar footer opens a popover of chats from chat.deepseek.com, with refresh and scrolling.</p>
</td>
</tr>
<tr>
<td>
<img src="docs/assets/showcase-load.gif" alt="Open a Web conversation from the popover and continue it in Harness" width="720">
<p><b>Continue a Web conversation.</b> Opening a row uses the normal Harness UI and continues the original Web conversation when replay is valid. Imported turns keep only the human text.</p>
</td>
</tr>
<tr>
<td>
<img src="docs/assets/showcase-fork.gif" alt="Fork a finalized assistant message into a chosen workspace" width="720">
<p><b>Fork to Workspace.</b> On a finalized assistant message, copy history through that turn into a workspace you choose. Later replies on a fork do not write into the original Web conversation.</p>
</td>
</tr>
<tr>
<td>
<img src="docs/assets/showcase-clean.gif" alt="Slash command /clean sending only the human text" width="720">
<p><b><code>/clean</code>.</b> Session toggle. While on, later turns send only your text — no system prompt, tools, or skills. Run it again to turn it off.</p>
</td>
</tr>
</table>

| Capability | Detail |
| --- | --- |
| Native DSH tools | Text tool bridge → `ToolCallBlock`; FS / Shell / MCP / approval run in Harness |
| Native search | Always on for `default`; Expert cannot search; not a DSH `web_search` provider |
| Prebuilt WASM | No Rust / wasm-pack on install; tokens and cookies **never enter** WASM |

See [docs/remote-sessions.md](./docs/remote-sessions.md).

## Architecture

| Layer | Responsibility |
| --- | --- |
| Open TypeScript layer | HTTP, SSE, browser login, credentials, DSH adapter, tool bridge, replay |
| Precompiled WASM core | Protocol compatibility and PoW |

DeepSeek Web has no official function calling. The plugin only parses model output. The adapter **never** executes shell, filesystem, or MCP.

## Models

| ID | Description |
| --- | --- |
| `deepseek-web/default` | DeepSeek Web |
| `deepseek-web/expert` | DeepSeek Web Expert |

Thinking is `on` / `off`. Native web search is the official Web Search button.
It stays **on** for every `default` turn, including continuations and `/clean`,
and cannot be turned off in plugin settings. Expert cannot search on the wire.
Citations are mapped onto the timeline; this is not a DSH `web_search` provider.
Input modalities are **text-only**.

## Commands

Slash commands are not sent to the model as `/…` text.

- `/deepseek-web [status|login|logout|doctor]` — account helpers
- `/clean [message]` — session toggle. While on, later turns send only your
  text (no system prompt, tools, or skills). Run `/clean` again to turn it off.

## Safety

- Never print `.credentials.yaml`, Bearer tokens, CDP endpoints, or absolute browser profile paths
- Login uses only the plugin-owned isolated profile
- Credentials are stored only in DSH

See [SECURITY.md](./SECURITY.md) and [docs/browser-auth.md](./docs/browser-auth.md).

## Docs

- [Install](./INSTALL.md)
- [Contributing](./CONTRIBUTING.md)
- [Releases](https://github.com/y-wi/dsh-deepseek-web/releases)
- [中文 README](./README.md)

## License

MIT for the TypeScript integration layer. See [LICENSE](./LICENSE) and [LICENSES/PROTOCOL_CORE.txt](./LICENSES/PROTOCOL_CORE.txt) for the precompiled core. Notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
