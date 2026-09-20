// Broker membership tiers and the individual listing right (GET /api/v1/pricing/, public).
import { apiFetch } from "@/lib/api/client";

export interface PlanSummary {
  slug: string;
  name: string;
  tagline: string;
  monthly_price: string;
  currency: string;
  listing_limit: number | null;
  seat_limit: number | null;
  profile_visibility: string;
}

export interface IndividualProduct {
  code: string;
  name: string;
  description: string;
  amount: string;
  currency: string;
  publication_days: number | null;
  valid_days: number;
}

export interface Pricing {
  broker_plans: PlanSummary[];
  individual_products: IndividualProduct[];
}

/** Browser (dashboard). */
export function fetchPricingClient(): Promise<Pricing> {
  return apiFetch<Pricing>("/api/v1/pricing/");
}

export function formatPrice(amount: string, currency: string): string {
  const value = Number(amount);
  const symbol = currency === "EUR" ? "€" : `${currency} `;
  return `${symbol}${value.toLocaleString("en", { maximumFractionDigits: 2 })}`;
}
