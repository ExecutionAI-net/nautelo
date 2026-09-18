// The one place the listing surfaces turn an API money string into display
// text, and the one place they answer spec §18.2's "listing.price is valid AND
// listing.currency is supported".
//
// formatMoney is deliberately strict: it throws a RangeError rather than render
// "NaN" (spec §2.1 — nothing is invented). Inside a React render a RangeError
// unmounts the whole subtree, so a single malformed row would take down a card,
// a quote panel, or a 24-card server-rendered page. Every component therefore
// formats through safeMoney and drops what it cannot render, instead of
// substituting a zero or a placeholder (spec §18.2: no zeroed finance UI).
import type { Locale } from "@/lib/i18n/directory";
import { formatMoney, isDecimalString } from "@/lib/i18n/finance";

/**
 * Mirror of backend `finance/serializers.py: SUPPORTED_CURRENCIES`. The
 * platform sells in euro; a snapshot in any other currency is not financeable,
 * however well Intl formats it.
 */
export const SUPPORTED_CURRENCIES: readonly string[] = ["EUR"];

export function isSupportedCurrency(currency: unknown): boolean {
  return (
    typeof currency === "string" && SUPPORTED_CURRENCIES.includes(currency.trim().toUpperCase())
  );
}

/**
 * Format an API decimal string, or null when it cannot be formatted. Null means
 * "render nothing here" — never a fallback number.
 */
export function safeMoney(locale: Locale, amount: string, currency: string): string | null {
  if (typeof amount !== "string" || !isDecimalString(amount)) {
    return null;
  }
  try {
    // Intl throws on a currency code that is not three ASCII letters.
    return formatMoney(locale, amount, currency);
  } catch {
    return null;
  }
}

// A positive decimal has no leading minus and at least one non-zero digit; no
// arithmetic is performed on the string (spec §2.1, §30.2).
const NON_ZERO_DIGIT = /[1-9]/;

/**
 * Spec §18.2's price half of the eligibility conjunction, mirroring backend
 * `finance/listing_quotes.py: is_financeable_price`. The MIN_PRICE/MAX_PRICE
 * bounds stay on the server, which owns the policy; this is the client-side
 * guard that keeps a finance column off a card whose price it cannot even
 * render — a monthly payment beside a missing price is exactly the "finance UI
 * without a valid price" §18.2 forbids.
 */
export function isFinanceablePrice(
  price: { amount: string; currency: string } | null | undefined,
): boolean {
  if (!price || typeof price.amount !== "string") {
    return false;
  }
  return (
    isDecimalString(price.amount) &&
    !price.amount.startsWith("-") &&
    NON_ZERO_DIGIT.test(price.amount) &&
    isSupportedCurrency(price.currency)
  );
}
