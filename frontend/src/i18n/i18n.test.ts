import { describe, expect, it } from "vitest";

import seed from "@/i18n/seed.json";
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

describe("financing copy that ships with the code (spec 2.5: an estimate is never a lender decision)", () => {
  const FORBIDDEN: Record<string, RegExp> = {
    en: /(approv|guarante|pre-?qualif|offer|your rate)/i,
    it: /(approv|garan|offert|il tuo tasso|i tuoi tassi|finanziamento sicuro|esito sicuro)/i,
    es: /(aprob|aprueb|garant|oferta|tus? (tasas?|tipos?)|financiación segura)/i,
  };
  // The one sentence the spec itself mandates contains "offer".
  const MANDATED = { en: "Not a credit offer.", it: "Non è un'offerta di credito.", es: "No es una oferta de crédito." } as Record<string, string>;
  const financeKeys = Object.keys(SOURCE_TEXT).filter((key) => /^(finance|listing\.finance)\./.test(key));

  it.each(["en", "it", "es"])("has no promissory wording in %s", (locale) => {
    const texts = locale === "en" ? SOURCE_TEXT : (seed as Record<string, Record<string, string>>)[locale];
    for (const key of financeKeys) {
      const text = (texts[key] ?? "").replace(MANDATED[locale], "");
      expect(FORBIDDEN[locale].test(text), `${locale} ${key}: ${text}`).toBe(false);
    }
  });
});
