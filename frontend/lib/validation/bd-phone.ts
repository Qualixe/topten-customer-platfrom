// Bangladeshi mobile prefixes currently in use: 013 (Grameenphone), 014
// (Banglalink), 015 (Teletalk), 016 (Airtel/Robi), 017 (Grameenphone), 018
// (Robi). Local format only (leading 0, 11 digits total) — the +880 shown
// next to the input is decorative, not part of the value.
const BD_MOBILE_PATTERN = /^01[3-8]\d{8}$/;

/**
 * Client-side validation only speeds up feedback — the FastAPI backend
 * (see app.common.phone.normalize_phone) re-validates independently and is
 * the actual source of truth.
 */
export function validateBdPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Phone number is required.";

  if (!BD_MOBILE_PATTERN.test(trimmed)) {
    return "Enter a valid Bangladeshi mobile number starting with 013/014/015/016/017/018, e.g. 01712345678.";
  }

  return null;
}
