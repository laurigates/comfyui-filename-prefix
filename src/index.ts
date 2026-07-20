// Filename Prefix — ComfyUI frontend extension.
//
// Intercepts the `filename_prefix` widget and opens a builder modal with two
// modes: compose a prefix from the tokens the OPEN graph actually offers, or
// pick one of your saved presets. See ADR-0001 for the TS+bun build.
//
// Presets persist through ComfyUI's per-user settings store (server-side), so
// they follow you between phone and desktop. No Python in this pack.
import { fuzzyRank, notify, openModalShell } from "@laurigates/comfy-modal-kit";
import { app } from "/scripts/app.js";
import {
  loadPresets,
  PRESETS_SETTING_ID,
  type Preset,
  removePreset,
  type SettingsStore,
  STARTER_PRESETS,
  savePresets,
  suggestName,
  upsertPreset,
} from "./presets.js";
import { lintPrefix, lintResolved, renderPrefix, unresolvedTokens } from "./tokens.js";
import {
  collectVariables,
  type GraphLike,
  makeResolver,
  STATIC_TOKENS,
  type VariableRef,
} from "./variables.js";

const EXT_NAME = "comfyui-filename-prefix";

const TARGET_WIDGETS = new Set<string>(["filename_prefix"]);

// ============================================================
// Types — the narrow LiteGraph surface this pack reaches into
// ============================================================

interface PatchedWidget {
  name: string;
  value?: unknown;
  callback?: (value: unknown) => void;
  onPointerDown?: (pointer: unknown, node: PatchedNode, canvas: unknown) => boolean | undefined;
  _filenamePrefixPatched?: boolean;
}

interface PatchedNode {
  type?: string;
  widgets?: PatchedWidget[];
}

function settingsStore(): SettingsStore | null {
  const mgr = (app as unknown as { extensionManager?: { setting?: SettingsStore } })
    .extensionManager;
  return mgr?.setting ?? null;
}

function currentGraph(): GraphLike | null {
  return (app as unknown as { graph?: GraphLike }).graph ?? null;
}

// ============================================================
// Modal
// ============================================================

const STYLE_ID = "comfyui-filename-prefix-style";

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  // 16px inputs to stop iOS zooming on focus; generous tap targets throughout.
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

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function openPicker(widget: PatchedWidget, node: PatchedNode | null): void {
  ensureStyle();

  const graph = currentGraph();
  const resolveWidget = makeResolver(graph);
  const variables = collectVariables(graph);
  const store = settingsStore();

  let draft = typeof widget.value === "string" ? widget.value : "";
  let mode: "build" | "presets" = "build";
  let presets: Preset[] = [];

  // CONTRACT: openModalShell has NO `body` option — it returns a controller
  // with an EMPTY bodyEl you fill AFTER opening. Passing `body:` is silently
  // ignored and renders an empty dialog (green unit tests, broken UI).
  const modal = openModalShell({ title: "Filename prefix", onClose: () => {} });

  const wrap = el("div", "cfp-wrap");
  modal.bodyEl.appendChild(wrap);

  // --- shared header: the editable prefix + live preview ---------------
  const input = el("input", "cfp-input");
  input.type = "text";
  input.value = draft;
  input.spellcheck = false;
  input.autocapitalize = "off";
  input.setAttribute("aria-label", "Filename prefix");

  const preview = el("div", "cfp-preview");
  const warn = el("div", "cfp-warn");

  function refreshPreview(): void {
    const rendered = renderPrefix(draft, { resolveWidget });
    preview.textContent = rendered ? `${rendered}_00001_.png` : "—";
    const problems = [...lintPrefix(draft), ...lintResolved(draft, resolveWidget)];
    const dangling = unresolvedTokens(draft, resolveWidget);
    if (dangling.length) {
      problems.push(
        `Not in this workflow: ${dangling.map((t) => t.raw).join(", ")} — will be written literally.`,
      );
    }
    warn.textContent = problems.join("  ");
  }

  function setDraft(next: string): void {
    draft = next;
    input.value = next;
    refreshPreview();
  }

  input.addEventListener("input", () => {
    draft = input.value;
    refreshPreview();
  });
  // Keep typing/selection inside the modal from reaching the canvas, which
  // would otherwise treat keystrokes as graph shortcuts (delete a node on "d").
  for (const evt of ["pointerdown", "keydown", "keyup", "wheel"]) {
    input.addEventListener(evt, (e) => e.stopPropagation());
  }

  const tabs = el("div", "cfp-tabs");
  const buildTab = el("button", "cfp-tab", "Build");
  const presetTab = el("button", "cfp-tab", "Presets");
  tabs.append(buildTab, presetTab);

  const panel = el("div");

  wrap.append(input, preview, warn, tabs, panel);

  // --- Build panel: token palette --------------------------------------
  function renderBuild(): void {
    panel.replaceChildren();

    const search = el("input", "cfp-input");
    search.type = "text";
    search.placeholder = "Filter variables…";
    search.spellcheck = false;
    for (const evt of ["pointerdown", "keydown", "keyup"]) {
      search.addEventListener(evt, (e) => e.stopPropagation());
    }

    const list = el("div", "cfp-list");

    function paint(query: string): void {
      list.replaceChildren();

      const statics = query
        ? STATIC_TOKENS.filter((t) => fuzzyRank(query, [t.label, t.token]))
        : STATIC_TOKENS;
      for (const t of statics) {
        const row = el("button", "cfp-item");
        const main = el("div", "cfp-item-main");
        main.append(el("div", "cfp-item-title", t.label), el("div", "cfp-item-sub", t.token));
        row.append(main, el("span", "cfp-badge", t.scope));
        row.addEventListener("click", () => setDraft(draft + t.token));
        list.appendChild(row);
      }

      const vars: VariableRef[] = query
        ? variables.filter((v) => fuzzyRank(query, [v.nodeTitle, v.widgetName, v.preview]))
        : variables;

      if (!vars.length && !statics.length) {
        list.appendChild(el("div", "cfp-empty", "No matching variables."));
        return;
      }
      for (const v of vars) {
        const row = el("button", "cfp-item");
        const main = el("div", "cfp-item-main");
        main.append(
          el("div", "cfp-item-title", `${v.nodeTitle} › ${v.widgetName}`),
          el("div", "cfp-item-sub", v.preview),
        );
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
      list.appendChild(
        el(
          "div",
          "cfp-empty",
          "No node variables found in this workflow. Retitle a node (double-click its title) to reference it here.",
        ),
      );
    }

    const actions = el("div", "cfp-row");
    const saveBtn = el("button", "cfp-btn", "Save as preset…");
    saveBtn.addEventListener("click", () => void saveCurrentAsPreset());
    const clearBtn = el("button", "cfp-btn", "Clear");
    clearBtn.addEventListener("click", () => setDraft(""));
    actions.append(saveBtn, clearBtn);

    panel.append(search, list, actions);
  }

  // --- Presets panel ----------------------------------------------------
  async function renderPresets(): Promise<void> {
    panel.replaceChildren();
    const list = el("div", "cfp-list");
    panel.appendChild(list);

    if (!store) {
      list.appendChild(
        el(
          "div",
          "cfp-empty",
          "Settings store unavailable — presets need a newer ComfyUI frontend.",
        ),
      );
      return;
    }

    presets = await loadPresets(store);
    if (!presets.length) presets = STARTER_PRESETS;

    for (const p of presets) {
      const row = el("button", "cfp-item");
      const main = el("div", "cfp-item-main");
      main.append(el("div", "cfp-item-title", p.name), el("div", "cfp-item-sub", p.value));
      row.append(main);

      const del = el("button", "cfp-btn danger", "✕");
      del.setAttribute("aria-label", `Delete preset ${p.name}`);
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        void (async () => {
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

  async function saveCurrentAsPreset(): Promise<void> {
    if (!store) {
      notify({
        severity: "warn",
        summary: "Cannot save preset",
        detail: "ComfyUI's settings store is unavailable on this frontend version.",
      });
      return;
    }
    if (!draft.trim()) {
      notify({ severity: "warn", summary: "Nothing to save", detail: "The prefix is empty." });
      return;
    }
    const name = window.prompt("Preset name", suggestName(draft));
    if (name === null) return; // cancelled
    try {
      const existing = await loadPresets(store);
      const next = upsertPreset(existing.length ? existing : [], { name, value: draft });
      await savePresets(store, next);
      notify({ severity: "success", summary: "Preset saved", detail: name });
    } catch (e) {
      notify({
        severity: "error",
        summary: "Saving preset failed",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function syncTabs(): void {
    buildTab.setAttribute("aria-selected", String(mode === "build"));
    presetTab.setAttribute("aria-selected", String(mode === "presets"));
    if (mode === "build") renderBuild();
    else void renderPresets();
  }

  buildTab.addEventListener("click", () => {
    mode = "build";
    syncTabs();
  });
  presetTab.addEventListener("click", () => {
    mode = "presets";
    syncTabs();
  });

  // --- Apply / cancel ---------------------------------------------------
  const footer = el("div", "cfp-row");
  const apply = el("button", "cfp-btn primary", "Apply");
  apply.addEventListener("click", () => {
    widget.value = draft;
    // Fire the widget's own callback so the graph marks itself dirty and any
    // downstream listeners see the change — assigning `.value` alone does not.
    try {
      widget.callback?.(draft);
    } catch (e) {
      console.warn(`[${EXT_NAME}] widget callback failed`, e);
    }
    (
      app as unknown as { graph?: { setDirtyCanvas?: (a: boolean, b: boolean) => void } }
    ).graph?.setDirtyCanvas?.(true, true);
    modal.close();
  });
  const cancel = el("button", "cfp-btn", "Cancel");
  cancel.addEventListener("click", () => modal.close());
  footer.append(apply, cancel);
  wrap.appendChild(footer);

  refreshPreview();
  syncTabs();
  void node; // node identity is not needed beyond widget resolution today
}

// ============================================================
// Wiring
// ============================================================

function enhanceNode(node: PatchedNode): void {
  for (const w of node?.widgets ?? []) {
    if (!TARGET_WIDGETS.has(w.name)) continue;
    if (w._filenamePrefixPatched) continue; // guard against double-patching
    w._filenamePrefixPatched = true;

    const origDown = w.onPointerDown;
    w.onPointerDown = function (
      this: PatchedWidget,
      pointer: unknown,
      ownerNode: PatchedNode,
      canvas: unknown,
    ): boolean | undefined {
      try {
        if (typeof origDown === "function") {
          const consumed = origDown.call(this, pointer, ownerNode, canvas);
          if (consumed) return consumed;
        }
        openPicker(w, ownerNode || node);
        return true; // consume — suppresses the native text prompt
      } catch (e) {
        console.warn(`[${EXT_NAME}] picker open failed`, e);
        return false; // fall back to native on error
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
      defaultValue: [] as Preset[],
      category: ["Filename Prefix", "Presets", "Saved"],
    },
  ],
  async nodeCreated(node) {
    try {
      enhanceNode(node as unknown as PatchedNode);
    } catch (e) {
      console.warn(`[${EXT_NAME}] nodeCreated enhance failed`, e);
    }
  },
  async loadedGraphNode(node) {
    try {
      enhanceNode(node as unknown as PatchedNode);
    } catch (e) {
      console.warn(`[${EXT_NAME}] loadedGraphNode enhance failed`, e);
    }
  },
});

export { parsePresets, removePreset, suggestName, upsertPreset } from "./presets.js";
export { formatDate, lintPrefix, parseTokens, renderPrefix, unresolvedTokens } from "./tokens.js";
/** Exported for the test suite: does this pack enhance a widget of this name? */
export function targetsWidget(name: string): boolean {
  return TARGET_WIDGETS.has(name);
}

export { collectVariables, makeResolver } from "./variables.js";
// Exported so the jsdom suite can assert the modal actually POPULATES its
// body. Pure-helper tests cannot catch an empty-modal regression — the
// openModalShell contract (fill bodyEl AFTER opening) fails silently.
export { enhanceNode, openPicker };
