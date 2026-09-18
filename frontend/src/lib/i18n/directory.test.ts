import { describe, expect, it } from "vitest";

import {
  DIRECTORY_MESSAGES,
  SUPPORTED_LOCALES,
  resolveLocale,
  t,
} from "@/lib/i18n/directory";

describe("directory messages", () => {
  it("defines every key in all three supported languages", () => {
    for (const [key, translations] of Object.entries(DIRECTORY_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(translations[locale], `${key}.${locale}`).toBeTruthy();
      }
    }
  });

  it("includes the two keys spec 37 names for this feature", () => {
    expect(DIRECTORY_MESSAGES["nav.services_professionals"]).toBeDefined();
    expect(DIRECTORY_MESSAGES["directory.services_professionals.title"]).toBeDefined();
  });

  it("uses the exact H1 fixed by spec 1", () => {
    expect(t("en", "directory.services_professionals.title")).toBe(
      "Nautical Services & Professionals",
    );
  });

  it("resolves and defaults locales the same way the API does", () => {
    expect(resolveLocale("it")).toBe("it");
    expect(resolveLocale("IT")).toBe("it");
    expect(resolveLocale("de")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
});
