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

export interface ProfessionalPlanSummary {
  name: string;
  tagline: string;
  monthly_price: string;
  currency: string;
}

export interface ListingPackage {
  slug: string;
  name: string;
  description: string;
  amount: string;
  currency: string;
  publication_days: number;
  image_limit: number;
  video_limit: number;
}

export interface Pricing {
  listing_packages?: ListingPackage[];
  professional_plan?: ProfessionalPlanSummary | null;
  broker_plans: PlanSummary[];
  individual_products: IndividualProduct[];
}

/** Browser (dashboard). Package and product names come back in `locale` (English when omitted). */
export function fetchPricingClient(locale = "en"): Promise<Pricing> {
  return apiFetch<Pricing>(`/api/v1/pricing/?locale=${encodeURIComponent(locale)}`);
}

export interface ServiceCategoryOption {
  slug: string;
  name: string;
}

// Deliberately not src/lib/api/directory.ts: that module reaches next/headers
// (server-only), and this is called from a "use client" registration form -
// see listingLinks.ts's own comment for why a Client Component reaching a
// next/headers import anywhere in its graph fails production `next build`.
export function fetchServiceCategoriesClient(): Promise<ServiceCategoryOption[]> {
  return apiFetch<ServiceCategoryOption[]>("/api/v1/service-categories/");
}

export interface BrokerRoleOption {
  slug: string;
  name: string;
}

/** The registering owner's role within the brokerage - staff-editable in
 *  Django admin (brokers.BrokerRole), not a hardcoded list. */
export function fetchBrokerRolesClient(): Promise<BrokerRoleOption[]> {
  return apiFetch<BrokerRoleOption[]>("/api/v1/broker-roles/");
}

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

export function formatPrice(amount: string, currency: string): string {
  const value = Number(amount);
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${value.toLocaleString("en", { maximumFractionDigits: 2 })}`;
}
