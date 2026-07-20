import { describe, expect, it } from "vitest";
import {
  formatDate,
  lintPrefix,
  parseTokens,
  renderPrefix,
  unresolvedTokens,
} from "../../src/tokens.ts";

// A fixed instant used everywhere below: 2026-07-05 14:30:52 local time.
const NOW = new Date(2026, 6, 5, 14, 30, 52);

describe("formatDate — mirrors the frontend's formatUtil grammar", () => {
  it("renders the documented tokens", () => {
    expect(formatDate("yyyy-MM-dd", NOW)).toBe("2026-07-05");
    expect(formatDate("hhmmss", NOW)).toBe("143052");
    expect(formatDate("yy", NOW)).toBe("26");
    expect(formatDate("yyyy-MM", NOW)).toBe("2026-07");
  });

  it("pads to the token's own length, so single letters are unpadded", () => {
    expect(formatDate("d", NOW)).toBe("5");
    expect(formatDate("dd", NOW)).toBe("05");
    expect(formatDate("M", NOW)).toBe("7");
    expect(formatDate("MM", NOW)).toBe("07");
  });

  it("uses a 24-hour clock — the frontend has no 12-hour token", () => {
    expect(formatDate("hh", new Date(2026, 6, 5, 0, 0, 0))).toBe("00");
    expect(formatDate("hh", new Date(2026, 6, 5, 23, 0, 0))).toBe("23");
  });

  it("passes through yyy and a bare y unchanged, matching the frontend quirk", () => {
    // The upstream regex matches these but its replacer handles only yy/yyyy,
    // so they fall through literally. Mirrored deliberately: diverging here
    // would make the preview disagree with the real filename.
    expect(formatDate("yyy", NOW)).toBe("yyy");
    expect(formatDate("y", NOW)).toBe("y");
  });

  it("leaves non-token characters alone", () => {
    expect(formatDate("[]-_.", NOW)).toBe("[]-_.");
  });
});

describe("parseTokens", () => {
  it("classifies each token kind", () => {
    const toks = parseTokens("%date:yyyy%/%width%_%KSampler.seed%");
    expect(toks.map((t) => t.kind)).toEqual(["date", "builtin", "widget"]);
    expect(toks[2]).toMatchObject({ target: "KSampler", widget: "seed" });
  });

  it("splits a node reference on the LAST dot, so dotted node titles survive", () => {
    // "Wan 2.2 sampler" is a realistic retitle and contains a dot.
    const [tok] = parseTokens("%Wan 2.2 sampler.sampler_name%");
    expect(tok).toMatchObject({ target: "Wan 2.2 sampler", widget: "sampler_name" });
  });

  it("ignores a token with no dot at all (not a node reference)", () => {
    expect(parseTokens("%nonsense%")).toEqual([]);
  });
});

describe("renderPrefix — the user's real popos prefix", () => {
  // Verbatim from the workflows on popos. This is the shape the pack exists
  // to make one-tap, so it is the load-bearing golden case.
  const REAL =
    "nsfw/%date:yyyy-MM-dd%/%date:hhmmss%_%wan-sampler-high.sampler%" +
    "_%wan-sampler-high.scheduler%_s%seed.seed%_%steps.value%steps";

  const resolveWidget = (node, widget) =>
    ({
      "wan-sampler-high sampler": "euler",
      "wan-sampler-high scheduler": "simple",
      "seed seed": "123456",
      "steps value": "20",
    })[`${node} ${widget}`];

  it("renders exactly the filename layout seen in the output directory", () => {
    expect(renderPrefix(REAL, { now: NOW, resolveWidget })).toBe(
      "nsfw/2026-07-05/143052_euler_simple_s123456_20steps",
    );
  });

  it("flags a token whose node was renamed instead of silently passing it", () => {
    // The real hazard: rename `steps` and the prefix keeps "working", writing
    // a literal %steps.value% into every filename.
    const renamed = (node, widget) => (node === "steps" ? undefined : resolveWidget(node, widget));
    const dangling = unresolvedTokens(REAL, renamed);
    expect(dangling.map((t) => t.raw)).toEqual(["%steps.value%"]);
  });

  it("marks unresolved tokens visibly in the preview rather than hiding them", () => {
    const out = renderPrefix("%missing.widget%", { now: NOW, resolveWidget });
    expect(out).toBe("?missing.widget?");
  });

  it("can keep unresolved tokens verbatim to mimic runtime behaviour", () => {
    const out = renderPrefix("%missing.widget%", {
      now: NOW,
      resolveWidget,
      keepUnresolved: true,
    });
    expect(out).toBe("%missing.widget%");
  });
});

describe("renderPrefix — backend builtins", () => {
  it("renders date builtins from the clock", () => {
    expect(renderPrefix("%year%-%month%-%day%", { now: NOW })).toBe("2026-07-05");
    expect(renderPrefix("%hour%%minute%%second%", { now: NOW })).toBe("143052");
  });

  it("leaves width/height unresolved when dimensions are unknown", () => {
    // Dimensions are not known until execution, so the modal cannot preview
    // them — it must not invent a number.
    expect(renderPrefix("%width%x%height%", { now: NOW })).toBe("?width?x?height?");
    expect(renderPrefix("%width%x%height%", { now: NOW, width: 1024, height: 768 })).toBe(
      "1024x768",
    );
  });
});

describe("lintPrefix", () => {
  it("accepts every real prefix found on popos", () => {
    const real = [
      "WanVideoWrapper_I2V",
      "nsfw/%date:yyyy-MM-dd%/%date:hhmmss%_%seed.seed%",
      "wan-mmaudio/wan-mmaudio",
      "ComfyUI_%date:yyyy-MM-dd_hh-mm-ss%",
      "klein-distilled-i2i-pid4k",
    ];
    for (const p of real) {
      expect(lintPrefix(p), `expected no complaints for ${p}`).toEqual([]);
    }
  });

  it("does not flag hyphens or forward slashes, which are legal and common", () => {
    expect(lintPrefix("a-b/c-d")).toEqual([]);
  });

  it("flags characters that are genuinely illegal in a filename", () => {
    expect(lintPrefix("bad:name").join(" ")).toMatch(/Illegal/);
    expect(lintPrefix("bad?name").join(" ")).toMatch(/Illegal/);
  });

  it("flags an unfinished token", () => {
    expect(lintPrefix("%date:yyyy").join(" ")).toMatch(/Unbalanced/);
  });

  it("flags an attempt to escape the output directory", () => {
    expect(lintPrefix("../etc/passwd").join(" ")).toMatch(/outside the output folder/);
    expect(lintPrefix("/abs/path").join(" ")).toMatch(/outside the output folder/);
  });

  it("flags an empty prefix", () => {
    expect(lintPrefix("   ").join(" ")).toMatch(/empty/);
  });
});
