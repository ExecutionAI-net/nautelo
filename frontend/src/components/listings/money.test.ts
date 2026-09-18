import { describe, expect, it } from "vitest";

import {
  SUPPORTED_CURRENCIES,
  isFinanceablePrice,
  isSupportedCurrency,
  safeMoney,
} from "@/components/listings/money";
import type { Locale } from "@/lib/i18n/directory";

const norm = (value: string) => value.replace(/[  ]/g, " ");

// Anything a card or a quote panel could be handed that formatMoney (or Intl)
// answers with a RangeError. A thrown RangeError inside a React render unmounts
// the whole subtree, so every one of these must come back as null instead.
const HOSTILE_AMOUNTS: unknown[] = [
  "abc",
  "1e5",
  "",
  " ",
  "1,000.00",
  "459 000.00",
  "€459000.00",
  "NaN",
  "Infinity",
  "0x10",
  "12.",
  ".5",
  "--1",
  null,
  undefined,
  123,
  {},
  [],
  Number.NaN,
];

const HOSTILE_CURRENCIES: unknown[] = ["eu", "€", "", " ", "EURO", "E1R", "1", null, undefined, {}];

describe("isSupportedCurrency", () => {
  it("accepts the platform's one currency, in any case", () => {
    expect(SUPPORTED_CURRENCIES).toEqual(["EUR"]);
    expect(isSupportedCurrency("EUR")).toBe(true);
    expect(isSupportedCurrency("eur")).toBe(true);
  });

  it("rejects every other code, formattable or not", () => {
    for (const code of ["USD", "GBP", "CHF", "JPY", ...(HOSTILE_CURRENCIES as string[])]) {
      expect(isSupportedCurrency(code as string), String(code)).toBe(false);
    }
  });
});

describe("safeMoney", () => {
  it.each(["en", "it", "es"] as const)("formats a good decimal string in %s", (locale) => {
    const formatted = safeMoney(locale, "459000.00", "EUR");
    expect(formatted).not.toBeNull();
    expect(norm(formatted!)).toBe(
      locale === "en" ? "€459,000.00" : "459.000,00 €",
    );
  });

  it("returns null for every hostile amount instead of throwing", () => {
    for (const amount of HOSTILE_AMOUNTS) {
      expect(() => safeMoney("en", amount as string, "EUR"), String(amount)).not.toThrow();
      expect(safeMoney("en", amount as string, "EUR"), String(amount)).toBeNull();
    }
  });

  it("returns null for every hostile currency instead of throwing", () => {
    for (const currency of HOSTILE_CURRENCIES) {
      expect(
        () => safeMoney("en", "459000.00", currency as string),
        String(currency),
      ).not.toThrow();
      expect(safeMoney("en", "459000.00", currency as string), String(currency)).toBeNull();
    }
  });

  // safeMoney is the formatting guard, not the eligibility rule: a currency the
  // platform does not sell in still formats, and isFinanceablePrice is what
  // keeps the finance column off that card (spec 18.2).
  it("formats any valid ISO currency, supported or not", () => {
    expect(safeMoney("en", "100.00", "USD")).not.toBeNull();
  });

  it("never invents a value for a locale it was not given", () => {
    const locales: Locale[] = ["en", "it", "es"];
    for (const locale of locales) {
      expect(safeMoney(locale, "1.00", "EUR")).not.toBeNull();
    }
  });
});

describe("isFinanceablePrice", () => {
  it("accepts a positive decimal price in the supported currency", () => {
    expect(isFinanceablePrice({ amount: "459000.00", currency: "EUR" })).toBe(true);
    expect(isFinanceablePrice({ amount: "1", currency: "eur" })).toBe(true);
  });

  it("rejects a price that is not a plain decimal string", () => {
    for (const amount of HOSTILE_AMOUNTS) {
      expect(
        isFinanceablePrice({ amount: amount as string, currency: "EUR" }),
        String(amount),
      ).toBe(false);
    }
  });

  it("rejects zero and negative prices", () => {
    for (const amount of ["0", "0.00", "-1.00", "-0.01"]) {
      expect(isFinanceablePrice({ amount, currency: "EUR" }), amount).toBe(false);
    }
  });

  it("rejects an unsupported currency even when the amount is fine", () => {
    expect(isFinanceablePrice({ amount: "459000.00", currency: "USD" })).toBe(false);
    expect(isFinanceablePrice({ amount: "459000.00", currency: "EURO" })).toBe(false);
  });

  it("rejects a missing price object instead of throwing", () => {
    expect(() => isFinanceablePrice(undefined)).not.toThrow();
    expect(isFinanceablePrice(undefined)).toBe(false);
    expect(isFinanceablePrice(null)).toBe(false);
    expect(isFinanceablePrice({} as { amount: string; currency: string })).toBe(false);
  });
});
