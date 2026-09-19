import { describe, expect, it } from "vitest";

import { INQUIRY_MESSAGES, formatInquiryMessage, tInquiry } from "@/lib/i18n/inquiry";

describe("INQUIRY_MESSAGES", () => {
  it("has all three languages for every key (spec 0, spec 37)", () => {
    for (const [key, translations] of Object.entries(INQUIRY_MESSAGES)) {
      for (const locale of ["en", "it", "es"] as const) {
        expect(translations[locale], `${key}.${locale}`).toBeTruthy();
      }
    }
  });

  it("carries the three keys spec 37 names explicitly", () => {
    expect(INQUIRY_MESSAGES["inquiry.email"]).toBeDefined();
    expect(INQUIRY_MESSAGES["inquiry.send"]).toBeDefined();
    expect(INQUIRY_MESSAGES["inquiry.sent"]).toBeDefined();
  });

  it("falls back to English for a locale with no entry", () => {
    expect(tInquiry("it", "inquiry.send")).toBe(INQUIRY_MESSAGES["inquiry.send"].it);
  });

  it("throws on an unknown key rather than rendering an empty label", () => {
    expect(() => tInquiry("en", "inquiry.nope")).toThrow(/Unknown inquiry message key/);
  });

  it("interpolates named placeholders", () => {
    expect(
      formatInquiryMessage("Question about {context}", { context: "Azimut 43" }),
    ).toBe("Question about Azimut 43");
  });

  it("leaves an unmatched placeholder untouched rather than printing undefined", () => {
    expect(formatInquiryMessage("Hello {name}", {})).toBe("Hello {name}");
  });
});
