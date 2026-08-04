// @vitest-environment jsdom
//
// Mobile/touch layout contract for the picker modal.
//
// These are the defects a cross-pack UX audit found here and nowhere else in
// the family: the primary action scrolled away below a nested inner scroller,
// the kit auto-focused a search box this pack never wired to anything (so every
// open raised the soft keyboard for a dead input), the body was wider than the
// dialog so it panned sideways, and no interactive rule declared a min-height.
//
// Assertions read the REAL cascade through getComputedStyle — jsdom resolves
// the stylesheet the pack injects. Reading `el.style` instead would be vacuous:
// none of these declarations are inline, so such a check passes against the bug.

import { beforeEach, describe, expect, it } from "vitest";
import { openPicker } from "../../src/index.ts";
import { app } from "./__mocks__/app.js";

const NODES = [{ title: "sampler", type: "KSampler", widgets: [{ name: "seed", value: 1 }] }];

beforeEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
  app.__reset(NODES);
});

const widget = (value = "ComfyUI") => ({ name: "filename_prefix", value });

function openDialog() {
  openPicker(widget(), null);
  const dialog = document.querySelector(".cmp-dialog");
  expect(dialog, "the shell dialog should be on screen").not.toBeNull();
  return dialog;
}

/** px value of a computed length, or 0 when unset/auto. */
const px = (el, prop) => Number.parseFloat(getComputedStyle(el)[prop]) || 0;

describe("the primary action is always reachable", () => {
  it("puts Apply and Cancel in the shell footer, not the scrolling body", () => {
    // The blocker. Inside .cmp-body, Apply scrolls out of view — and it sat
    // below a 44vh inner list, so on a phone in landscape the prefix input,
    // preview, tabs AND Apply were off-screen simultaneously.
    const dialog = openDialog();
    const footer = dialog.querySelector(".cmp-footer");
    const body = dialog.querySelector(".cmp-body");

    const labels = (root) => [...root.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels(footer)).toEqual(expect.arrayContaining(["Apply", "Cancel"]));
    expect(labels(body)).not.toEqual(expect.arrayContaining(["Apply"]));
  });

  it("has exactly one scroll region, and it is the shell's", () => {
    // A nested scroller inside .cmp-body competes for the same drag gesture.
    const dialog = openDialog();
    const scrollers = [dialog, ...dialog.querySelectorAll("*")]
      .filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY))
      .map((el) => el.className);
    expect(scrollers).toEqual(["cmp-body"]);
  });
});

describe("the soft keyboard is not raised for a dead input", () => {
  it("hides the shell's search row, so nothing auto-focuses on open", () => {
    // The pack builds its own filter input inside the Build panel and never
    // touches modal.searchEl — but the shell rAF-focuses that box on open
    // whenever showSearch !== false, so every open raised the keyboard to
    // filter nothing.
    //
    // showSearch:false hides the row rather than omitting the element, and a
    // display:none input cannot take focus — that is the mechanism, so assert
    // it rather than the element's absence.
    const dialog = openDialog();
    const row = dialog.querySelector(".cmp-searchrow");
    expect(row).not.toBeNull();
    expect(row.style.display).toBe("none");
  });
});

describe("the body fits the dialog", () => {
  it("declares no min-width on the body wrapper", () => {
    // .cfp-wrap demanded min(96vw,520px) = 374px on a 390px phone, while the
    // shell dialog offers min(960px, 100vw - 24px) minus 8px of body padding
    // either side = 350px. A `visible` axis paired with a non-visible one
    // computes to `auto`, so overflow-x silently became a scroller and the
    // body panned sideways.
    //
    // Asserted against the CSS SOURCE, not getComputedStyle: jsdom cannot
    // resolve `min(96vw, 520px)` and reports 0 either way, so the computed-style
    // version of this test passes against the bug. Same reason sampler-info
    // gates its scroll contract on the stylesheet text.
    openDialog();
    const css = [...document.head.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const wrapRule = css.match(/\.cfp-wrap\s*\{[^}]*\}/)?.[0] ?? "";
    expect(wrapRule, ".cfp-wrap rule should be present").not.toBe("");
    expect(wrapRule).not.toMatch(/min-width/);
  });

  // NOT asserted here: that the pack passes the shell's `width` option to widen
  // the DIALOG instead (it does — "min(560px, calc(100vw - 24px))"). jsdom's CSS
  // parser silently drops any value containing min()/calc(), so dialog.style.width
  // reads "" whether or not the option was passed. A test on it would report the
  // harness, not the code. Verified by hand against the kit's `if (opts.width)`
  // assignment; the browser tier is where a width assertion belongs.
});

describe("touch targets", () => {
  const INTERACTIVE = [".cfp-input", ".cfp-tab", ".cfp-item", ".cfp-btn"];

  it.each(INTERACTIVE)("%s declares min-height >= 44px", (sel) => {
    // The pack declared no min-height anywhere, so every control landed at
    // ~40px from padding + line-height alone. touch-numeric proves 44 is
    // achievable in this family.
    const dialog = openDialog();
    const el = dialog.querySelector(sel);
    expect(el, `${sel} should exist in the open dialog`).not.toBeNull();
    expect(px(el, "minHeight")).toBeGreaterThanOrEqual(44);
  });
});

describe("controls are well-formed for assistive tech", () => {
  it("nests no button inside another button", async () => {
    // The preset delete ✕ was a DOM child of the preset row button. AT does not
    // expose a nested button as an actionable control, so a screen-reader or
    // switch user could not delete a preset at all.
    //
    // renderPresets() is async (it awaits the settings store), so the click
    // alone leaves the panel empty — without this flush the assertion runs
    // against zero preset rows and passes vacuously.
    const dialog = openDialog();
    dialog.querySelectorAll('[role="tab"], .cfp-tab')[1].click();
    await new Promise((r) => setTimeout(r, 0));

    expect(dialog.querySelectorAll(".cfp-item").length).toBeGreaterThan(0);
    expect([...dialog.querySelectorAll("button button")]).toEqual([]);
  });

  it("gives every button an explicit type", () => {
    // The el() helper set no type, so these defaulted to submit. Inert today
    // (no <form> in the dialog), but a latent trap.
    const dialog = openDialog();
    const untyped = [...dialog.querySelectorAll(".cfp-wrap button, .cmp-footer button")].filter(
      (b) => b.getAttribute("type") !== "button",
    );
    expect(untyped.map((b) => b.textContent)).toEqual([]);
  });

  it("completes the tab pattern rather than half-applying it", () => {
    // aria-selected was set on plain <button>s with no role="tab", so it was
    // announced to nobody and served only as a CSS selector. Half-applied ARIA
    // is worse than none.
    const dialog = openDialog();
    const tablist = dialog.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(["Build", "Presets"]);
    expect(tabs.filter((t) => t.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(dialog.querySelector('[role="tabpanel"]')).not.toBeNull();
  });
});
