const ALLOWED_SEPARATORS = new Set([" ", "'", "-"]);

/**
 * Client-side validation only speeds up feedback — the FastAPI backend
 * (see app.common.names.validate_person_name) re-validates independently
 * and is the actual source of truth.
 *
 * Returns a short, specific error message if `value` isn't a plausible
 * person's name, or `null` if it's fine. Unicode-aware (`\p{L}`) rather
 * than an ASCII [A-Za-z] pattern, since customer names are frequently in
 * Bengali script.
 */
export function validatePersonName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Required.";

  const chars = [...trimmed];
  if (chars.some((ch) => /\d/.test(ch))) return "Numbers aren't allowed.";
  if (!chars.every((ch) => /\p{L}/u.test(ch) || ALLOWED_SEPARATORS.has(ch))) {
    return "Letters only.";
  }

  const letters = chars.filter((ch) => /\p{L}/u.test(ch)).map((ch) => ch.toLowerCase());
  if (letters.length >= 2 && new Set(letters).size === 1) return "Enter a valid name.";

  return null;
}
