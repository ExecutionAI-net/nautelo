// The financing simulator's arithmetic. Same formulas as backend/finance/simulator.py; both are checked against golden.json.

export type Product = "LOAN" | "LEASING";
export type Condition = "NEW" | "USED";
export type Use = "PRIVATE" | "COMPANY";

export interface FinanceRule {
  id: number;
  country_code: string;
  product: Product;
  condition: Condition | "ANY";
  use: Use | "ANY";
  tin_percent: number;
  tae_percent: number | null;
  opening_fee_percent: number;
  residual_percent: number;
  min_price: number;
  max_price: number;
  min_down_percent: number;
  max_down_percent: number;
  default_down_percent: number;
  terms_years: number[];
  max_age_at_end_years: number | null;
  age_plus_term_limit: number | null;
  vat_percent: number | null;
  vat_on_installment: boolean;
  vat_recoverable: boolean;
  representative_months: number;
  note: { en: string; it: string; es: string };
}

export interface Simulation {
  down_payment: number;
  financed: number;
  monthly: number;
  monthly_with_vat: number;
  vat_per_month: number;
  residual: number;
  opening_fee: number;
  total_repaid: number;
  cost_of_financing: number;
}

type RuleMath = Pick<FinanceRule, "product" | "tin_percent" | "opening_fee_percent" | "residual_percent" | "vat_percent" | "vat_on_installment">;

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function annuityFactor(monthlyRate: number, months: number): number {
  return monthlyRate === 0 ? 1 / months : monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
}

function vatRate(rule: RuleMath): number {
  return rule.vat_on_installment && rule.vat_percent != null ? rule.vat_percent / 100 : 0;
}

/** Monthly payment (with VAT where it applies) for a price of `price`, before cent rounding. */
function monthlyExact(rule: RuleMath, price: number, downPercent: number, termYears: number): { monthly: number; residual: number } {
  const months = termYears * 12;
  const financed = price - (price * downPercent) / 100;
  const monthlyRate = rule.tin_percent / 100 / 12;
  const residual = rule.product === "LEASING" ? (price * (rule.residual_percent || 0)) / 100 : 0;
  // A leasing purchase option is paid at the end, so the instalments only repay what is left today.
  const monthly = (financed - residual / Math.pow(1 + monthlyRate, months)) * annuityFactor(monthlyRate, months);
  return { monthly, residual };
}

export function simulate(rule: RuleMath, input: { price: number; down_percent: number; term_years: number }): Simulation {
  const months = input.term_years * 12;
  const down = (input.price * input.down_percent) / 100;
  const financed = input.price - down;
  const { monthly, residual } = monthlyExact(rule, input.price, input.down_percent, input.term_years);
  const vat = vatRate(rule);
  const monthlyWithVat = monthly * (1 + vat);
  const openingFee = (financed * (rule.opening_fee_percent || 0)) / 100;
  const totalRepaid = monthlyWithVat * months + residual * (1 + vat) + openingFee;
  return {
    down_payment: cents(down),
    financed: cents(financed),
    monthly: cents(monthly),
    monthly_with_vat: cents(monthlyWithVat),
    vat_per_month: cents(monthlyWithVat - monthly),
    residual: cents(residual * (1 + vat)),
    opening_fee: cents(openingFee),
    total_repaid: cents(totalRepaid),
    cost_of_financing: cents(totalRepaid - financed),
  };
}

/** The most specific active rule: an exact condition/use beats "any". */
export function pickRule(
  rules: FinanceRule[],
  choice: { country: string; product: Product; condition: Condition; use: Use },
): FinanceRule | null {
  let best: FinanceRule | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    if (rule.country_code !== choice.country || rule.product !== choice.product) continue;
    if (rule.condition !== "ANY" && rule.condition !== choice.condition) continue;
    if (rule.use !== "ANY" && rule.use !== choice.use) continue;
    const score = (rule.condition === choice.condition ? 2 : 0) + (rule.use === choice.use ? 1 : 0);
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}

/** Terms the rule offers that a boat of this age may take (new boats have age 0). */
export function allowedTerms(rule: FinanceRule, boatAge: number): number[] {
  return rule.terms_years.filter((term) => {
    if (rule.age_plus_term_limit != null && boatAge + term > rule.age_plus_term_limit) return false;
    if (rule.max_age_at_end_years != null && boatAge + term > rule.max_age_at_end_years) return false;
    return true;
  });
}

/** The payment is linear in the price, so a monthly budget maps straight to the largest price it can carry. */
export function maxPriceForBudget(rule: RuleMath, monthlyBudget: number, downPercent: number, termYears: number): number {
  const perEuro = monthlyExact(rule, 1, downPercent, termYears).monthly * (1 + vatRate(rule));
  return perEuro > 0 ? monthlyBudget / perEuro : 0;
}
