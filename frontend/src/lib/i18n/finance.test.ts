import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/directory";
import { FINANCE_MESSAGES, formatCount, formatMoney, tf } from "@/lib/i18n/finance";

// ICU puts a no-break space (U+00A0) between the amount and the euro sign in
// it-IT / es-ES. Asserted exactly; the output is never post-processed.
const NBSP = " ";

describe("FINANCE_MESSAGES", () => {
  it("is not empty", () => {
    expect(Object.keys(FINANCE_MESSAGES).length).toBeGreaterThan(30);
  });

  it("has exactly the supported locales, non-empty, for every key", () => {
    for (const [key, translations] of Object.entries(FINANCE_MESSAGES)) {
      expect(Object.keys(translations).sort(), key).toEqual([...SUPPORTED_LOCALES].sort());
      for (const locale of SUPPORTED_LOCALES) {
        const value = translations[locale];
        expect(typeof value, `${key}.${locale}`).toBe("string");
        expect(value.trim(), `${key}.${locale}`).not.toBe("");
      }
    }
  });

  it("uses the same {placeholders} in every locale of a key", () => {
    const names = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const [key, translations] of Object.entries(FINANCE_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(names(translations[locale]), `${key}.${locale}`).toEqual(names(translations.en));
      }
    }
  });

  it("carries the spec 37 keys this phase is responsible for", () => {
    for (const key of [
      "finance.estimated_payment",
      "finance.calculate",
      "finance.illustrative_disclaimer",
      "listing.views",
      "listing.finance_toggle",
    ]) {
      expect(FINANCE_MESSAGES[key], key).toBeDefined();
    }
  });

  it("fixes the spec-mandated English labels", () => {
    expect(FINANCE_MESSAGES["finance.estimated_payment"].en).toBe("Estimated payment");
    expect(FINANCE_MESSAGES["finance.calculate"].en).toBe("Calculate your financing");
    expect(FINANCE_MESSAGES["listing.finance_group_title"].en).toBe("Financing estimate");
  });

  it("never presents the estimate as a lender decision (spec 2.5), in any locale", () => {
    const forbidden = /\b(approved|pre-approved|guaranteed|offer|your rate)\b/i;
    const forbiddenIt = /\b(approvat[oaie]|preapprovat[oaie]|garantit[oaie]|offerta)\b/i;
    const forbiddenEs = /\b(aprobad[oa]s?|preaprobad[oa]s?|garantizad[oa]s?|oferta)\b/i;
    for (const [key, translations] of Object.entries(FINANCE_MESSAGES)) {
      expect(forbidden.test(translations.en), `${key}.en`).toBe(false);
      expect(forbiddenIt.test(translations.it), `${key}.it`).toBe(false);
      expect(forbiddenEs.test(translations.es), `${key}.es`).toBe(false);
    }
  });

  it("states in every locale that the estimate is not a credit application or bank commitment", () => {
    const d = FINANCE_MESSAGES["finance.illustrative_disclaimer"];
    expect(d.en).toMatch(/not a credit application/);
    expect(d.it).toMatch(/Non è una richiesta di credito/);
    expect(d.es).toMatch(/No es una solicitud de crédito/);
  });
});

describe("tf", () => {
  it("throws on an unknown key rather than rendering it", () => {
    expect(() => tf("en", "finance.nope")).toThrow(/finance.nope/);
    expect(() => tf("it", "")).toThrow();
  });

  it("does not resolve inherited object keys as messages", () => {
    expect(() => tf("en", "toString")).toThrow();
    expect(() => tf("en", "constructor")).toThrow();
    expect(() => tf("en", "__proto__")).toThrow();
  });

  it("substitutes named parameters in each locale", () => {
    expect(tf("en", "finance.months", { count: 48 })).toBe("48 months");
    expect(tf("it", "finance.months", { count: 48 })).toBe("48 mesi");
    expect(tf("es", "finance.months", { count: 48 })).toBe("48 meses");
  });

  it("substitutes string params and zero", () => {
    expect(tf("en", "finance.months", { count: 0 })).toBe("0 months");
    expect(tf("en", "finance.months", { count: "12" })).toBe("12 months");
  });

  it("returns the message unchanged when it has no placeholders, ignoring extra params", () => {
    expect(tf("en", "finance.calculate")).toBe("Calculate your financing");
    expect(tf("en", "finance.calculate", { count: 3, other: "x" })).toBe(
      "Calculate your financing",
    );
    expect(tf("en", "finance.months", { count: 3, extra: "x" })).toBe("3 months");
  });

  it("leaves a placeholder visible when its param is missing", () => {
    expect(tf("en", "finance.months")).toBe("{count} months");
    expect(tf("en", "finance.months", {})).toBe("{count} months");
    expect(tf("en", "finance.months", { other: 1 })).toBe("{count} months");
  });

  it("does not treat param values as patterns or re-substitute them", () => {
    expect(tf("en", "finance.months", { count: "$&" })).toBe("$& months");
    expect(tf("en", "finance.months", { count: "$1$$" })).toBe("$1$$ months");
    expect(tf("en", "finance.months", { count: "a.*b(c)[d]" })).toBe("a.*b(c)[d] months");
    expect(tf("en", "finance.months", { count: "{count}" })).toBe("{count} months");
    expect(tf("en", "finance.months", { count: "{x}}" })).toBe("{x}} months");
  });

  it("never expands a placeholder that appears inside another param's value", () => {
    FINANCE_MESSAGES["test.two"] = { en: "{a} / {b}", it: "{a} / {b}", es: "{a} / {b}" };
    try {
      expect(tf("en", "test.two", { a: "{b}", b: "B" })).toBe("{b} / B");
      expect(tf("en", "test.two", { b: "{a}", a: "A" })).toBe("A / {a}");
    } finally {
      delete FINANCE_MESSAGES["test.two"];
    }
  });

  it("ignores param names with regex metacharacters that are not placeholders", () => {
    expect(tf("en", "finance.months", { "c.*": "X", count: 1 })).toBe("1 months");
  });

  it("falls back to the default locale for a locale missing from a message", () => {
    const original = FINANCE_MESSAGES["finance.term"];
    FINANCE_MESSAGES["finance.term"] = { en: "Term" } as Record<Locale, string>;
    try {
      expect(tf("it", "finance.term")).toBe("Term");
      expect(DEFAULT_LOCALE).toBe("en");
    } finally {
      FINANCE_MESSAGES["finance.term"] = original;
    }
  });
});

describe("formatMoney", () => {
  it("formats a decimal string as euro for the interface language", () => {
    expect(formatMoney("en", "8456.36", "EUR")).toBe("€8,456.36");
    expect(formatMoney("it", "8456.36", "EUR")).toBe(`8456,36${NBSP}€`);
    expect(formatMoney("es", "8456.36", "EUR")).toBe(`8456,36${NBSP}€`);
  });

  it("keeps both decimals on a round amount", () => {
    expect(formatMoney("en", "459000.00", "EUR")).toBe("€459,000.00");
    expect(formatMoney("it", "459000.00", "EUR")).toBe(`459.000,00${NBSP}€`);
    expect(formatMoney("es", "459000.00", "EUR")).toBe(`459.000,00${NBSP}€`);
    expect(formatMoney("en", "1234.5", "EUR")).toBe("€1,234.50");
    expect(formatMoney("en", "7", "EUR")).toBe("€7.00");
  });

  it("formats zero and negatives", () => {
    expect(formatMoney("en", "0", "EUR")).toBe("€0.00");
    expect(formatMoney("en", "0.00", "EUR")).toBe("€0.00");
    expect(formatMoney("it", "0.00", "EUR")).toBe(`0,00${NBSP}€`);
    expect(formatMoney("en", "-8456.36", "EUR")).toBe("-€8,456.36");
    expect(formatMoney("es", "-8456.36", "EUR")).toBe(`-8456,36${NBSP}€`);
  });

  it("formats the spec 17.3 ceiling exactly", () => {
    expect(formatMoney("en", "999999999.99", "EUR")).toBe("€999,999,999.99");
    expect(formatMoney("it", "999999999.99", "EUR")).toBe(`999.999.999,99${NBSP}€`);
  });

  it("never routes the decimal string through a float", () => {
    // 2^53 + 1 and a 17-digit cent amount are not representable as doubles.
    expect(formatMoney("en", "9007199254740993.00", "EUR")).toBe("€9,007,199,254,740,993.00");
    expect(formatMoney("en", "12345678901234567.89", "EUR")).toBe("€12,345,678,901,234,567.89");
    expect(formatMoney("es", "12345678901234567.89", "EUR")).toBe(
      `12.345.678.901.234.567,89${NBSP}€`,
    );
  });

  it("uses the currency code it is given", () => {
    expect(formatMoney("en", "1", "USD")).toBe("US$1.00");
  });

  it("accepts a lowercase currency code, formatted like the uppercase one", () => {
    expect(formatMoney("en", "1", "eur")).toBe(formatMoney("en", "1", "EUR"));
  });

  it("rejects a malformed currency code", () => {
    expect(() => formatMoney("en", "1", "EURO")).toThrow(RangeError);
    expect(() => formatMoney("en", "1", "")).toThrow(RangeError);
    expect(() => formatMoney("en", "1", "E1R")).toThrow(RangeError);
  });

  it("rejects amounts that are not plain decimal strings instead of rendering NaN", () => {
    const bad = ["", " ", "abc", "NaN", "Infinity", "1e5", "0x10", "1,234.50", "12.", ".5", "--1", "1 2", "€5"];
    for (const amount of bad) {
      expect(() => formatMoney("en", amount, "EUR"), JSON.stringify(amount)).toThrow(RangeError);
    }
  });
});

describe("formatCount", () => {
  it("groups thousands for the interface language", () => {
    expect(formatCount("en", 12345)).toBe("12,345");
    expect(formatCount("it", 12345)).toBe("12.345");
    expect(formatCount("es", 12345)).toBe("12.345");
  });

  it("formats zero and small numbers", () => {
    expect(formatCount("en", 0)).toBe("0");
    expect(formatCount("en", 999)).toBe("999");
    expect(formatCount("en", 1000000)).toBe("1,000,000");
    expect(formatCount("it", 1000000)).toBe("1.000.000");
  });
});
