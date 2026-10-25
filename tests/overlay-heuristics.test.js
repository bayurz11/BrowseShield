import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = { globalThis: {} };
vm.runInNewContext(readFileSync(new URL("../src/content/overlay-heuristics.js", import.meta.url), "utf8"), context);
const isOverlay = context.globalThis.__browseShieldOverlayHeuristics.isLikelyOverlay;
const base = {
  position: "fixed", display: "block", visibility: "visible", pointerEvents: "auto",
  width: 1200, height: 800, viewportWidth: 1200, viewportHeight: 800,
  opacity: 1, zIndex: 2147483647, backgroundColor: "rgba(0, 0, 0, 0)", tagName: "DIV", id: ""
};

test("detects a transparent full viewport click-catcher", () => {
  assert.equal(isOverlay(base), true);
});

test("detects the known dontfoid overlay at medium viewport coverage", () => {
  assert.equal(isOverlay({ ...base, width: 700, id: "dontfoid", zIndex: 1 }), true);
});

test("does not classify ordinary visible modal cards as click-catchers", () => {
  assert.equal(isOverlay({ ...base, width: 500, height: 350, backgroundColor: "rgb(255, 255, 255)", zIndex: 20 }), false);
});

test("ignores hidden, non-interactive, and media elements", () => {
  assert.equal(isOverlay({ ...base, display: "none" }), false);
  assert.equal(isOverlay({ ...base, pointerEvents: "none" }), false);
  assert.equal(isOverlay({ ...base, tagName: "VIDEO" }), false);
});
