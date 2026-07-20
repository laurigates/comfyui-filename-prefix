import { describe, expect, it } from "vitest";
import {
  loadPresets,
  parsePresets,
  removePreset,
  savePresets,
  suggestName,
  upsertPreset,
} from "../../src/presets.ts";

/** A stand-in for `app.extensionManager.setting`. */
function fakeStore(initial) {
  let stored = initial;
  return {
    get: () => stored,
    set: (_id, value) => {
      stored = value;
    },
    peek: () => stored,
  };
}

describe("parsePresets — must survive hand-edited settings JSON", () => {
  it("reads a well-formed list", () => {
    expect(parsePresets([{ name: "a", value: "x" }])).toEqual([{ name: "a", value: "x" }]);
  });

  it("accepts a JSON string, since a hand-editor may quote it", () => {
    expect(parsePresets('[{"name":"a","value":"x"}]')).toEqual([{ name: "a", value: "x" }]);
  });

  it("drops malformed entries rather than throwing", () => {
    // Throwing here would break the modal and leave the user no way to reach
    // the UI that would let them fix the bad entry.
    const raw = [
      { name: "ok", value: "x" },
      { name: "", value: "x" },
      { name: "no-value" },
      null,
      "string",
      42,
    ];
    expect(parsePresets(raw)).toEqual([{ name: "ok", value: "x" }]);
  });

  it("returns an empty list for junk input", () => {
    expect(parsePresets(undefined)).toEqual([]);
    expect(parsePresets(null)).toEqual([]);
    expect(parsePresets("not json")).toEqual([]);
    expect(parsePresets({ not: "an array" })).toEqual([]);
  });

  it("collapses duplicate names, last writer winning", () => {
    expect(
      parsePresets([
        { name: "a", value: "first" },
        { name: "a", value: "second" },
      ]),
    ).toEqual([{ name: "a", value: "second" }]);
  });
});

describe("upsertPreset / removePreset", () => {
  const base = [{ name: "a", value: "1" }];

  it("appends a new preset without mutating the input", () => {
    const next = upsertPreset(base, { name: "b", value: "2" });
    expect(next).toHaveLength(2);
    expect(base).toHaveLength(1);
  });

  it("replaces an existing preset by name", () => {
    const next = upsertPreset(base, { name: "a", value: "updated" });
    expect(next).toEqual([{ name: "a", value: "updated" }]);
  });

  it("trims the name and rejects an empty name or value", () => {
    expect(upsertPreset(base, { name: "  b  ", value: "2" })[1].name).toBe("b");
    expect(upsertPreset(base, { name: "  ", value: "2" })).toBe(base);
    expect(upsertPreset(base, { name: "b", value: "" })).toBe(base);
  });

  it("removes by name and is a no-op for an unknown name", () => {
    expect(removePreset(base, "a")).toEqual([]);
    expect(removePreset(base, "nope")).toEqual(base);
  });
});

describe("suggestName", () => {
  it("strips tokens down to the literal stem", () => {
    expect(suggestName("nsfw/%date:yyyy-MM-dd%/%date:hhmmss%_%seed.seed%")).toBe("nsfw");
    // The trailing separator is dropped too — it only existed to join the
    // token that was just removed.
    expect(suggestName("ComfyUI_%date:yyyy%")).toBe("ComfyUI");
  });

  it("keeps a plain prefix as-is", () => {
    expect(suggestName("WanVideoWrapper_I2V")).toBe("WanVideoWrapper_I2V");
  });

  it("falls back to 'untitled' when nothing literal remains", () => {
    expect(suggestName("%date:yyyy%")).toBe("untitled");
    expect(suggestName("")).toBe("untitled");
  });
});

describe("loadPresets / savePresets round-trip", () => {
  it("persists through the settings store", async () => {
    const store = fakeStore([]);
    await savePresets(store, [{ name: "a", value: "x" }]);
    expect(await loadPresets(store)).toEqual([{ name: "a", value: "x" }]);
  });

  it("returns an empty list when the store throws", async () => {
    const broken = {
      get: () => {
        throw new Error("settings unavailable");
      },
      set: () => {},
    };
    expect(await loadPresets(broken)).toEqual([]);
  });

  it("deduplicates on the way out so the stored file stays clean", async () => {
    const store = fakeStore([]);
    await savePresets(store, [
      { name: "a", value: "1" },
      { name: "a", value: "2" },
    ]);
    expect(store.peek()).toEqual([{ name: "a", value: "2" }]);
  });
});
