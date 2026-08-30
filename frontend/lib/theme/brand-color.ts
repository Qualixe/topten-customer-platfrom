const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** Matches the backend's own column default (see
 * app/models/site_settings.py) and the red already used for TopTen's
 * brand accents elsewhere. */
export const DEFAULT_BRAND_COLOR = "#EF4444";

/** Returns black or white — whichever reads clearly on `hex` — via
 * perceptual luminance. Good enough for picking a button/badge text color
 * against an admin-chosen brand accent; not a full WCAG contrast checker.
 * A malformed `hex` (should never happen — validated on save — but this
 * renders on every page, so it must never throw) falls back to white. */
export function getContrastForeground(hex: string): "#000000" | "#FFFFFF" {
  if (!HEX_COLOR_PATTERN.test(hex)) return "#FFFFFF";
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#FFFFFF";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16) || 0,
    g: parseInt(normalized.slice(2, 4), 16) || 0,
    b: parseInt(normalized.slice(4, 6), 16) || 0,
  };
}

/** CSS overriding the app's --primary/--ring tokens (and their sidebar
 * counterparts) with the admin's chosen brand color — everything built on
 * those tokens (buttons, focus rings, the active sidebar nav state) picks
 * it up automatically, in both light and dark mode. Injected once in the
 * root layout so it applies to every page, logged in or not — a malformed
 * `hex` (should never happen — validated on save) falls back to the
 * default rather than injecting garbage into a site-wide `<style>` tag. */
export function buildBrandColorStyle(hex: string): string {
  const safeHex = HEX_COLOR_PATTERN.test(hex) ? hex : DEFAULT_BRAND_COLOR;
  const foreground = getContrastForeground(safeHex);
  const vars =
    `--primary:${safeHex};--ring:${safeHex};` +
    `--sidebar-primary:${safeHex};--sidebar-ring:${safeHex};` +
    `--primary-foreground:${foreground};--sidebar-primary-foreground:${foreground};`;
  return `:root{${vars}}.dark{${vars}}`;
}
