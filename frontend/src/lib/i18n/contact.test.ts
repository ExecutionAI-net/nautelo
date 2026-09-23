import { describe, expect, it } from "vitest";

import { CONTACT_MESSAGES, tContact } from "@/lib/i18n/contact";
import { SUPPORTED_LOCALES } from "@/lib/i18n/directory";

describe("CONTACT_MESSAGES", () => {
  it("has every one of the three languages for every key (spec 37)", () => {
    for (const [key, translations] of Object.entries(CONTACT_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(translations[locale], `${key}.${locale}`).toBeTruthy();
      }
    }
  });

  it("carries spec 37's two required contact keys", () => {
    expect(CONTACT_MESSAGES["contact.locked_explanation"]).toBeDefined();
    expect(CONTACT_MESSAGES["contact.unlocked"]).toBeDefined();
  });

  it("uses spec 16's locked explanation copy verbatim in English", () => {
    expect(tContact("en", "contact.locked_explanation")).toBe(
      "Send a message through Nautelo to unlock business contact details.",
    );
  });

  it("throws on an unknown key rather than rendering it raw", () => {
    expect(() => tContact("en", "contact.nope")).toThrow();
  });
});
