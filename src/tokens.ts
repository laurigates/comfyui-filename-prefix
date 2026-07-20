// Filename-prefix token grammar.
//
// ComfyUI substitutes filename_prefix tokens in TWO places, and the split is
// the single most important fact in this pack:
//
//   FRONTEND (comfyui-frontend-package, at prompt-submit time)
//     %date:<fmt>%          e.g. %date:yyyy-MM-dd%
//     %<Node Title>.<widget>%  e.g. %Empty Latent Image.width%
//
//   BACKEND (folder_paths.get_save_image_path, at save time)
//     %width% %height% %year% %month% %day% %hour% %minute% %second%
//
// Verified 2026-07 against ComfyUI's folder_paths.py `compute_vars` and the
// frontend bundle's `formatUtil` chunk (see docs/TOKENS.md). `DATE_TOKEN_RE`
// below is a deliberate mirror of the frontend's own generated regex:
//   Object.keys({d,M,h,m,s}).map(e => e+e+"?").join("|") + "|yyy?y?"
// Keep it byte-compatible — a divergence means the preview lies about what
// the filename will actually be.

/** Date-part extractors, mirroring the frontend's `a` table exactly. */
const DATE_PARTS: Record<string, (d: Date) => number> = {
  d: (d) => d.getDate(),
  M: (d) => d.getMonth() + 1,
  h: (d) => d.getHours(), // 24-hour; the frontend has no 12-hour token
  m: (d) => d.getMinutes(),
  s: (d) => d.getSeconds(),
};

const DATE_TOKEN_RE = new RegExp(
  `${Object.keys(DATE_PARTS)
    .map((k) => `${k}${k}?`)
    .join("|")}|yyy?y?`,
  "g",
);

/**
 * Render a `%date:...%` format string. Mirrors the frontend's `formatDate`,
 * including its quirks: `yyy` and a bare `y` pass through unchanged, and
 * every other token is zero-padded to the length of the token itself
 * (so `d` -> "7", `dd` -> "07").
 */
export function formatDate(pattern: string, now: Date): string {
  return pattern.replace(DATE_TOKEN_RE, (tok) => {
    if (tok === "yy") return `${now.getFullYear()}`.substring(2);
    if (tok === "yyyy") return now.getFullYear().toString();
    const part = DATE_PARTS[tok.charAt(0)];
    if (!part) return tok;
    return `${part(now)}`.padStart(tok.length, "0");
  });
}

/** Resolves `%<Node Title>.<widget>%` against the live graph. */
export type WidgetResolver = (nodeTitle: string, widgetName: string) => string | undefined;

export interface RenderOptions {
  now?: Date;
  resolveWidget?: WidgetResolver;
  /** Image dims for the backend's %width%/%height%; unknown until execution. */
  width?: number;
  height?: number;
  /**
   * When true, leave a token as-is if it cannot be resolved (matching runtime
   * behaviour) instead of substituting a placeholder. The modal preview wants
   * `false` so the user sees WHICH token is dangling.
   */
  keepUnresolved?: boolean;
}

/** A single token occurrence found in a prefix string. */
export interface TokenRef {
  /** Full matched text including the surrounding % signs. */
  raw: string;
  kind: "date" | "widget" | "builtin";
  /** For `widget`: the node title. For `date`: the format. Else the name. */
  target: string;
  /** For `widget`: the widget name. */
  widget?: string;
  index: number;
}

// Anything between two % signs that does not itself contain a %.
const TOKEN_RE = /%([^%]+)%/g;

const BUILTINS = new Set(["width", "height", "year", "month", "day", "hour", "minute", "second"]);

/**
 * Split `Node.widget`, mirroring the frontend's exactly-two-parts rule.
 * Returns null when the token is not a usable node reference.
 */
function splitNodeRef(inner: string): [string, string] | null {
  const parts = inner.split(".");
  if (parts.length !== 2) return null;
  const [node, widget] = parts;
  if (!node || !widget) return null;
  return [node, widget];
}

// Characters the frontend replaces with `_` INSIDE A SUBSTITUTED VALUE.
// Verified against `applyTextReplacements` in the frontend bundle:
//   ((o.value ?? "") + "").replaceAll(/[/?<>\\:*|"\x00-\x1F\x7F]/g, "_")
// Two consequences worth knowing:
//   `.` is NOT replaced — `%LoadImage.image%` yields `photo.jpg`, landing a
//   file extension in the middle of the output filename.
//   `/` IS replaced — a substituted value can never create a subfolder; only a
//   literal `/` typed into the template can.
const SUBST_ILLEGAL = new Set(["/", "?", "<", ">", "\\", ":", "*", "|", '"']);

/**
 * Apply the frontend's own sanitization to a substituted widget value. The
 * preview MUST do this or it disagrees with the real filename — e.g. Wan's
 * fused scheduler value `dpm++_sde/beta` renders as `dpm++_sde_beta`, not as
 * a `dpm++_sde/` subfolder.
 */
export function sanitizeSubstitution(value: string): string {
  let out = "";
  for (const ch of value) {
    const c = ch.codePointAt(0) ?? 0;
    out += SUBST_ILLEGAL.has(ch) || c < 0x20 || c === 0x7f ? "_" : ch;
  }
  return out;
}

/** Parse every token in a prefix. Used by both the preview and the linter. */
export function parseTokens(prefix: string): TokenRef[] {
  const out: TokenRef[] = [];
  for (const m of prefix.matchAll(TOKEN_RE)) {
    const inner = m[1];
    if (inner === undefined) continue;
    const index = m.index ?? 0;
    if (inner.startsWith("date:")) {
      out.push({ raw: m[0], kind: "date", target: inner.slice(5), index });
    } else if (BUILTINS.has(inner)) {
      out.push({ raw: m[0], kind: "builtin", target: inner, index });
    } else {
      // `%Node.widget%` — the frontend does `t.split(".")` and requires
      // EXACTLY two parts (`if (r.length !== 2) …`). So a node title containing
      // a dot ("Wan 2.2 sampler") is unreferenceable: the token is left literal
      // and the console warns "Invalid replacement pattern". Splitting on the
      // last dot would make the preview claim such a token works when it does not.
      const parts = splitNodeRef(inner);
      if (!parts) continue; // not a valid reference
      out.push({ raw: m[0], kind: "widget", target: parts[0], widget: parts[1], index });
    }
  }
  return out;
}

function renderBuiltin(name: string, o: RenderOptions): string | undefined {
  const now = o.now ?? new Date();
  const pad = (n: number) => `${n}`.padStart(2, "0");
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
      return undefined;
  }
}

/**
 * Render a prefix to the filename it would produce. Note the trailing
 * `_00001_` counter and the extension are added by the backend and are NOT
 * part of this — callers append their own illustrative suffix.
 */
export function renderPrefix(prefix: string, opts: RenderOptions = {}): string {
  const now = opts.now ?? new Date();
  return prefix.replace(TOKEN_RE, (raw, inner: string) => {
    if (inner.startsWith("date:")) return formatDate(inner.slice(5), now);
    if (BUILTINS.has(inner)) {
      const v = renderBuiltin(inner, opts);
      if (v !== undefined) return v;
      return opts.keepUnresolved ? raw : `?${inner}?`;
    }
    const parts = splitNodeRef(inner);
    if (parts) {
      const v = opts.resolveWidget?.(parts[0], parts[1]);
      // Sanitize exactly as the frontend does, or the preview shows a filename
      // the user will never actually get.
      if (v !== undefined && v !== "") return sanitizeSubstitution(v);
    }
    return opts.keepUnresolved ? raw : `?${inner}?`;
  });
}

/**
 * Tokens present in the prefix that the graph cannot resolve. This is the
 * pack's main safety net: a prefix referencing a node you later renamed
 * silently writes a literal `%old-title.seed%` into your filename, and you
 * only notice weeks later when sorting outputs.
 */
export function unresolvedTokens(prefix: string, resolve: WidgetResolver): TokenRef[] {
  return parseTokens(prefix).filter(
    (t) => t.kind === "widget" && resolve(t.target, t.widget ?? "") === undefined,
  );
}

// Extensions common enough in widget values (image pickers, model loaders)
// that seeing one mid-filename is almost never intended.
const EXT_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?|mp4|webm|mov|safetensors|ckpt|pt|pth|bin|gguf)$/i;

/**
 * Warnings that depend on what the tokens RESOLVE to, not on the template.
 * Separate from `lintPrefix` because these need the live graph.
 *
 * The motivating case is real and common: `%LoadImage.image%` returns the bare
 * filename *including* its extension, so a prefix ending in it produces
 * `…_photo.jpg_00001_.png` — the extension lands mid-name. Observed on 76
 * existing outputs before this check existed.
 */
export function lintResolved(prefix: string, resolve: WidgetResolver): string[] {
  const problems: string[] = [];
  for (const t of parseTokens(prefix)) {
    if (t.kind !== "widget") continue;
    const value = resolve(t.target, t.widget ?? "");
    if (value === undefined || value === "") continue;
    if (EXT_RE.test(value)) {
      problems.push(
        `${t.raw} resolves to "${value}" — the file extension will appear in the middle of the name.`,
      );
    }
    const sanitized = sanitizeSubstitution(value);
    if (sanitized !== value) {
      problems.push(`${t.raw} resolves to "${value}", which ComfyUI rewrites to "${sanitized}".`);
    }
  }
  return problems;
}

/** Filename characters that are illegal or hostile across platforms. */
// Path separators are deliberately EXCLUDED — `a/b` is a valid prefix meaning
// "subfolder a, file b", and the backend supports it (it rejects escaping the
// output dir itself). `%` is excluded because it delimits tokens.
// Illegal on Windows and hostile everywhere. Deliberately NOT included:
//   `/` — valid prefix separator meaning "subfolder"; the backend supports it
//         and only rejects escaping the output dir (checked separately below).
//   `%` — delimits tokens.
//   `-` and ` ` — legal, and `-` is heavily used (`krea-turbo`, `wan-sampler-high`).
// Control chars are written as escapes, not literal bytes, so the source stays clean.
const ILLEGAL_RE = /[<>:"\\|?*]/g;

/** Control characters, checked by code point (a regex range trips lint rules). */
const hasControlChar = (s: string): boolean => {
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
};

/** Problems worth warning about before a prefix is applied. */
export function lintPrefix(prefix: string): string[] {
  const problems: string[] = [];
  if (!prefix.trim()) problems.push("Prefix is empty.");
  // Character checks run on the LITERAL text only. Token bodies legitimately
  // contain characters that are illegal in a filename — `%date:yyyy-MM-dd%`
  // has a colon — but they never reach the filesystem, because substitution
  // replaces the whole token before the name is written.
  const literal = prefix.replace(/%[^%]*%/g, "");
  const illegal = [...new Set(literal.match(ILLEGAL_RE) ?? [])];
  if (illegal.length) {
    problems.push(
      `Illegal filename character(s): ${illegal.map((c) => JSON.stringify(c)).join(", ")}`,
    );
  }
  if (hasControlChar(literal)) problems.push("Contains control characters.");
  if (literal.includes(" ")) {
    problems.push("Contains spaces — legal, but awkward in shell commands and URLs.");
  }
  // An odd number of % signs means a token was left half-typed.
  if ((prefix.match(/%/g)?.length ?? 0) % 2 !== 0) {
    problems.push("Unbalanced % — a token looks unfinished.");
  }
  if (prefix.startsWith("/") || prefix.includes("..")) {
    problems.push("Leading / or .. — ComfyUI refuses to save outside the output folder.");
  }
  return problems;
}
