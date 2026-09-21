import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { allowedTerms, maxPriceForBudget, pickRule, simulate, type FinanceRule } from "@/lib/finance/simulator";

const golden = JSON.parse(readFileSync(join(__dirname, "golden.json"), "utf8")) as {
  rule: Parameters<typeof simulate>[0];
  input: { price: number; down_percent: number; term_years: number };
  expected: Record<string, string>;
}[];

const rule = (over: Partial<FinanceRule>): FinanceRule => ({
  id: 1,
  country_code: "ES",
  product: "LOAN",
  condition: "ANY",
  use: "ANY",
  tin_percent: 6.5,
  tae_percent: 6.7,
  opening_fee_percent: 0,
  residual_percent: 0,
  min_price: 15000,
  max_price: 2000000,
  min_down_percent: 10,
  max_down_percent: 50,
  default_down_percent: 20,
  terms_years: [5, 7, 10, 15],
  max_age_at_end_years: null,
  age_plus_term_limit: null,
  vat_percent: null,
  vat_on_installment: false,
  vat_recoverable: false,
  representative_months: 120,
  note: { en: "", it: "", es: "" },
  ...over,
});

describe("simulator", () => {
  it("agrees with the server on every shared vector", () => {
    for (const { rule: vectorRule, input, expected } of golden) {
      const got = simulate(vectorRule, input) as unknown as Record<string, number>;
      for (const [key, value] of Object.entries(expected)) {
        expect(Math.abs(got[key] - Number(value)), `${key} for ${JSON.stringify(input)}`).toBeLessThanOrEqual(0.011);
      }
    }
  });

  it("picks the most specific rule", () => {
    const rules = [rule({ id: 1 }), rule({ id: 2, condition: "USED" }), rule({ id: 3, condition: "USED", use: "COMPANY" })];
    expect(pickRule(rules, { country: "ES", product: "LOAN", condition: "USED", use: "PRIVATE" })?.id).toBe(2);
    expect(pickRule(rules, { country: "ES", product: "LOAN", condition: "USED", use: "COMPANY" })?.id).toBe(3);
    expect(pickRule(rules, { country: "ES", product: "LOAN", condition: "NEW", use: "PRIVATE" })?.id).toBe(1);
    expect(pickRule(rules, { country: "IT", product: "LOAN", condition: "NEW", use: "PRIVATE" })).toBeNull();
  });

  it("shortens the term as the boat gets older (age + term at most 35)", () => {
    const used = rule({ age_plus_term_limit: 35 });
    expect(allowedTerms(used, 0)).toEqual([5, 7, 10, 15]);
    expect(allowedTerms(used, 20)).toEqual([5, 7, 10, 15]);
    expect(allowedTerms(used, 26)).toEqual([5, 7]);
    expect(allowedTerms(used, 33)).toEqual([]);
  });

  it("turns a monthly budget back into the price it carries", () => {
    const price = maxPriceForBudget(rule({}), 1635.09, 20, 10);
    expect(Math.abs(price - 180000)).toBeLessThan(5);
  });
});
