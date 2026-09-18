// Client-safe: this module imports only lib/api/client, never anything that
// reaches next/headers, so a "use client" component can import it. The listing
// fetchers in lib/api/listings.ts go through directoryFetch (server-only) and
// must not be imported from client code; listings.ts re-exports these names for
// server callers.
import { apiFetch } from "@/lib/api/client";

// The backend's two closed sets, mirrored. AssumptionField is
// finance.listing_quotes.ASSUMPTION_FIELDS and AssumptionSource is §17.2's two
// platform sources plus this plan's REQUESTED.
export type AssumptionField =
  | "annual_rate_percent"
  | "term_months"
  | "down_payment_percent";

export type AssumptionSource = "GLOBAL" | "LISTING_OVERRIDE" | "REQUESTED";

export interface FinanceQuote {
  currency: string;
  price: string;
  down_payment_amount: string;
  principal: string;
  annual_rate_percent: string;
  term_months: number;
  monthly_payment: string;
  total_payment: string;
  total_interest: string;
  configuration_version: number | null;
  disclaimer_key: string;
  // Present on both of spec §17.4's contexts; null on a manual quote, which has
  // no platform source to report (Task 5).
  assumption_sources: Record<AssumptionField, AssumptionSource> | null;
}

export interface FinanceQuoteInput {
  listing_id?: string;
  price?: string;
  currency?: string;
  annual_rate_percent?: string;
  term_months?: number;
  down_payment_percent?: string;
}

/**
 * Spec §17.4. Throws ApiError (from lib/api/client) on any non-2xx, so a caller
 * can branch on `error.code` — `finance_not_available_for_listing` and
 * `listing_not_found` are both ordinary answers for the finance page.
 */
export async function requestFinanceQuote(input: FinanceQuoteInput): Promise<FinanceQuote> {
  return apiFetch<FinanceQuote>("/api/v1/finance/quotes/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
