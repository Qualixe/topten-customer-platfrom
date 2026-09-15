// Bangladeshi mobile prefixes currently in use: 013 (Grameenphone), 014
// (Banglalink), 015 (Teletalk), 016 (Airtel/Robi), 017 (Grameenphone), 018
// (Robi). Local format only (leading 0, 11 digits total) — the +880 shown
// next to the input is decorative, not part of the value.
const BD_MOBILE_PATTERN = /^01[3-8]\d{8}$/;

/**
 * Client-side validation only speeds up feedback — the FastAPI backend
 * (see app.common.phone.normalize_phone) re-validates independently and is
 * the actual source of truth.
 *
 * Returns a short, specific error message pinpointing what's wrong, or
 * `null` if the number is fine.
 */
export function validateBdPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Required.";
  if (!/^\d+$/.test(trimmed)) return "Digits only.";
  if (!trimmed.startsWith("01")) return "Must start with 01.";
  if (trimmed.length !== 11) return "Must be 11 digits.";
  if (!BD_MOBILE_PATTERN.test(trimmed)) return "Invalid prefix — use 013–018.";

  return null;
}
