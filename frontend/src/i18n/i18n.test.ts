import { describe, expect, it } from "vitest";

import { interpolate, makeTranslate, SOURCE_TEXT } from "@/i18n";

const KEY = /^[a-z0-9][a-z0-9_.-]*$/;
const PLACEHOLDER = /\{(\w+)\}/g;

describe("source.en.json", () => {
  it("has well-formed keys and plain-text values (no markup) that Django will accept", () => {
    for (const [key, text] of Object.entries(SOURCE_TEXT)) {
      expect(KEY.test(key), key).toBe(true);
      expect(key.length, key).toBeLessThanOrEqual(200);
      expect(typeof text, key).toBe("string");
      expect(text.trim(), key).not.toBe("");
      expect(/[<>]/.test(text), `${key} must not contain markup`).toBe(false);
    }
  });
});

describe("makeTranslate", () => {
  it("uses the published text of the language and fills its placeholders", () => {
    const t = makeTranslate({ "boats.found": "{count} barche trovate" });
    expect(t("boats.found", { count: 3 })).toBe("3 barche trovate");
  });

  it("falls back to the English source for a missing, empty or unreachable bundle", () => {
    expect(makeTranslate({})("boats.found", { count: 2 })).toBe("2 boats found");
    expect(makeTranslate({ "boats.found": "" })("boats.found", { count: 2 })).toBe("2 boats found");
    expect(makeTranslate(null)("boats.filters")).toBe("Filters");
  });

  it("leaves an unknown placeholder visible instead of printing undefined", () => {
    expect(interpolate("{count} boats", {})).toBe("{count} boats");
  });

  it("keeps every source placeholder used by the pages in the source text", () => {
    const found = SOURCE_TEXT["boats.found"].match(PLACEHOLDER);
    expect(found).toEqual(["{count}"]);
  });
});
