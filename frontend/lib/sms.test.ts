import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { analyzeSmsMessage, estimateSmsCost } from "./sms.ts";

describe("analyzeSmsMessage", () => {
  describe("GSM-7 detection and counting", () => {
    it("classifies plain ASCII text as GSM-7", () => {
      const result = analyzeSmsMessage("Hello, world!");
      assert.equal(result.encoding, "GSM-7");
      assert.equal(result.characterCount, 13);
    });

    it("classifies GSM-7 basic-set characters (accents, currency) as GSM-7", () => {
      const result = analyzeSmsMessage("Café à £5 pòùr Åsa");
      assert.equal(result.encoding, "GSM-7");
    });

    it("counts each basic GSM-7 character as 1 unit", () => {
      const result = analyzeSmsMessage("abcde");
      assert.equal(result.characterCount, 5);
    });

    it("counts extended GSM-7 characters ({ } [ ] ~ ^ | €) as 2 units each", () => {
      const extendedChars = "{}[]~^|€";
      const result = analyzeSmsMessage(extendedChars);
      assert.equal(result.encoding, "GSM-7");
      // 8 characters, each costing 2 units.
      assert.equal(result.characterCount, 16);
    });

    it("counts a mix of basic and extended characters correctly", () => {
      // 3 basic (1 unit each) + 1 extended (2 units) = 5 units.
      const result = analyzeSmsMessage("ab{c");
      assert.equal(result.encoding, "GSM-7");
      assert.equal(result.characterCount, 5);
    });

    it("treats an empty string as zero characters and zero segments", () => {
      const result = analyzeSmsMessage("");
      assert.equal(result.encoding, "GSM-7");
      assert.equal(result.characterCount, 0);
      assert.equal(result.segmentCount, 0);
      assert.equal(result.remainingCharacters, 160);
    });
  });

  describe("GSM-7 segment math", () => {
    it("fits exactly 160 characters in a single segment", () => {
      const result = analyzeSmsMessage("a".repeat(160));
      assert.equal(result.segmentCount, 1);
      assert.equal(result.charactersPerSegment, 160);
      assert.equal(result.remainingCharacters, 0);
    });

    it("requires 2 segments at 161 characters, with 153/segment", () => {
      const result = analyzeSmsMessage("a".repeat(161));
      assert.equal(result.segmentCount, 2);
      assert.equal(result.charactersPerSegment, 153);
      // 161 chars -> 153 in segment 1, 8 in segment 2 -> 145 remaining.
      assert.equal(result.remainingCharacters, 145);
    });

    it("fits exactly 2 full segments at 306 characters (153 * 2)", () => {
      const result = analyzeSmsMessage("a".repeat(306));
      assert.equal(result.segmentCount, 2);
      assert.equal(result.remainingCharacters, 0);
    });

    it("rolls over into a 3rd segment at 307 characters", () => {
      const result = analyzeSmsMessage("a".repeat(307));
      assert.equal(result.segmentCount, 3);
      assert.equal(result.remainingCharacters, 152);
    });

    it("reports 159 remaining for a single 1-character message", () => {
      const result = analyzeSmsMessage("a");
      assert.equal(result.segmentCount, 1);
      assert.equal(result.remainingCharacters, 159);
    });
  });

  describe("UCS-2 detection and counting", () => {
    it("classifies text with non-GSM-7 characters (e.g. Chinese) as UCS-2", () => {
      const result = analyzeSmsMessage("你好，世界");
      assert.equal(result.encoding, "UCS-2");
      assert.equal(result.characterCount, 5);
    });

    it("classifies a message with even one non-GSM-7 character as UCS-2", () => {
      const result = analyzeSmsMessage("Hello 👋");
      assert.equal(result.encoding, "UCS-2");
    });
  });

  describe("UCS-2 segment math", () => {
    it("fits exactly 70 characters in a single segment", () => {
      const result = analyzeSmsMessage("你".repeat(70));
      assert.equal(result.encoding, "UCS-2");
      assert.equal(result.segmentCount, 1);
      assert.equal(result.charactersPerSegment, 70);
      assert.equal(result.remainingCharacters, 0);
    });

    it("requires 2 segments at 71 characters, with 67/segment", () => {
      const result = analyzeSmsMessage("你".repeat(71));
      assert.equal(result.segmentCount, 2);
      assert.equal(result.charactersPerSegment, 67);
      // 71 chars -> 67 in segment 1, 4 in segment 2 -> 63 remaining.
      assert.equal(result.remainingCharacters, 63);
    });
  });

  describe("emoji and Unicode code point handling", () => {
    it("does not miscount or crash on a surrogate-pair emoji", () => {
      const result = analyzeSmsMessage("😀");
      assert.equal(result.encoding, "UCS-2");
      // A single emoji code point outside the Basic Multilingual Plane is
      // transmitted as a UTF-16 surrogate pair — 2 code units — which is
      // exactly how real SMS/UCS-2 transport and billing count it.
      assert.equal(result.characterCount, 2);
    });

    it("classifies emoji-only text as GSM-7-incompatible even when short", () => {
      const result = analyzeSmsMessage("😀😃😄");
      assert.equal(result.encoding, "UCS-2");
      assert.equal(result.characterCount, 6);
    });

    it("does not split a multi-code-point emoji's GSM-7 check incorrectly", () => {
      // A lone surrogate half is never itself a valid GSM-7 character, so
      // iterating by code point (not UTF-16 code unit) must still correctly
      // force UCS-2 for any string containing an emoji.
      const withEmoji = analyzeSmsMessage("Order #1024 shipped 📦");
      const withoutEmoji = analyzeSmsMessage("Order #1024 shipped");
      assert.equal(withEmoji.encoding, "UCS-2");
      assert.equal(withoutEmoji.encoding, "GSM-7");
    });
  });
});

describe("estimateSmsCost", () => {
  it("multiplies segments, recipients, and rate", () => {
    assert.equal(estimateSmsCost(1, 100, 0.5), 50);
  });

  it("accounts for multi-segment messages", () => {
    assert.equal(estimateSmsCost(3, 10, 0.45), 13.5);
  });

  it("returns 0 for zero recipients", () => {
    assert.equal(estimateSmsCost(2, 0, 0.5), 0);
  });

  it("rounds to 2 decimal places to avoid floating-point artifacts", () => {
    assert.equal(estimateSmsCost(1, 3, 0.1), 0.3);
  });
});
