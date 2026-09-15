const ALLOWED_SEPARATORS = new Set([" ", "'", "-"]);

/**
 * Client-side validation only speeds up feedback — the FastAPI backend
 * (see app.common.names.validate_person_name) re-validates independently
 * and is the actual source of truth.
 *
 * Returns an error message if `value` isn't a plausible person's name, or
 * `null` if it's fine. Unicode-aware (`\p{L}`) rather than an ASCII
 * [A-Za-z] pattern, since customer names are frequently in Bengali script.
 */
export function validatePersonName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Name is required.";

  const letters = [...trimmed].filter((ch) => /\p{L}/u.test(ch));
  const hasOnlyAllowedChars = [...trimmed].every(
    (ch) => /\p{L}/u.test(ch) || ALLOWED_SEPARATORS.has(ch)
  );
  if (!hasOnlyAllowedChars) {
    return "Name may only contain letters, spaces, hyphens, and apostrophes.";
  }

  const distinctLetters = new Set(letters.map((ch) => ch.toLowerCase()));
  if (distinctLetters.size === 1) {
    return "Name cannot be a single character repeated.";
  }

  return null;
}
