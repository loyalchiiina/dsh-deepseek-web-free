/**
 * Helpers for the conversation selection menu.
 *
 * The host's right‑click menu for selected read‑only text is an Electron *native*
 * menu built in the main process (`editingContextMenuTemplate`): it offers only
 * "复制". A renderer plugin cannot append to it, so this module lets the plugin
 * suppress it (`request.preventDefault()`) and render a web menu with the same
 * single official item plus our "复制到 DeepSeek 网页" row.
 *
 * For the DeepSeek side we talk to the plugin's own Electron <webview>
 * (`webview.dsw-webpanel-webview`) through `executeJavaScript`, which is the same
 * channel the login token seeding already uses.
 */
import { closeWebPanelSurface, openWebPanel } from './webpanel-bus.ts'
import { loadPrefs } from './webpanel-prefs.ts'

/** The Electron <webview> tag, narrowed to the members this module uses. */
interface WebviewElement extends HTMLElement {
  getURL?: () => string
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>
}

export type PanelInsertOutcome = 'ok' | 'timeout' | 'error'

const WEBPANEL_SELECTOR = 'webview.dsw-webpanel-webview'
const DEEPSEEK_URL_PREFIX = 'https://chat.deepseek.com'
const POLL_INTERVAL_MS = 300
const POLL_TIMEOUT_MS = 22000

/** Webviews whose risk dialog we already tried to close (WeakSet: no leaks). */
const riskHandled = new WeakSet<Element>()

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function allWebviews(): WebviewElement[] {
  if (typeof document === 'undefined') return []
  return Array.from(document.querySelectorAll(WEBPANEL_SELECTOR)) as WebviewElement[]
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 1 || rect.height <= 1) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

function webviewUrl(element: WebviewElement): string {
  try {
    return typeof element.getURL === 'function' ? element.getURL() : ''
  } catch {
    return ''
  }
}

/** Webviews that belong to one surface (ball / sidebar). Unmarked guests match both. */
function surfaceWebviews(surface: 'ball' | 'sidebar'): WebviewElement[] {
  const all = allWebviews()
  const marked = all.filter((element) => element.dataset.deepseekWebpanelSurface === surface)
  const unmarked = all.filter((element) => element.dataset.deepseekWebpanelSurface === undefined)
  return marked.concat(unmarked)
}

function readyWebviews(surface: 'ball' | 'sidebar'): WebviewElement[] {
  const ready = surfaceWebviews(surface).filter((element) => webviewUrl(element).startsWith(DEEPSEEK_URL_PREFIX))
  ready.sort((left, right) => Number(isVisible(right)) - Number(isVisible(left)))
  return ready
}

/**
 * The script injected into the DeepSeek page. It first CLEARS the most plausible
 * visible composer (textarea / contenteditable), then writes `text` into it — the
 * requested behaviour is "清空再复制", never append. The textarea path uses the
 * native value setter so React's onChange fires; the contenteditable path selects
 * all, deletes, then inserts. The caret lands at the end.
 */
export function buildInsertScript(text: string): string {
  const payload = JSON.stringify(text)
  return [
    '(function (text) {',
    '  try {',
    '    function visible(el) {',
    '      if (!el) return false;',
    '      var r = el.getBoundingClientRect();',
    '      var s = window.getComputedStyle(el);',
    '      return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";',
    '    }',
    '    var nodes = Array.prototype.slice.call(document.querySelectorAll(\'textarea, [contenteditable="true"], [contenteditable=""]\'));',
    '    var candidates = nodes.filter(function (el) {',
    '      if (!el || el.disabled || el.readOnly) return false;',
    '      return visible(el);',
    '    });',
    '    function score(el) {',
    '      var s = 0;',
    '      var hint = (el.getAttribute("placeholder") || "") + " " + (el.getAttribute("aria-label") || "");',
    '      if (/message|send|deepseek|消息|发送|问|输入/i.test(hint)) s += 100;',
    '      if (el.tagName === "TEXTAREA") s += 20;',
    '      var r = el.getBoundingClientRect();',
    '      s += Math.min(50, (r.width * r.height) / 2000);',
    '      return s;',
    '    }',
    '    candidates.sort(function (a, b) { return score(b) - score(a); });',
    '    var el = candidates[0];',
    '    if (!el) return "no-input";',
    '    el.focus();',
    '    var inserted = false;',
    '    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {',
    '      // React-compatible replace: the prototype value setter bypasses React\'s',
    '      // value tracker, and the input event makes its onChange run. No "change"',
    '      // event — that is not what a keystroke produces and some apps act on it.',
    '      var proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;',
    '      var desc = Object.getOwnPropertyDescriptor(proto, "value");',
    '      var setter = desc && desc.set;',
    '      if (setter) setter.call(el, text); else el.value = text;',
    '      el.dispatchEvent(new Event("input", { bubbles: true }));',
    '      try { el.selectionStart = el.selectionEnd = (el.value || "").length; } catch (e) {}',
    '      return "ok:textarea";',
    '    }',
    '    try {',
    '      var sel = window.getSelection();',
    '      var range = document.createRange();',
    '      range.selectNodeContents(el);',
    '      sel.removeAllRanges();',
    '      sel.addRange(range);',
    '    } catch (e) {}',
    '    try { inserted = document.execCommand("insertText", false, text); } catch (e) { inserted = false; }',
    '    if (!inserted) {',
    '      try { document.execCommand("delete", false, null); } catch (e) {}',
    '      try { inserted = document.execCommand("insertText", false, text); } catch (e) { inserted = false; }',
    '    }',
    '    if (!inserted) return "error:no-editor-insert";',
    '    return "ok:editable";',
    '  } catch (err) {',
    '    return "error:" + (err && err.message ? err.message : String(err));',
    '  }',
    '})(' + payload + ')',
  ].join('\n')
}

/**
 * Declares `dswCloseRisk()` inside the guest page. It clicks a visible close
 * control of a modal/overlay (aria-label close/关闭, class *close* inside a modal,
 * or a bare ×/✕ glyph) and never touches ordinary page buttons.
 */
function closeRiskFunctionLines(): string[] {
  return [
    '  function dswVisible(el) {',
    '    if (!el) return false;',
    '    var r = el.getBoundingClientRect();',
    '    var s = window.getComputedStyle(el);',
    '    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";',
    '  }',
    '  function dswFire(el) {',
    '    try {',
    '      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));',
    '      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));',
    '      if (typeof el.click === "function") el.click(); else el.dispatchEvent(new MouseEvent("click", { bubbles: true }));',
    '      return true;',
    '    } catch (e) { return false; }',
    '  }',
    '  function dswModal(el) {',
    '    var node = el;',
    '    for (var i = 0; i < 10 && node; i += 1) {',
    '      var attr = (node.getAttribute && (node.getAttribute("role") || "")) || "";',
    '      var cls = (node.className && typeof node.className === "string") ? node.className : "";',
    '      var id = node.id || "";',
    '      if (attr === "dialog" || attr === "alertdialog" || /modal|dialog|popup|mask|overlay|toast/i.test(cls + " " + id)) return true;',
    '      node = node.parentElement;',
    '    }',
    '    return false;',
    '  }',
    '  function dswCloseRisk() {',
    '    var selectors = [',
    '      \'[role="dialog"] [aria-label*="close" i]\',',
    '      \'[role="dialog"] [aria-label*="关闭"]\',',
    '      \'[role="alertdialog"] [aria-label*="close" i]\',',
    '      \'[class*="modal" i] [class*="close" i]\',',
    '      \'[class*="dialog" i] [class*="close" i]\',',
    '      \'[class*="popup" i] [class*="close" i]\',',
    '      \'[class*="mask" i] [class*="close" i]\',',
    '      \'[class*="overlay" i] [class*="close" i]\',',
    '      \'[aria-label*="关闭"]\',',
    '      \'[aria-label*="close" i]\'',
    '    ];',
    '    for (var i = 0; i < selectors.length; i += 1) {',
    '      var list = document.querySelectorAll(selectors[i]);',
    '      for (var j = 0; j < list.length; j += 1) {',
    '        var el = list[j];',
    '        if (dswVisible(el) && dswModal(el)) {',
    '          if (dswFire(el)) return "clicked:" + selectors[i];',
    '        }',
    '      }',
    '    }',
    '    return "none";',
    '  }',
  ]
}

/** One quick attempt (a few ms) so the insert path is not delayed. */
function riskOnceScript(): string {
  return [
    '(function () {',
    '  try {',
    ...closeRiskFunctionLines(),
    '    return dswCloseRisk();',
    '  } catch (e) { return "none"; }',
    '})()',
  ].join('\n')
}

/**
 * A short-lived watcher for a dialog that appears after the page finishes loading.
 * 150 ms cadence, 8 s ceiling — fast enough to clear it before the user reacts.
 */
function riskWatchScript(): string {
  return [
    '(function () {',
    '  try {',
    ...closeRiskFunctionLines(),
    '  } catch (e) { return "none"; }',
    '  try { if (window.__dswRiskTimer) { clearInterval(window.__dswRiskTimer); window.__dswRiskTimer = null; } } catch (e) {}',
    '  try {',
    '    var ticks = 0;',
    '    window.__dswRiskTimer = setInterval(function () {',
    '      ticks += 1;',
    '      var result = "none";',
    '      try { result = dswCloseRisk(); } catch (e) { result = "none"; }',
    '      if (result !== "none" || ticks > 54) { clearInterval(window.__dswRiskTimer); window.__dswRiskTimer = null; }',
    '    }, 150);',
    '  } catch (e) {}',
    '  return "watching";',
    '})()',
  ].join('\n')
}

async function dismissRiskOnce(element: WebviewElement): Promise<boolean> {
  try {
    await element.executeJavaScript(riskOnceScript(), true)
    return true
  } catch {
    // A page that is still navigating simply refuses; retry on the next poll.
    return false
  }
}

async function watchRisk(element: WebviewElement): Promise<void> {
  try {
    await element.executeJavaScript(riskWatchScript(), true)
  } catch {
    // ignore
  }
}

async function tryInsert(text: string, surface: 'ball' | 'sidebar'): Promise<'ok' | 'not-ready' | 'error'> {
  const ready = readyWebviews(surface)
  if (ready.length === 0) return 'not-ready'
  let sawError = false
  for (const element of ready) {
    if (typeof element.executeJavaScript !== 'function') continue
    if (!riskHandled.has(element)) {
      const riskReady = await dismissRiskOnce(element)
      if (riskReady) {
        riskHandled.add(element)
        void watchRisk(element)
      }
    }
    try {
      const result = await element.executeJavaScript(buildInsertScript(text), true)
      if (typeof result === 'string' && result.startsWith('ok')) return 'ok'
      if (typeof result === 'string' && result.startsWith('error')) sawError = true
    } catch {
      // still loading — keep polling
    }
  }
  return sawError ? 'error' : 'not-ready'
}

/**
 * Copy `text` into the DeepSeek web panel composer.
 *
 * If no panel is attached yet, ask the panel bus to open the surface the user
 * configured (floating ball or sidebar tab); the bus already routes by the saved
 * `position` preference. Then poll until the guest is on chat.deepseek.com and
 * insert. The risk dialog is dismissed immediately and watched briefly.
 */
export async function openPanelAndInsert(text: string): Promise<PanelInsertOutcome> {
  let position: 'sidebar' | 'ball' = 'sidebar'
  try {
    position = loadPrefs().position
  } catch {
    position = 'sidebar'
  }
  const target = surfaceWebviews(position)
  const targetVisible = target.some((element) => isVisible(element))
  if (!targetVisible) {
    // Ball mode: the guest can stay mounted while the window is collapsed, so an
    // attached-but-hidden webview must still be expanded. Sidebar mode: an attached
    // webview already means the tab is open, and asking again could duplicate it.
    const shouldOpen = position === 'ball' || target.length === 0
    if (shouldOpen) {
      // The other surface must release the shared DeepSeek session before this one
      // attaches; give its guest a moment to unmount/close.
      closeWebPanelSurface(position === 'ball' ? 'sidebar' : 'ball')
      await delay(200)
      try {
        openWebPanel()
      } catch {
        return 'error'
      }
    }
  }

  let outcome = await tryInsert(text, position)
  if (outcome === 'ok') return 'ok'

  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await delay(POLL_INTERVAL_MS)
    outcome = await tryInsert(text, position)
    if (outcome === 'ok') return 'ok'
    if (outcome === 'error') return 'error'
  }
  return 'timeout'
}

/** Copy text to the clipboard, resolving whether it succeeded. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    area.style.pointerEvents = 'none'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

let toastTimer: number | undefined

/** Show a short non-blocking toast at the bottom of the viewport. */
export function showToast(message: string): void {
  if (typeof document === 'undefined') return
  let host = document.querySelector<HTMLDivElement>('[data-dsh-deepseek-toast]')
  if (host === null) {
    host = document.createElement('div')
    host.dataset.dshDeepseekToast = ''
    host.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:56px',
      'transform:translateX(-50%)',
      'z-index:2147483600',
      'max-width:80vw',
      'padding:8px 14px',
      'border-radius:8px',
      'background:var(--dsw-alias-bg-base, #1f2126)',
      'color:var(--dsw-alias-label-primary, #ffffff)',
      'border:1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.15))',
      'box-shadow:var(--dsw-elevation-panel, 0 8px 24px rgba(0,0,0,0.35))',
      'font-size:13px',
      'line-height:1.4',
      'pointer-events:none',
      'opacity:0',
      'transition:opacity .16s ease',
    ].join(';')
    document.body.appendChild(host)
  }
  host.textContent = message
  host.style.opacity = '1'
  if (toastTimer !== undefined) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    if (host !== null) host.style.opacity = '0'
    toastTimer = undefined
  }, 2600)
}
