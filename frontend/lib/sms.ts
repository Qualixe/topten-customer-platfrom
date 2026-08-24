/**
 * Pure SMS calculation utilities: encoding detection (GSM-7 vs UCS-2),
 * character counting, and segment/cost math. No React, no I/O — safe to
 * unit test and to call from both server and client code.
 */

export type SmsEncoding = "GSM-7" | "UCS-2";

export interface SmsAnalysis {
  /** Which character set the message must be encoded with. */
  encoding: SmsEncoding;
  /** Total character count, in the units that count against the SMS budget. */
  characterCount: number;
  /** Number of SMS segments required to send this message. */
  segmentCount: number;
  /** Capacity of a single segment for this message's encoding/segment count. */
  charactersPerSegment: number;
  /** Characters still free in the final segment before another segment is needed. */
  remainingCharacters: number;
}

// GSM 03.38 default (basic) alphabet, laid out one row per 16 code points
// (0x00-0x7F) to make it easy to audit against the spec. Position 0x1B
// (the extension-table escape) is intentionally omitted — it is not itself
// an encodable character.
const GSM_7_BASIC_ROWS = [
  "@£$¥èéùìòÇ\nØø\rÅå",
  "Δ_ΦΓΛΩΠΨΣΘΞÆæßÉ",
  " !\"#¤%&'()*+,-./",
  "0123456789:;<=>?",
  "¡ABCDEFGHIJKLMNO",
  "PQRSTUVWXYZÄÖÑÜ§",
  "¿abcdefghijklmno",
  "pqrstuvwxyzäöñüà",
] as const;

// GSM 03.38 extension table. Each of these is reached via an escape
// sequence, so it consumes 2 GSM-7 units instead of 1.
const GSM_7_EXTENDED_CHARS = "\f^{}\\[~]|€";

const GSM_7_BASIC_SET = new Set(GSM_7_BASIC_ROWS.join(""));
const GSM_7_EXTENDED_SET = new Set(GSM_7_EXTENDED_CHARS);

const GSM_7_SINGLE_LIMIT = 160;
const GSM_7_MULTIPART_LIMIT = 153;
const UCS_2_SINGLE_LIMIT = 70;
const UCS_2_MULTIPART_LIMIT = 67;

function isGsm7CodePoint(codePoint: string): boolean {
  return GSM_7_BASIC_SET.has(codePoint) || GSM_7_EXTENDED_SET.has(codePoint);
}

function gsm7UnitCost(codePoint: string): number {
  return GSM_7_EXTENDED_SET.has(codePoint) ? 2 : 1;
}

function buildAnalysis(
  encoding: SmsEncoding,
  characterCount: number,
  singleLimit: number,
  multipartLimit: number
): SmsAnalysis {
  if (characterCount === 0) {
    return {
      encoding,
      characterCount: 0,
      segmentCount: 0,
      charactersPerSegment: singleLimit,
      remainingCharacters: singleLimit,
    };
  }

  if (characterCount <= singleLimit) {
    return {
      encoding,
      characterCount,
      segmentCount: 1,
      charactersPerSegment: singleLimit,
      remainingCharacters: singleLimit - characterCount,
    };
  }

  const segmentCount = Math.ceil(characterCount / multipartLimit);
  const usedInLastSegment = characterCount % multipartLimit;
  const remainingCharacters =
    usedInLastSegment === 0 ? 0 : multipartLimit - usedInLastSegment;

  return {
    encoding,
    characterCount,
    segmentCount,
    charactersPerSegment: multipartLimit,
    remainingCharacters,
  };
}

/**
 * Analyzes an SMS message body: detects whether it fits the GSM-7 alphabet
 * or requires UCS-2, and computes character count, segment count, and
 * remaining capacity using the real SMS rules:
 *
 * - GSM-7: 160 characters for a single SMS, 153 per segment once multipart.
 *   Extended GSM-7 characters (`{ } [ ] ~ ^ | €` and form feed) cost 2 units
 *   each, since they're sent as an escape sequence.
 * - UCS-2: 70 characters for a single SMS, 67 per segment once multipart.
 *
 * Iterates by Unicode code point (`Array.from`, not `.length`/index access)
 * so a surrogate-pair character (almost all emoji) is classified as one
 * code point rather than being split into two lone surrogates — that
 * distinction is what decides GSM-7 vs UCS-2 correctly. Once a message is
 * classified as UCS-2, though, its length is counted in UTF-16 code units
 * (`text.length`), not code points: that matches how SMS actually transports
 * UCS-2 text and how providers bill for it — a code point outside the Basic
 * Multilingual Plane still occupies two 16-bit units on the wire, so it
 * correctly consumes 2 of the 70/67-character budget, not 1.
 */
export function analyzeSmsMessage(text: string): SmsAnalysis {
  const codePoints = Array.from(text);
  const isGsm7 = codePoints.every(isGsm7CodePoint);

  if (isGsm7) {
    const characterCount = codePoints.reduce(
      (total, codePoint) => total + gsm7UnitCost(codePoint),
      0
    );
    return buildAnalysis(
      "GSM-7",
      characterCount,
      GSM_7_SINGLE_LIMIT,
      GSM_7_MULTIPART_LIMIT
    );
  }

  return buildAnalysis(
    "UCS-2",
    text.length,
    UCS_2_SINGLE_LIMIT,
    UCS_2_MULTIPART_LIMIT
  );
}

/**
 * Estimates the total cost of sending an SMS campaign, rounded to the
 * nearest currency subunit (2 decimal places) to avoid floating-point
 * artifacts (e.g. `0.1 + 0.2`) in a price.
 */
export function estimateSmsCost(
  segments: number,
  recipients: number,
  ratePerSegment: number
): number {
  const rawCost = segments * recipients * ratePerSegment;
  return Math.round(rawCost * 100) / 100;
}
