// Live-graph introspection: what `%Node.widget%` tokens are available RIGHT
// NOW, in the workflow the user has open.
//
// This is the difference between a text field and a builder. The user's real
// prefixes reference nodes they retitled to short names (`seed`, `steps`,
// `wan-sampler-high`), which is only discoverable by reading the open graph.

/** The narrow structural slice of a LiteGraph node this module reads. */
export interface GraphNodeLike {
  id?: number | string;
  /** User-assigned title, when the node has been renamed. */
  title?: string;
  /** The node class, e.g. "KSampler" — the fallback title. */
  type?: string;
  /**
   * ComfyUI's search-and-replace name, defaulted to the node class. The
   * frontend matches `%Name.widget%` against THIS FIRST and only falls back to
   * `title`, so a retitled node stays reachable by its original class name.
   */
  properties?: Record<string, unknown>;
  widgets?: Array<{ name?: string; value?: unknown; type?: string }>;
}

/** The `Node name for S&R` property, which takes precedence over the title. */
export function srName(node: GraphNodeLike): string {
  const v = node.properties?.["Node name for S&R"];
  return typeof v === "string" ? v.trim() : "";
}

export interface GraphLike {
  _nodes?: GraphNodeLike[];
  nodes?: GraphNodeLike[];
}

/** One selectable variable in the builder palette. */
export interface VariableRef {
  /** The token to insert, e.g. `%wan-sampler-high.sampler%`. */
  token: string;
  /** Node title as displayed. */
  nodeTitle: string;
  widgetName: string;
  /** Current value, shown so the user can confirm they picked the right node. */
  preview: string;
  /** True when >1 node shares this title — the token is then ambiguous. */
  ambiguous: boolean;
}

/**
 * The effective title ComfyUI matches `%Title.widget%` against: the explicit
 * user title if set, else the node type.
 */
export function effectiveTitle(node: GraphNodeLike): string {
  const t = (node.title ?? "").trim();
  return t !== "" ? t : (node.type ?? "").trim();
}

function nodesOf(graph: GraphLike | null | undefined): GraphNodeLike[] {
  if (!graph) return [];
  // LiteGraph exposes `_nodes`; some frontend versions also mirror it as
  // `nodes`. Prefer whichever is a non-empty array.
  const a = Array.isArray(graph._nodes) ? graph._nodes : [];
  if (a.length) return a;
  return Array.isArray(graph.nodes) ? graph.nodes : [];
}

/** Values too long or too structural to be useful inside a filename. */
function previewValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v !== "string") return null; // objects/arrays: not filename material
  if (v.length > 40) return `${v.slice(0, 37)}…`;
  return v;
}

/**
 * Every `%Node.widget%` variable offered by the open graph, sorted so the
 * short, deliberately-retitled nodes (the ones the user set up FOR this) come
 * before the long default class names.
 */
export function collectVariables(graph: GraphLike | null | undefined): VariableRef[] {
  const nodes = nodesOf(graph);

  const titleCounts = new Map<string, number>();
  for (const n of nodes) {
    const t = effectiveTitle(n);
    if (t) titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1);
  }

  const out: VariableRef[] = [];
  for (const n of nodes) {
    const nodeTitle = effectiveTitle(n);
    if (!nodeTitle) continue;
    for (const w of n.widgets ?? []) {
      const widgetName = (w?.name ?? "").trim();
      if (!widgetName) continue;
      // A filename_prefix referencing itself would be circular.
      if (widgetName === "filename_prefix") continue;
      const preview = previewValue(w?.value);
      if (preview === null) continue;
      out.push({
        token: `%${nodeTitle}.${widgetName}%`,
        nodeTitle,
        widgetName,
        preview,
        ambiguous: (titleCounts.get(nodeTitle) ?? 0) > 1,
      });
    }
  }

  // Deduplicate identical tokens (two same-titled nodes produce the same
  // token; ComfyUI resolves it to whichever it finds first, so offering it
  // twice is just noise — the `ambiguous` flag carries the warning).
  const seen = new Set<string>();
  const deduped = out.filter((v) => {
    if (seen.has(v.token)) return false;
    seen.add(v.token);
    return true;
  });

  return deduped.sort((a, b) => {
    // Retitled nodes are almost always shorter than class names, and they are
    // what the user actually wants to reference.
    const byLen = a.nodeTitle.length - b.nodeTitle.length;
    if (byLen !== 0) return byLen;
    const byTitle = a.nodeTitle.localeCompare(b.nodeTitle);
    return byTitle !== 0 ? byTitle : a.widgetName.localeCompare(b.widgetName);
  });
}

/** Builds the resolver `renderPrefix` uses, backed by the open graph. */
export function makeResolver(
  graph: GraphLike | null | undefined,
): (nodeTitle: string, widgetName: string) => string | undefined {
  const nodes = nodesOf(graph);

  // TWO indexes, consulted in order — not one merged map. The frontend first
  // filters nodes by the `Node name for S&R` property and only falls back to
  // `title` if that yields nothing. Merging them would let a title match win
  // over an S&R match and silently disagree with the real substitution.
  //
  // Each is nested (node -> widget -> value) rather than keyed by a joined
  // string. Node titles routinely contain spaces, so any single-character
  // separator risks a collision, and reaching for an exotic one invites
  // writing a literal control byte into the source (which silently turns this
  // file binary — it happened once already).
  const bySr = new Map<string, Map<string, string>>();
  const byTitle = new Map<string, Map<string, string>>();

  const add = (index: Map<string, Map<string, string>>, key: string, n: GraphNodeLike): void => {
    if (!key) return;
    let widgets = index.get(key);
    if (!widgets) {
      widgets = new Map<string, string>();
      index.set(key, widgets);
    }
    for (const w of n.widgets ?? []) {
      const name = (w?.name ?? "").trim();
      if (!name) continue;
      // First writer wins — the frontend takes the first of multiple matches.
      if (!widgets.has(name)) widgets.set(name, String(w?.value ?? ""));
    }
  };

  for (const n of nodes) add(bySr, srName(n), n);
  for (const n of nodes) add(byTitle, effectiveTitle(n), n);

  return (nodeName, widgetName) =>
    bySr.get(nodeName)?.get(widgetName) ?? byTitle.get(nodeName)?.get(widgetName);
}

/** The date/builtin tokens, offered alongside the graph variables. */
export interface StaticToken {
  token: string;
  label: string;
  /** Where substitution happens — worth showing, since it changes behaviour. */
  scope: "frontend" | "backend";
}

export const STATIC_TOKENS: StaticToken[] = [
  { token: "%date:yyyy-MM-dd%", label: "Date (2026-07-20)", scope: "frontend" },
  { token: "%date:hhmmss%", label: "Time (143052)", scope: "frontend" },
  { token: "%date:yyyy-MM-dd_hh-mm-ss%", label: "Date + time", scope: "frontend" },
  { token: "%date:yyyy-MM%", label: "Year-month (2026-07)", scope: "frontend" },
  { token: "%width%", label: "Image width", scope: "backend" },
  { token: "%height%", label: "Image height", scope: "backend" },
];
