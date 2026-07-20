// @vitest-environment jsdom
//
// DOM-attach tests. The pure-helper suites cannot catch the failure mode this
// file exists for: `openModalShell` returns a controller whose `bodyEl` you
// must fill AFTER opening, and passing `body:` is silently ignored. That bug
// renders an empty dialog while every pure test stays green — only asserting
// against real DOM catches it.
import { beforeEach, describe, expect, it } from "vitest";
import { enhanceNode, openPicker, targetsWidget } from "../../src/index.ts";
import { app } from "./__mocks__/app.js";

const NODES = [
  {
    title: "wan-sampler-high",
    type: "KSamplerAdvanced",
    widgets: [
      { name: "sampler", value: "euler" },
      { name: "scheduler", value: "simple" },
    ],
  },
  { title: "seed", type: "PrimitiveInt", widgets: [{ name: "seed", value: 123456 }] },
];

function makeWidget(value = "") {
  return { name: "filename_prefix", value };
}

beforeEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
  app.__reset(NODES);
});

describe("widget targeting", () => {
  it("recognises a target widget name and rejects a non-target", () => {
    expect(targetsWidget("filename_prefix")).toBe(true);
    expect(targetsWidget("definitely-not-a-target-widget")).toBe(false);
  });
});

describe("enhanceNode", () => {
  it("patches a filename_prefix widget exactly once", () => {
    const w = makeWidget();
    const node = { type: "SaveImage", widgets: [w] };
    enhanceNode(node);
    const patched = w.onPointerDown;
    expect(typeof patched).toBe("function");
    enhanceNode(node); // second pass must not re-wrap
    expect(w.onPointerDown).toBe(patched);
  });

  it("leaves unrelated widgets untouched", () => {
    const other = { name: "seed", value: 1 };
    enhanceNode({ type: "KSampler", widgets: [other] });
    expect(other.onPointerDown).toBeUndefined();
  });

  it("chains to an existing handler and does not open when it consumes", () => {
    const w = makeWidget();
    let called = 0;
    w.onPointerDown = () => {
      called += 1;
      return true; // consumed
    };
    enhanceNode({ type: "SaveImage", widgets: [w] });
    const consumed = w.onPointerDown({}, { type: "SaveImage", widgets: [w] }, {});
    expect(called).toBe(1);
    expect(consumed).toBe(true);
    // Consumed by the original handler, so no modal should have opened.
    expect(document.querySelector(".cfp-wrap")).toBeNull();
  });
});

describe("openPicker renders a populated modal", () => {
  it("attaches the builder body to the DOM, not an empty shell", () => {
    openPicker(makeWidget("ComfyUI"), null);
    const wrap = document.querySelector(".cfp-wrap");
    expect(wrap).not.toBeNull();
    // The regression guard: the body must actually contain the controls.
    expect(wrap.querySelector(".cfp-input")).not.toBeNull();
    expect(wrap.querySelector(".cfp-preview")).not.toBeNull();
    expect(wrap.querySelectorAll(".cfp-tab")).toHaveLength(2);
  });

  it("seeds the input from the widget's current value", () => {
    openPicker(makeWidget("WanVideoWrapper_I2V"), null);
    expect(document.querySelector(".cfp-input").value).toBe("WanVideoWrapper_I2V");
  });

  it("previews the rendered filename, resolving against the open graph", () => {
    openPicker(makeWidget("%seed.seed%_out"), null);
    expect(document.querySelector(".cfp-preview").textContent).toBe("123456_out_00001_.png");
  });

  it("warns about a token the open graph cannot resolve", () => {
    openPicker(makeWidget("%not-in-graph.value%"), null);
    expect(document.querySelector(".cfp-warn").textContent).toMatch(/Not in this workflow/);
  });

  it("lists the graph's variables as tappable rows", () => {
    openPicker(makeWidget(""), null);
    const subs = [...document.querySelectorAll(".cfp-item-title")].map((e) => e.textContent);
    expect(subs).toContain("seed › seed");
    expect(subs).toContain("wan-sampler-high › sampler");
  });

  it("appends the token when a variable row is tapped", () => {
    openPicker(makeWidget("out_"), null);
    const row = [...document.querySelectorAll(".cfp-item")].find((e) =>
      e.textContent.includes("seed › seed"),
    );
    row.click();
    expect(document.querySelector(".cfp-input").value).toBe("out_%seed.seed%");
  });

  it("writes the draft back to the widget on Apply", () => {
    const w = makeWidget("old");
    let callbackValue;
    w.callback = (v) => {
      callbackValue = v;
    };
    openPicker(w, null);
    const input = document.querySelector(".cfp-input");
    input.value = "new-prefix";
    input.dispatchEvent(new window.Event("input"));
    [...document.querySelectorAll(".cfp-btn")].find((b) => b.textContent === "Apply").click();
    expect(w.value).toBe("new-prefix");
    // The callback must fire too — assigning .value alone leaves the graph
    // unaware the widget changed.
    expect(callbackValue).toBe("new-prefix");
  });

  it("leaves the widget untouched on Cancel", () => {
    const w = makeWidget("original");
    openPicker(w, null);
    const input = document.querySelector(".cfp-input");
    input.value = "discarded";
    input.dispatchEvent(new window.Event("input"));
    [...document.querySelectorAll(".cfp-btn")].find((b) => b.textContent === "Cancel").click();
    expect(w.value).toBe("original");
  });

  it("shows saved presets when the Presets tab is selected", async () => {
    openPicker(makeWidget(""), null);
    [...document.querySelectorAll(".cfp-tab")].find((t) => t.textContent === "Presets").click();
    // The presets panel renders asynchronously (settings read).
    await new Promise((r) => setTimeout(r, 0));
    const titles = [...document.querySelectorAll(".cfp-item-title")].map((e) => e.textContent);
    // With no saved presets the starter set is shown, so the panel is never
    // an empty box on first use.
    expect(titles.length).toBeGreaterThan(0);
  });

  it("injects its stylesheet exactly once across repeated opens", () => {
    openPicker(makeWidget(""), null);
    openPicker(makeWidget(""), null);
    expect(document.querySelectorAll("#comfyui-filename-prefix-style")).toHaveLength(1);
  });
});
