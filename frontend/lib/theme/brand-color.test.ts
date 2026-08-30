import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_BRAND_COLOR, buildBrandColorStyle, getContrastForeground } from "./brand-color.ts";

describe("getContrastForeground", () => {
  it("picks white text for a dark/saturated color", () => {
    assert.equal(getContrastForeground("#EF4444"), "#FFFFFF");
  });

  it("picks black text for a light/pale color", () => {
    assert.equal(getContrastForeground("#FDE68A"), "#000000");
  });

  it("picks white for pure black and black for pure white", () => {
    assert.equal(getContrastForeground("#000000"), "#FFFFFF");
    assert.equal(getContrastForeground("#FFFFFF"), "#000000");
  });
});

describe("buildBrandColorStyle", () => {
  it("overrides --primary/--ring and their sidebar counterparts in both light and dark blocks", () => {
    const css = buildBrandColorStyle("#2563EB");
    assert.match(css, /:root\{[^}]*--primary:#2563EB;/);
    assert.match(css, /:root\{[^}]*--ring:#2563EB;/);
    assert.match(css, /:root\{[^}]*--sidebar-primary:#2563EB;/);
    assert.match(css, /:root\{[^}]*--sidebar-ring:#2563EB;/);
    assert.match(css, /\.dark\{[^}]*--primary:#2563EB;/);
  });

  it("falls back to the default color for malformed input rather than throwing", () => {
    assert.doesNotThrow(() => buildBrandColorStyle(undefined as unknown as string));
    const css = buildBrandColorStyle("not-a-color");
    assert.match(css, new RegExp(`--primary:${DEFAULT_BRAND_COLOR};`));
  });
});
