// Saved prefix presets.
//
// Storage is ComfyUI's own per-user settings store, which persists SERVER-side
// in `user/default/comfy.settings.json`. That is the whole reason this pack
// needs no Python: presets saved on a phone show up on the desktop, because
// both browsers read the same server-side settings — which localStorage would
// not give us.
//
// The pure serialization logic lives here (and is unit-tested); the settings
// API is injected so tests never touch `app`.

export interface Preset {
  name: string;
  value: string;
}

export const PRESETS_SETTING_ID = "FilenamePrefix.Presets";

/**
 * The settings surface this module needs. Structurally satisfied by
 * `app.extensionManager.setting`, and trivially faked in tests.
 */
export interface SettingsStore {
  get(id: string): unknown;
  set(id: string, value: unknown): Promise<void> | void;
}

/**
 * Coerce whatever is in the settings store into a valid preset list.
 *
 * Settings are user-editable JSON on disk, so this must survive hand-editing:
 * a malformed entry is dropped rather than throwing, because throwing here
 * would break the modal and leave the user no way to fix the bad entry.
 */
export function parsePresets(raw: unknown): Preset[] {
  let data = raw;
  // Tolerate a JSON string — an older version stored it that way, and a
  // hand-editor may well quote it.
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const out: Preset[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    const value = typeof rec.value === "string" ? rec.value : "";
    if (!name || !value) continue;
    out.push({ name, value });
  }
  return dedupeByName(out);
}

/** Last writer wins, so an upsert can simply append and re-dedupe. */
function dedupeByName(presets: Preset[]): Preset[] {
  const byName = new Map<string, Preset>();
  for (const p of presets) byName.set(p.name, p);
  return [...byName.values()];
}

/** Insert or replace a preset by name. Returns a new array (no mutation). */
export function upsertPreset(presets: Preset[], preset: Preset): Preset[] {
  const name = preset.name.trim();
  if (!name || !preset.value) return presets;
  const next = presets.filter((p) => p.name !== name);
  next.push({ name, value: preset.value });
  return next;
}

export function removePreset(presets: Preset[], name: string): Preset[] {
  return presets.filter((p) => p.name !== name);
}

/**
 * A name suggestion derived from the prefix itself, so saving is one tap in
 * the common case. Strips tokens and path segments down to the literal stem.
 */
export function suggestName(prefix: string): string {
  const literal = prefix
    .replace(/%[^%]*%/g, "") // drop tokens
    .split("/")
    .map((seg) =>
      seg
        .replace(/[^A-Za-z0-9_-]+/g, " ")
        // Separators left dangling where a token used to be carry no meaning
        // in a name ("nsfw/%date%/%time%_%seed%" should suggest "nsfw", not
        // "nsfw _").
        .replace(/^[\s_-]+|[\s_-]+$/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return literal || "untitled";
}

export async function loadPresets(store: SettingsStore): Promise<Preset[]> {
  try {
    return parsePresets(store.get(PRESETS_SETTING_ID));
  } catch {
    return [];
  }
}

export async function savePresets(store: SettingsStore, presets: Preset[]): Promise<void> {
  await store.set(PRESETS_SETTING_ID, dedupeByName(presets));
}

/**
 * Seeded on first use so the modal is never an empty box. These encode the
 * shape that actually works well: a dated subfolder plus the settings that
 * distinguish one run from the next.
 */
export const STARTER_PRESETS: Preset[] = [
  { name: "dated folder", value: "%date:yyyy-MM-dd%/ComfyUI" },
  {
    name: "dated + sampler + seed",
    value: "%date:yyyy-MM-dd%/%date:hhmmss%_%KSampler.sampler_name%_s%KSampler.seed%",
  },
  { name: "flat timestamped", value: "ComfyUI_%date:yyyy-MM-dd_hh-mm-ss%" },
];
