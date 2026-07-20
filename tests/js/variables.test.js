import { describe, expect, it } from "vitest";
import { collectVariables, effectiveTitle, makeResolver } from "../../src/variables.ts";

// A graph shaped like the user's real Wan workflows: nodes deliberately
// retitled to short names, alongside untouched default class names.
const GRAPH = {
  _nodes: [
    {
      id: 1,
      title: "wan-sampler-high",
      type: "KSamplerAdvanced",
      widgets: [
        { name: "sampler", value: "euler" },
        { name: "scheduler", value: "simple" },
      ],
    },
    { id: 2, title: "seed", type: "PrimitiveInt", widgets: [{ name: "seed", value: 123456 }] },
    { id: 3, title: "", type: "EmptyLatentImage", widgets: [{ name: "width", value: 1024 }] },
    {
      id: 4,
      title: "",
      type: "SaveImage",
      widgets: [{ name: "filename_prefix", value: "ComfyUI" }],
    },
  ],
};

describe("effectiveTitle", () => {
  it("prefers the user title and falls back to the node type", () => {
    expect(effectiveTitle({ title: "seed", type: "PrimitiveInt" })).toBe("seed");
    expect(effectiveTitle({ title: "", type: "EmptyLatentImage" })).toBe("EmptyLatentImage");
    expect(effectiveTitle({ title: "  ", type: "KSampler" })).toBe("KSampler");
  });
});

describe("collectVariables", () => {
  it("offers a token per node widget, using the effective title", () => {
    const tokens = collectVariables(GRAPH).map((v) => v.token);
    expect(tokens).toContain("%wan-sampler-high.sampler%");
    expect(tokens).toContain("%seed.seed%");
    expect(tokens).toContain("%EmptyLatentImage.width%");
  });

  it("never offers filename_prefix itself, which would be circular", () => {
    const tokens = collectVariables(GRAPH).map((v) => v.token);
    expect(tokens.some((t) => t.includes("filename_prefix"))).toBe(false);
  });

  it("sorts short retitled nodes ahead of long default class names", () => {
    const titles = collectVariables(GRAPH).map((v) => v.nodeTitle);
    expect(titles.indexOf("seed")).toBeLessThan(titles.indexOf("EmptyLatentImage"));
  });

  it("shows the current value so the right node is identifiable", () => {
    const v = collectVariables(GRAPH).find((x) => x.token === "%seed.seed%");
    expect(v.preview).toBe("123456");
  });

  it("marks duplicate titles ambiguous and offers the token only once", () => {
    const dup = {
      _nodes: [
        { title: "sampler", widgets: [{ name: "steps", value: 20 }] },
        { title: "sampler", widgets: [{ name: "steps", value: 30 }] },
      ],
    };
    const vars = collectVariables(dup);
    expect(vars).toHaveLength(1);
    expect(vars[0].ambiguous).toBe(true);
  });

  it("omits widgets whose value is not filename material", () => {
    const odd = {
      _nodes: [{ title: "n", widgets: [{ name: "mask", value: { a: 1 } }] }],
    };
    expect(collectVariables(odd)).toEqual([]);
  });

  it("truncates a long value rather than rendering a whole prompt", () => {
    const long = {
      _nodes: [{ title: "n", widgets: [{ name: "text", value: "x".repeat(200) }] }],
    };
    const [v] = collectVariables(long);
    expect(v.preview.length).toBeLessThanOrEqual(38);
    expect(v.preview.endsWith("…")).toBe(true);
  });

  it("returns an empty list for a missing or empty graph instead of throwing", () => {
    expect(collectVariables(null)).toEqual([]);
    expect(collectVariables(undefined)).toEqual([]);
    expect(collectVariables({})).toEqual([]);
  });

  it("reads the `nodes` mirror when `_nodes` is absent", () => {
    const mirrored = { nodes: [{ title: "n", widgets: [{ name: "v", value: 1 }] }] };
    expect(collectVariables(mirrored).map((v) => v.token)).toEqual(["%n.v%"]);
  });
});

describe("makeResolver", () => {
  it("resolves a token to the widget's current value", () => {
    const r = makeResolver(GRAPH);
    expect(r("wan-sampler-high", "sampler")).toBe("euler");
    expect(r("seed", "seed")).toBe("123456");
  });

  it("returns undefined for an unknown node or widget", () => {
    const r = makeResolver(GRAPH);
    expect(r("nope", "sampler")).toBeUndefined();
    expect(r("seed", "nope")).toBeUndefined();
  });

  it("resolves a duplicated title to the first node, matching ComfyUI", () => {
    const dup = {
      _nodes: [
        { title: "s", widgets: [{ name: "v", value: "first" }] },
        { title: "s", widgets: [{ name: "v", value: "second" }] },
      ],
    };
    expect(makeResolver(dup)("s", "v")).toBe("first");
  });

  it("survives a null graph", () => {
    expect(makeResolver(null)("a", "b")).toBeUndefined();
  });
});
