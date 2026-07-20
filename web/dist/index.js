/* web/dist bundle built by bun from src/ in this repository (see package.json). Inlines @laurigates/comfy-modal-kit (MIT) - a first-party library by the same publisher, published to npm with provenance attestation: https://www.npmjs.com/package/@laurigates/comfy-modal-kit */

// node_modules/@laurigates/comfy-modal-kit/dist/index.js
var KEY = Symbol.for("laurigates.comfyModalKit");
function getKit() {
  const g = globalThis;
  let kit = g[KEY];
  if (!kit) {
    kit = { fieldProviders: [], activeModal: null, pointerClaim: null };
    g[KEY] = kit;
  }
  return kit;
}
function ensureStyleOnce(id, css) {
  if (typeof document === "undefined")
    return;
  if (document.getElementById(id))
    return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}
var STYLE_ID = "cmn-notify-style";
var CONTAINER_ID = "cmn-notify-container";
function defaultLife(severity) {
  switch (severity) {
    case "error":
      return 0;
    case "warn":
      return 8000;
    default:
      return 4000;
  }
}
function defaultCopyable(severity) {
  return severity === "error" || severity === "warn";
}
function notifyClipboardText(summary, detail) {
  return detail ? `${summary}
${detail}` : summary;
}
async function copyTextToClipboard(text) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    if (typeof document === "undefined")
      return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
var CSS = `
.cmn-container {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(380px, calc(100vw - 24px));
    pointer-events: none;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.cmn-toast {
    pointer-events: auto;
    background: #1a1a1f;
    color: #e8e8ea;
    border: 1px solid #3a3a44;
    border-left-width: 4px;
    border-radius: 8px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    line-height: 1.4;
    animation: cmn-in 0.16s ease-out;
}
@keyframes cmn-in {
    from { transform: translateY(-8px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
}
.cmn-toast.cmn-success { border-left-color: #4caf50; }
.cmn-toast.cmn-info    { border-left-color: #6ba6ff; }
.cmn-toast.cmn-warn    { border-left-color: #e0a83a; }
.cmn-toast.cmn-error   { border-left-color: #e0533a; }
.cmn-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}
.cmn-text {
    flex: 1;
    min-width: 0;
    word-break: break-word;
}
.cmn-summary { font-weight: 600; }
.cmn-detail  { color: #b8b8c0; margin-top: 2px; white-space: pre-wrap; }
.cmn-close {
    background: transparent;
    color: #aaa;
    border: none;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
}
.cmn-close:hover { color: #fff; }
.cmn-actions { display: flex; gap: 8px; }
.cmn-copy {
    background: #2a2a36;
    color: #d8d8e0;
    border: 1px solid #3a3a44;
    border-radius: 5px;
    /* Touch-first: comfortable tap target, 13px text. */
    min-height: 32px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.cmn-copy:hover  { background: #34343f; color: #fff; }
.cmn-copy.cmn-copied { background: #2f4a30; border-color: #4caf50; color: #cfe8d0; }
`;
function ensureContainer() {
  let c = document.getElementById(CONTAINER_ID);
  if (!c) {
    c = document.createElement("div");
    c.id = CONTAINER_ID;
    c.className = "cmn-container";
    document.body.appendChild(c);
  }
  return c;
}
function notify(opts) {
  const { severity, summary, detail } = opts;
  if (typeof document === "undefined" || !document.body) {
    console.info(`[notify] ${severity}: ${summary}${detail ? ` — ${detail}` : ""}`);
    return null;
  }
  ensureStyleOnce(STYLE_ID, CSS);
  const container = ensureContainer();
  const life = opts.life ?? defaultLife(severity);
  const copyable = opts.copyable ?? defaultCopyable(severity);
  const toast = document.createElement("div");
  toast.className = `cmn-toast cmn-${severity}`;
  toast.setAttribute("role", severity === "error" ? "alert" : "status");
  let timer;
  const close = () => {
    if (timer)
      clearTimeout(timer);
    toast.remove();
    if (container.childElementCount === 0)
      container.remove();
  };
  const row = document.createElement("div");
  row.className = "cmn-row";
  const text = document.createElement("div");
  text.className = "cmn-text";
  const summaryEl = document.createElement("div");
  summaryEl.className = "cmn-summary";
  summaryEl.textContent = summary;
  text.appendChild(summaryEl);
  if (detail) {
    const detailEl = document.createElement("div");
    detailEl.className = "cmn-detail";
    detailEl.textContent = detail;
    text.appendChild(detailEl);
  }
  const closeBtn = document.createElement("button");
  closeBtn.className = "cmn-close";
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.title = "Dismiss";
  closeBtn.addEventListener("click", close);
  row.append(text, closeBtn);
  toast.appendChild(row);
  if (copyable) {
    const actions = document.createElement("div");
    actions.className = "cmn-actions";
    const copyBtn = document.createElement("button");
    copyBtn.className = "cmn-copy";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      const ok = await copyTextToClipboard(notifyClipboardText(summary, detail));
      copyBtn.textContent = ok ? "Copied ✓" : "Copy failed";
      copyBtn.classList.toggle("cmn-copied", ok);
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("cmn-copied");
      }, 1500);
    });
    actions.appendChild(copyBtn);
    toast.appendChild(actions);
  }
  container.appendChild(toast);
  if (life > 0) {
    timer = setTimeout(close, life);
  }
  return { close, el: toast };
}
var guardInstalled = false;
function setActiveModal(handle) {
  installPointerGuard();
  dismissActiveModal();
  getKit().activeModal = handle;
}
function dismissActiveModal() {
  const kit = getKit();
  const active = kit.activeModal;
  if (!active)
    return;
  kit.activeModal = null;
  try {
    active.close();
  } catch (e) {
    console.warn("[comfy-modal-kit] active modal close() threw", e);
  }
}
function getActiveModal() {
  return getKit().activeModal;
}
function installPointerGuard() {
  if (guardInstalled)
    return;
  if (typeof window === "undefined")
    return;
  guardInstalled = true;
  window.addEventListener("pointerdown", pointerGuard, true);
}
function pointerGuard(e) {
  const active = getKit().activeModal;
  if (!active)
    return;
  const target = e.target;
  if (active.element && target && active.element.contains(target)) {
    return;
  }
  e.stopImmediatePropagation();
  dismissActiveModal();
}
function fuzzyScore(query, target) {
  if (!query)
    return { score: 0, matches: [] };
  if (!target)
    return null;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const matches = [];
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let prevMatchIdx = -1;
  for (let ti = 0;ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      consecutive = 0;
      continue;
    }
    let charScore = 1;
    if (ti === 0) {
      charScore += 5;
    } else {
      const prev = t[ti - 1];
      const orig = target[ti];
      if (prev === "_" || prev === "-" || prev === " " || prev === "." || prev === "/") {
        charScore += 4;
      } else if (prev !== undefined && prev >= "a" && prev <= "z" && orig !== undefined && orig >= "A" && orig <= "Z") {
        charScore += 3;
      }
    }
    if (ti === prevMatchIdx + 1) {
      consecutive++;
      charScore += consecutive * 2;
    } else {
      consecutive = 0;
    }
    score += charScore;
    matches.push(ti);
    prevMatchIdx = ti;
    qi++;
  }
  if (qi < q.length)
    return null;
  score -= target.length * 0.01;
  return { score, matches };
}
function fuzzyRank(query, fields, primaryWeight = 10) {
  if (!query)
    return { score: 0, primaryMatches: [] };
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length)
    return { score: 0, primaryMatches: [] };
  const primary = fields[0] || "";
  const rest = fields.slice(1).filter((f) => Boolean(f));
  let totalScore = 0;
  const primaryMatchSet = new Set;
  for (const token of tokens) {
    const primaryResult = fuzzyScore(token, primary);
    let best = primaryResult ? {
      score: primaryResult.score * primaryWeight,
      matches: primaryResult.matches,
      onPrimary: true
    } : null;
    for (const field of rest) {
      const r = fuzzyScore(token, field);
      if (r && (!best || r.score > best.score)) {
        best = { score: r.score, matches: r.matches, onPrimary: false };
      }
    }
    if (!best)
      return null;
    totalScore += best.score;
    if (best.onPrimary) {
      for (const i of best.matches)
        primaryMatchSet.add(i);
    }
  }
  return {
    score: totalScore,
    primaryMatches: [...primaryMatchSet].sort((a, b) => a - b)
  };
}
var STYLE_ID2 = "cmp-shell-style";
var CSS2 = `
.cmp-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 9998;
    backdrop-filter: blur(2px);
    touch-action: manipulation;
}
.cmp-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    width: min(960px, calc(100vw - 24px));
    max-height: min(85vh, 800px);
    touch-action: manipulation;
    display: flex;
    flex-direction: column;
    background: #1a1a1f;
    color: #e8e8ea;
    border: 1px solid #3a3a44;
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 13px;
    overflow: hidden;
}
.cmp-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid #2a2a32;
    background: #21212a;
    flex-shrink: 0;
}
.cmp-title {
    flex: 1;
    font-weight: 600;
    color: #9ec6ff;
    font-size: 14px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.cmp-subtitle {
    color: #888;
    font-weight: 400;
    font-size: 12px;
    margin-left: 6px;
}
.cmp-close {
    background: transparent;
    color: #aaa;
    border: 1px solid #3a3a44;
    border-radius: 4px;
    width: 36px;
    height: 36px;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    flex-shrink: 0;
}
.cmp-close:hover {
    background: #2a2a32;
    color: #fff;
}
.cmp-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 8px 14px;
    border-bottom: 1px solid #2a2a32;
    background: #1f1f26;
    flex-shrink: 0;
}
.cmp-toolbar:empty {
    display: none;
}
.cmp-searchrow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid #2a2a32;
    flex-shrink: 0;
}
.cmp-search {
    flex: 1;
    background: #12121a;
    border: 1px solid #3a3a44;
    border-radius: 4px;
    color: #e8e8ea;
    padding: 8px 12px;
    /* 16px prevents iOS auto-zoom on focus. */
    font-size: 16px;
    font-family: inherit;
    outline: none;
    min-width: 0;
}
.cmp-search:focus {
    border-color: #6ba6ff;
}
.cmp-status {
    color: #888;
    font-size: 12px;
    white-space: nowrap;
}
.cmp-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 8px;
    position: relative;
}
.cmp-body.is-busy {
    opacity: 0.5;
    pointer-events: none;
}
.cmp-footer {
    padding: 8px 14px;
    border-top: 1px solid #2a2a32;
    color: #777;
    font-size: 11px;
    background: #1f1f26;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    gap: 12px;
}
.cmp-footer:empty {
    display: none;
}
.cmp-footer kbd {
    background: #2a2a36;
    border: 1px solid #3a3a44;
    border-bottom-width: 2px;
    border-radius: 3px;
    padding: 1px 5px;
    font-family: ui-monospace, monospace;
    font-size: 10px;
    color: #b8b8c0;
}
`;
function openModalShell(opts = {}) {
  ensureStyleOnce(STYLE_ID2, CSS2);
  const backdrop = document.createElement("div");
  backdrop.className = "cmp-backdrop";
  const dialog = document.createElement("div");
  dialog.className = "cmp-dialog";
  if (opts.width)
    dialog.style.width = opts.width;
  if (opts.height)
    dialog.style.maxHeight = opts.height;
  const stop = (e) => e.stopPropagation();
  for (const ev of ["pointerdown", "pointerup", "click", "dblclick", "wheel"]) {
    dialog.addEventListener(ev, stop);
  }
  const headerEl = document.createElement("div");
  headerEl.className = "cmp-header";
  const titleEl = document.createElement("div");
  titleEl.className = "cmp-title";
  titleEl.textContent = opts.title || "";
  if (opts.subtitle) {
    const sub = document.createElement("span");
    sub.className = "cmp-subtitle";
    sub.textContent = opts.subtitle;
    titleEl.appendChild(sub);
  }
  const closeBtn = document.createElement("button");
  closeBtn.className = "cmp-close";
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.title = "Close (Esc)";
  headerEl.append(titleEl, closeBtn);
  const toolbarEl = document.createElement("div");
  toolbarEl.className = "cmp-toolbar";
  const searchRow = document.createElement("div");
  searchRow.className = "cmp-searchrow";
  const searchEl = document.createElement("input");
  searchEl.type = "search";
  searchEl.className = "cmp-search";
  searchEl.placeholder = opts.placeholder || "Filter…";
  searchEl.spellcheck = false;
  searchEl.autocomplete = "off";
  const statusEl = document.createElement("div");
  statusEl.className = "cmp-status";
  searchRow.append(searchEl, statusEl);
  if (opts.showSearch === false)
    searchRow.style.display = "none";
  const bodyEl = document.createElement("div");
  bodyEl.className = "cmp-body";
  const footerEl = document.createElement("div");
  footerEl.className = "cmp-footer";
  if (opts.showFooter !== false) {
    const l = document.createElement("div");
    if (opts.footerLeftHTML)
      l.innerHTML = opts.footerLeftHTML;
    const r = document.createElement("div");
    if (opts.footerRightHTML)
      r.innerHTML = opts.footerRightHTML;
    footerEl.append(l, r);
  } else {
    footerEl.style.display = "none";
  }
  dialog.append(headerEl, toolbarEl, searchRow, bodyEl, footerEl);
  let torn = false;
  const teardown = () => {
    if (torn)
      return;
    torn = true;
    try {
      backdrop.remove();
      dialog.remove();
      document.removeEventListener("keydown", onKey, true);
    } finally {
      try {
        opts.onClose?.();
      } catch (e) {
        console.warn("[modal-shell] onClose threw", e);
      }
    }
  };
  const handle = { id: "modal-shell", element: dialog, close: teardown };
  const requestClose = () => {
    if (getActiveModal() === handle) {
      dismissActiveModal();
    } else {
      teardown();
    }
  };
  backdrop.addEventListener("pointerdown", requestClose);
  closeBtn.addEventListener("click", requestClose);
  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      requestClose();
      return;
    }
    try {
      opts.onKeyDown?.(e);
    } catch (err) {
      console.warn("[modal-shell] onKeyDown threw", err);
    }
  };
  document.addEventListener("keydown", onKey, true);
  document.body.append(backdrop, dialog);
  const controller = {
    backdrop,
    dialog,
    headerEl,
    toolbarEl,
    searchEl,
    statusEl,
    bodyEl,
    footerEl,
    setBusy(b) {
      bodyEl.classList.toggle("is-busy", !!b);
    },
    setStatus(s) {
      statusEl.textContent = s || "";
    },
    close: requestClose,
    _onKey: onKey,
    opts
  };
  setActiveModal(handle);
  if (opts.showSearch !== false) {
    requestAnimationFrame(() => {
      if (getActiveModal() === handle)
        searchEl.focus();
    });
  }
  return controller;
}

// src/index.ts
import { app } from "/scripts/app.js";

// src/presets.ts
var PRESETS_SETTING_ID = "FilenamePrefix.Presets";
function parsePresets(raw) {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data))
    return [];
  const out = [];
  for (const item of data) {
    if (!item || typeof item !== "object")
      continue;
    const rec = item;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    const value = typeof rec.value === "string" ? rec.value : "";
    if (!name || !value)
      continue;
    out.push({ name, value });
  }
  return dedupeByName(out);
}
function dedupeByName(presets) {
  const byName = new Map;
  for (const p of presets)
    byName.set(p.name, p);
  return [...byName.values()];
}
function upsertPreset(presets, preset) {
  const name = preset.name.trim();
  if (!name || !preset.value)
    return presets;
  const next = presets.filter((p) => p.name !== name);
  next.push({ name, value: preset.value });
  return next;
}
function removePreset(presets, name) {
  return presets.filter((p) => p.name !== name);
}
function suggestName(prefix) {
  const literal = prefix.replace(/%[^%]*%/g, "").split("/").map((seg) => seg.replace(/[^A-Za-z0-9_-]+/g, " ").replace(/^[\s_-]+|[\s_-]+$/g, "").trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return literal || "untitled";
}
async function loadPresets(store) {
  try {
    return parsePresets(store.get(PRESETS_SETTING_ID));
  } catch {
    return [];
  }
}
async function savePresets(store, presets) {
  await store.set(PRESETS_SETTING_ID, dedupeByName(presets));
}
var STARTER_PRESETS = [
  { name: "dated folder", value: "%date:yyyy-MM-dd%/ComfyUI" },
  {
    name: "run signature (dated, sampler + scheduler + seed)",
    value: "%date:yyyy-MM-dd%/%date:hhmmss%_%KSampler.sampler_name%_%KSampler.scheduler%_s%KSampler.seed%"
  },
  { name: "flat timestamped", value: "ComfyUI_%date:yyyy-MM-dd_hh-mm-ss%" }
];

// src/tokens.ts
var DATE_PARTS = {
  d: (d) => d.getDate(),
  M: (d) => d.getMonth() + 1,
  h: (d) => d.getHours(),
  m: (d) => d.getMinutes(),
  s: (d) => d.getSeconds()
};
var DATE_TOKEN_RE = new RegExp(`${Object.keys(DATE_PARTS).map((k) => `${k}${k}?`).join("|")}|yyy?y?`, "g");
function formatDate(pattern, now) {
  return pattern.replace(DATE_TOKEN_RE, (tok) => {
    if (tok === "yy")
      return `${now.getFullYear()}`.substring(2);
    if (tok === "yyyy")
      return now.getFullYear().toString();
    const part = DATE_PARTS[tok.charAt(0)];
    if (!part)
      return tok;
    return `${part(now)}`.padStart(tok.length, "0");
  });
}
var TOKEN_RE = /%([^%]+)%/g;
var BUILTINS = new Set(["width", "height", "year", "month", "day", "hour", "minute", "second"]);
function splitNodeRef(inner) {
  const parts = inner.split(".");
  if (parts.length !== 2)
    return null;
  const [node, widget] = parts;
  if (!node || !widget)
    return null;
  return [node, widget];
}
var SUBST_ILLEGAL = new Set(["/", "?", "<", ">", "\\", ":", "*", "|", '"']);
function sanitizeSubstitution(value) {
  let out = "";
  for (const ch of value) {
    const c = ch.codePointAt(0) ?? 0;
    out += SUBST_ILLEGAL.has(ch) || c < 32 || c === 127 ? "_" : ch;
  }
  return out;
}
function parseTokens(prefix) {
  const out = [];
  for (const m of prefix.matchAll(TOKEN_RE)) {
    const inner = m[1];
    if (inner === undefined)
      continue;
    const index = m.index ?? 0;
    if (inner.startsWith("date:")) {
      out.push({ raw: m[0], kind: "date", target: inner.slice(5), index });
    } else if (BUILTINS.has(inner)) {
      out.push({ raw: m[0], kind: "builtin", target: inner, index });
    } else {
      const parts = splitNodeRef(inner);
      if (!parts)
        continue;
      out.push({ raw: m[0], kind: "widget", target: parts[0], widget: parts[1], index });
    }
  }
  return out;
}
function renderBuiltin(name, o) {
  const now = o.now ?? new Date;
  const pad = (n) => `${n}`.padStart(2, "0");
  switch (name) {
    case "width":
      return o.width === undefined ? undefined : `${o.width}`;
    case "height":
      return o.height === undefined ? undefined : `${o.height}`;
    case "year":
      return `${now.getFullYear()}`;
    case "month":
      return pad(now.getMonth() + 1);
    case "day":
      return pad(now.getDate());
    case "hour":
      return pad(now.getHours());
    case "minute":
      return pad(now.getMinutes());
    case "second":
      return pad(now.getSeconds());
    default:
      return;
  }
}
function renderPrefix(prefix, opts = {}) {
  const now = opts.now ?? new Date;
  return prefix.replace(TOKEN_RE, (raw, inner) => {
    if (inner.startsWith("date:"))
      return formatDate(inner.slice(5), now);
    if (BUILTINS.has(inner)) {
      const v = renderBuiltin(inner, opts);
      if (v !== undefined)
        return v;
      return opts.keepUnresolved ? raw : `?${inner}?`;
    }
    const parts = splitNodeRef(inner);
    if (parts) {
      const v = opts.resolveWidget?.(parts[0], parts[1]);
      if (v !== undefined && v !== "")
        return sanitizeSubstitution(v);
    }
    return opts.keepUnresolved ? raw : `?${inner}?`;
  });
}
function unresolvedTokens(prefix, resolve) {
  return parseTokens(prefix).filter((t) => t.kind === "widget" && resolve(t.target, t.widget ?? "") === undefined);
}
var EXT_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?|mp4|webm|mov|safetensors|ckpt|pt|pth|bin|gguf)$/i;
function lintResolved(prefix, resolve) {
  const problems = [];
  for (const t of parseTokens(prefix)) {
    if (t.kind !== "widget")
      continue;
    const value = resolve(t.target, t.widget ?? "");
    if (value === undefined || value === "")
      continue;
    if (EXT_RE.test(value)) {
      problems.push(`${t.raw} resolves to "${value}" — the file extension will appear in the middle of the name.`);
    }
    const sanitized = sanitizeSubstitution(value);
    if (sanitized !== value) {
      problems.push(`${t.raw} resolves to "${value}", which ComfyUI rewrites to "${sanitized}".`);
    }
  }
  return problems;
}
var ILLEGAL_RE = /[<>:"\\|?*]/g;
var hasControlChar = (s) => {
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 || c === 127)
      return true;
  }
  return false;
};
function lintPrefix(prefix) {
  const problems = [];
  if (!prefix.trim())
    problems.push("Prefix is empty.");
  const literal = prefix.replace(/%[^%]*%/g, "");
  const illegal = [...new Set(literal.match(ILLEGAL_RE) ?? [])];
  if (illegal.length) {
    problems.push(`Illegal filename character(s): ${illegal.map((c) => JSON.stringify(c)).join(", ")}`);
  }
  if (hasControlChar(literal))
    problems.push("Contains control characters.");
  if (literal.includes(" ")) {
    problems.push("Contains spaces — legal, but awkward in shell commands and URLs.");
  }
  if ((prefix.match(/%/g)?.length ?? 0) % 2 !== 0) {
    problems.push("Unbalanced % — a token looks unfinished.");
  }
  if (prefix.startsWith("/") || prefix.includes("..")) {
    problems.push("Leading / or .. — ComfyUI refuses to save outside the output folder.");
  }
  return problems;
}

// src/variables.ts
function srName(node) {
  const v = node.properties?.["Node name for S&R"];
  return typeof v === "string" ? v.trim() : "";
}
function effectiveTitle(node) {
  const t = (node.title ?? "").trim();
  return t !== "" ? t : (node.type ?? "").trim();
}
function nodesOf(graph) {
  if (!graph)
    return [];
  const a = Array.isArray(graph._nodes) ? graph._nodes : [];
  if (a.length)
    return a;
  return Array.isArray(graph.nodes) ? graph.nodes : [];
}
function previewValue(v) {
  if (v === null || v === undefined)
    return null;
  if (typeof v === "number" || typeof v === "boolean")
    return String(v);
  if (typeof v !== "string")
    return null;
  if (v.length > 40)
    return `${v.slice(0, 37)}…`;
  return v;
}
function collectVariables(graph) {
  const nodes = nodesOf(graph);
  const titleCounts = new Map;
  for (const n of nodes) {
    const t = effectiveTitle(n);
    if (t)
      titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1);
  }
  const out = [];
  for (const n of nodes) {
    const nodeTitle = effectiveTitle(n);
    if (!nodeTitle)
      continue;
    for (const w of n.widgets ?? []) {
      const widgetName = (w?.name ?? "").trim();
      if (!widgetName)
        continue;
      if (widgetName === "filename_prefix")
        continue;
      const preview = previewValue(w?.value);
      if (preview === null)
        continue;
      out.push({
        token: `%${nodeTitle}.${widgetName}%`,
        nodeTitle,
        widgetName,
        preview,
        ambiguous: (titleCounts.get(nodeTitle) ?? 0) > 1
      });
    }
  }
  const seen = new Set;
  const deduped = out.filter((v) => {
    if (seen.has(v.token))
      return false;
    seen.add(v.token);
    return true;
  });
  return deduped.sort((a, b) => {
    const byLen = a.nodeTitle.length - b.nodeTitle.length;
    if (byLen !== 0)
      return byLen;
    const byTitle = a.nodeTitle.localeCompare(b.nodeTitle);
    return byTitle !== 0 ? byTitle : a.widgetName.localeCompare(b.widgetName);
  });
}
function makeResolver(graph) {
  const nodes = nodesOf(graph);
  const bySr = new Map;
  const byTitle = new Map;
  const add = (index, key, n) => {
    if (!key)
      return;
    let widgets = index.get(key);
    if (!widgets) {
      widgets = new Map;
      index.set(key, widgets);
    }
    for (const w of n.widgets ?? []) {
      const name = (w?.name ?? "").trim();
      if (!name)
        continue;
      if (!widgets.has(name))
        widgets.set(name, String(w?.value ?? ""));
    }
  };
  for (const n of nodes)
    add(bySr, srName(n), n);
  for (const n of nodes)
    add(byTitle, effectiveTitle(n), n);
  return (nodeName, widgetName) => bySr.get(nodeName)?.get(widgetName) ?? byTitle.get(nodeName)?.get(widgetName);
}
var STATIC_TOKENS = [
  { token: "%date:yyyy-MM-dd%", label: "Date (2026-07-20)", scope: "frontend" },
  { token: "%date:hhmmss%", label: "Time (143052)", scope: "frontend" },
  { token: "%date:yyyy-MM-dd_hh-mm-ss%", label: "Date + time", scope: "frontend" },
  { token: "%date:yyyy-MM%", label: "Year-month (2026-07)", scope: "frontend" },
  { token: "%width%", label: "Image width", scope: "backend" },
  { token: "%height%", label: "Image height", scope: "backend" }
];

// src/index.ts
var EXT_NAME = "comfyui-filename-prefix";
var TARGET_WIDGETS = new Set(["filename_prefix"]);
function settingsStore() {
  const mgr = app.extensionManager;
  return mgr?.setting ?? null;
}
function currentGraph() {
  return app.graph ?? null;
}
var STYLE_ID3 = "comfyui-filename-prefix-style";
function ensureStyle() {
  if (document.getElementById(STYLE_ID3))
    return;
  const el = document.createElement("style");
  el.id = STYLE_ID3;
  el.textContent = `
.cfp-wrap{display:flex;flex-direction:column;gap:10px;min-width:min(96vw,520px)}
.cfp-input{width:100%;box-sizing:border-box;font-size:16px;padding:10px;border-radius:8px;
  border:1px solid var(--border-color,#444);background:var(--comfy-input-bg,#222);
  color:var(--input-text,#ddd);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cfp-preview{font-size:13px;padding:8px 10px;border-radius:8px;background:#0003;
  word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#9ad}
.cfp-warn{font-size:13px;color:#fb8;padding:2px 2px}
.cfp-tabs{display:flex;gap:6px}
.cfp-tab{flex:1;padding:10px;border-radius:8px;border:1px solid var(--border-color,#444);
  background:#0002;color:#ccc;font-size:15px;cursor:pointer}
.cfp-tab[aria-selected="true"]{background:#3b6ea5;color:#fff;border-color:#3b6ea5}
.cfp-list{max-height:44vh;overflow-y:auto;-webkit-overflow-scrolling:touch;
  display:flex;flex-direction:column;gap:6px}
.cfp-item{display:flex;align-items:center;gap:8px;padding:10px;border-radius:8px;
  background:#0002;border:1px solid transparent;cursor:pointer;text-align:left}
.cfp-item:hover{border-color:#3b6ea5}
.cfp-item-main{flex:1;min-width:0}
.cfp-item-title{font-size:15px;color:#eee;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cfp-item-sub{font-size:12px;color:#8a8a8a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cfp-badge{font-size:11px;padding:2px 6px;border-radius:4px;background:#0004;color:#999;flex:none}
.cfp-badge.warn{background:#7a4a1a;color:#fd9}
.cfp-row{display:flex;gap:8px}
.cfp-btn{padding:10px 14px;border-radius:8px;border:1px solid var(--border-color,#444);
  background:#0002;color:#ddd;font-size:15px;cursor:pointer;flex:none}
.cfp-btn.primary{background:#3b6ea5;border-color:#3b6ea5;color:#fff;flex:1}
.cfp-btn.danger{background:#0002;color:#e88}
.cfp-empty{padding:16px;text-align:center;color:#888;font-size:14px}
`;
  document.head.appendChild(el);
}
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls)
    node.className = cls;
  if (text !== undefined)
    node.textContent = text;
  return node;
}
function openPicker(widget, node) {
  ensureStyle();
  const graph = currentGraph();
  const resolveWidget = makeResolver(graph);
  const variables = collectVariables(graph);
  const store = settingsStore();
  let draft = typeof widget.value === "string" ? widget.value : "";
  let mode = "build";
  let presets = [];
  const modal = openModalShell({ title: "Filename prefix", onClose: () => {} });
  const wrap = el("div", "cfp-wrap");
  modal.bodyEl.appendChild(wrap);
  const input = el("input", "cfp-input");
  input.type = "text";
  input.value = draft;
  input.spellcheck = false;
  input.autocapitalize = "off";
  input.setAttribute("aria-label", "Filename prefix");
  const preview = el("div", "cfp-preview");
  const warn = el("div", "cfp-warn");
  function refreshPreview() {
    const rendered = renderPrefix(draft, { resolveWidget });
    preview.textContent = rendered ? `${rendered}_00001_.png` : "—";
    const problems = [...lintPrefix(draft), ...lintResolved(draft, resolveWidget)];
    const dangling = unresolvedTokens(draft, resolveWidget);
    if (dangling.length) {
      problems.push(`Not in this workflow: ${dangling.map((t) => t.raw).join(", ")} — will be written literally.`);
    }
    warn.textContent = problems.join("  ");
  }
  function setDraft(next) {
    draft = next;
    input.value = next;
    refreshPreview();
  }
  input.addEventListener("input", () => {
    draft = input.value;
    refreshPreview();
  });
  for (const evt of ["pointerdown", "keydown", "keyup", "wheel"]) {
    input.addEventListener(evt, (e) => e.stopPropagation());
  }
  const tabs = el("div", "cfp-tabs");
  const buildTab = el("button", "cfp-tab", "Build");
  const presetTab = el("button", "cfp-tab", "Presets");
  tabs.append(buildTab, presetTab);
  const panel = el("div");
  wrap.append(input, preview, warn, tabs, panel);
  function renderBuild() {
    panel.replaceChildren();
    const search = el("input", "cfp-input");
    search.type = "text";
    search.placeholder = "Filter variables…";
    search.spellcheck = false;
    for (const evt of ["pointerdown", "keydown", "keyup"]) {
      search.addEventListener(evt, (e) => e.stopPropagation());
    }
    const list = el("div", "cfp-list");
    function paint(query) {
      list.replaceChildren();
      const statics = query ? STATIC_TOKENS.filter((t) => fuzzyRank(query, [t.label, t.token])) : STATIC_TOKENS;
      for (const t of statics) {
        const row = el("button", "cfp-item");
        const main = el("div", "cfp-item-main");
        main.append(el("div", "cfp-item-title", t.label), el("div", "cfp-item-sub", t.token));
        row.append(main, el("span", "cfp-badge", t.scope));
        row.addEventListener("click", () => setDraft(draft + t.token));
        list.appendChild(row);
      }
      const vars = query ? variables.filter((v) => fuzzyRank(query, [v.nodeTitle, v.widgetName, v.preview])) : variables;
      if (!vars.length && !statics.length) {
        list.appendChild(el("div", "cfp-empty", "No matching variables."));
        return;
      }
      for (const v of vars) {
        const row = el("button", "cfp-item");
        const main = el("div", "cfp-item-main");
        main.append(el("div", "cfp-item-title", `${v.nodeTitle} › ${v.widgetName}`), el("div", "cfp-item-sub", v.preview));
        row.append(main);
        if (v.ambiguous) {
          row.appendChild(el("span", "cfp-badge warn", "duplicate title"));
        }
        row.addEventListener("click", () => setDraft(draft + v.token));
        list.appendChild(row);
      }
    }
    search.addEventListener("input", () => paint(search.value));
    paint("");
    if (!variables.length) {
      list.appendChild(el("div", "cfp-empty", "No node variables found in this workflow. Retitle a node (double-click its title) to reference it here."));
    }
    const actions = el("div", "cfp-row");
    const saveBtn = el("button", "cfp-btn", "Save as preset…");
    saveBtn.addEventListener("click", () => void saveCurrentAsPreset());
    const clearBtn = el("button", "cfp-btn", "Clear");
    clearBtn.addEventListener("click", () => setDraft(""));
    actions.append(saveBtn, clearBtn);
    panel.append(search, list, actions);
  }
  async function renderPresets() {
    panel.replaceChildren();
    const list = el("div", "cfp-list");
    panel.appendChild(list);
    if (!store) {
      list.appendChild(el("div", "cfp-empty", "Settings store unavailable — presets need a newer ComfyUI frontend."));
      return;
    }
    presets = await loadPresets(store);
    if (!presets.length)
      presets = STARTER_PRESETS;
    for (const p of presets) {
      const row = el("button", "cfp-item");
      const main = el("div", "cfp-item-main");
      main.append(el("div", "cfp-item-title", p.name), el("div", "cfp-item-sub", p.value));
      row.append(main);
      const del = el("button", "cfp-btn danger", "✕");
      del.setAttribute("aria-label", `Delete preset ${p.name}`);
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        (async () => {
          presets = removePreset(presets, p.name);
          await savePresets(store, presets);
          await renderPresets();
        })();
      });
      row.appendChild(del);
      row.addEventListener("click", () => {
        setDraft(p.value);
        mode = "build";
        syncTabs();
      });
      list.appendChild(row);
    }
  }
  async function saveCurrentAsPreset() {
    if (!store) {
      notify({
        severity: "warn",
        summary: "Cannot save preset",
        detail: "ComfyUI's settings store is unavailable on this frontend version."
      });
      return;
    }
    if (!draft.trim()) {
      notify({ severity: "warn", summary: "Nothing to save", detail: "The prefix is empty." });
      return;
    }
    const name = window.prompt("Preset name", suggestName(draft));
    if (name === null)
      return;
    try {
      const existing = await loadPresets(store);
      const next = upsertPreset(existing.length ? existing : [], { name, value: draft });
      await savePresets(store, next);
      notify({ severity: "success", summary: "Preset saved", detail: name });
    } catch (e) {
      notify({
        severity: "error",
        summary: "Saving preset failed",
        detail: e instanceof Error ? e.message : String(e)
      });
    }
  }
  function syncTabs() {
    buildTab.setAttribute("aria-selected", String(mode === "build"));
    presetTab.setAttribute("aria-selected", String(mode === "presets"));
    if (mode === "build")
      renderBuild();
    else
      renderPresets();
  }
  buildTab.addEventListener("click", () => {
    mode = "build";
    syncTabs();
  });
  presetTab.addEventListener("click", () => {
    mode = "presets";
    syncTabs();
  });
  const footer = el("div", "cfp-row");
  const apply = el("button", "cfp-btn primary", "Apply");
  apply.addEventListener("click", () => {
    widget.value = draft;
    try {
      widget.callback?.(draft);
    } catch (e) {
      console.warn(`[${EXT_NAME}] widget callback failed`, e);
    }
    app.graph?.setDirtyCanvas?.(true, true);
    modal.close();
  });
  const cancel = el("button", "cfp-btn", "Cancel");
  cancel.addEventListener("click", () => modal.close());
  footer.append(apply, cancel);
  wrap.appendChild(footer);
  refreshPreview();
  syncTabs();
}
function enhanceNode(node) {
  for (const w of node?.widgets ?? []) {
    if (!TARGET_WIDGETS.has(w.name))
      continue;
    if (w._filenamePrefixPatched)
      continue;
    w._filenamePrefixPatched = true;
    const origDown = w.onPointerDown;
    w.onPointerDown = function(pointer, ownerNode, canvas) {
      try {
        if (typeof origDown === "function") {
          const consumed = origDown.call(this, pointer, ownerNode, canvas);
          if (consumed)
            return consumed;
        }
        openPicker(w, ownerNode || node);
        return true;
      } catch (e) {
        console.warn(`[${EXT_NAME}] picker open failed`, e);
        return false;
      }
    };
  }
}
app.registerExtension({
  name: "comfy.filename-prefix",
  settings: [
    {
      id: PRESETS_SETTING_ID,
      name: "Saved filename prefixes",
      type: "hidden",
      defaultValue: [],
      category: ["Filename Prefix", "Presets", "Saved"]
    }
  ],
  async nodeCreated(node) {
    try {
      enhanceNode(node);
    } catch (e) {
      console.warn(`[${EXT_NAME}] nodeCreated enhance failed`, e);
    }
  },
  async loadedGraphNode(node) {
    try {
      enhanceNode(node);
    } catch (e) {
      console.warn(`[${EXT_NAME}] loadedGraphNode enhance failed`, e);
    }
  }
});
function targetsWidget(name) {
  return TARGET_WIDGETS.has(name);
}
export {
  upsertPreset,
  unresolvedTokens,
  targetsWidget,
  suggestName,
  renderPrefix,
  removePreset,
  parseTokens,
  parsePresets,
  openPicker,
  makeResolver,
  lintPrefix,
  formatDate,
  enhanceNode,
  collectVariables
};
