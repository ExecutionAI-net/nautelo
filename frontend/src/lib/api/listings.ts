// Reads of the public listing API (spec §30.1: GET /api/v1/listings/ and
// GET /api/v1/listings/<id>/), plus the one POST the finance surfaces make.
// Server-rendered pages call the fetch helpers; client components call
// requestFinanceQuote through the browser client.
import { directoryFetch, type Paginated } from "@/lib/api/directory";
import {
  requestFinanceQuote,
  type AssumptionField,
  type AssumptionSource,
  type FinanceQuote,
  type FinanceQuoteInput,
} from "@/lib/api/finance-quote";

export type { Paginated, AssumptionField, AssumptionSource, FinanceQuote, FinanceQuoteInput };
export { requestFinanceQuote };

export type SellerType = "PRIVATE" | "BROKER";

// Spec §18.5 defines two shapes, not one shape with optional fields: six keys
// when eligible, exactly one when not. Typing it as a union means a component
// cannot read monthly_payment without narrowing on visible === true, so spec
// §18.2's "do not show zeros or disabled finance placeholders" is a compile
// error rather than a review note.
export type ListingFinance =
  | { visible: false }
  | {
      visible: true;
      monthly_payment: string;
      annual_rate_percent: string;
      term_months: number;
      down_payment_percent: string;
      configuration_version: number;
    };

export interface ListingMedia {
  media_id: string;
  media_type: "IMAGE" | "VIDEO";
  storage_key: string;
  mime_type: string;
  sort_order: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  checksum_sha256: string;
  /** CDN URL, or null until public media serving is configured. */
  url?: string | null;
}

export interface PublicListing {
  id: string;
  slug: string | null;
  broker: { id: string; name: string; slug: string } | null;
  seller_type: SellerType;
  snapshot_version: number;
  published_at: string | null;
  expires_at: string | null;
  brand_name: string;
  model_name: string;
  custom_model_name: string;
  manufacture_year: number;
  title: { en: string; it: string; es: string };
  description: { en: string; it: string; es: string };
  specifications: Record<string, string | number | boolean | null>;
  specifications_schema_version: number;
  location: { country: string; region: string; city: string };
  // Spec §30.2: money as decimal strings. Never parsed for arithmetic — only
  // handed to Intl for display.
  price: { amount: string; currency: string };
  media: ListingMedia[];
  view_count: number;
  finance: ListingFinance;
}

/**
 * The active FinanceConfigurationVersion, as GET
 * /api/v1/platform/public-settings/ publishes it (Task 2). `null` when no
 * version is active.
 */
export interface FinanceConfigurationDefaults {
  version: number;
  annual_rate_percent: string;
  term_months: number;
  down_payment_percent: string;
}

export interface ListingSearch {
  page?: string;
  page_size?: string;
  broker?: string;
  q?: string;
  brand?: string;
  country?: string;
  region?: string;
  seller_type?: string;
  boat_type?: string;
  condition?: string;
  fuel_type?: string;
  cabins_min?: string;
  model?: string;
  exclude?: string;
  price_min?: string;
  price_max?: string;
  year_min?: string;
  year_max?: string;
  sort?: string;
}

export interface ListingFacets {
  brands: string[];
  countries: string[];
  regions: string[];
  boat_types?: string[];
  fuel_types?: string[];
}

export async function fetchListingFacets(): Promise<ListingFacets> {
  try {
    const body = await directoryFetch<ListingFacets>("/api/v1/listings/facets/");
    return body ?? { brands: [], countries: [], regions: [] };
  } catch {
    return { brands: [], countries: [], regions: [] };
  }
}

export function listingQuery(params: ListingSearch): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Server-side reads go through directoryFetch, which forwards the visitor's
// client IP and the internal service secret. A plain fetch here would put every
// visitor into one throttle bucket keyed on the Next.js server's address.
// directoryFetch also owns the null-vs-throw contract: 404 -> null, any other
// non-2xx (429, 5xx) throws, a network error propagates.

// null means "the API answered 404"; an empty `results` array is a real, empty
// page. Callers decide what null means.
export async function fetchPublishedListings(
  params: ListingSearch = {},
): Promise<Paginated<PublicListing> | null> {
  const path = `/api/v1/listings/${listingQuery(params)}`;
  const body = await directoryFetch<unknown>(path);
  if (body === null) {
    return null;
  }
  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw new Error(`Listing API ${path} returned a malformed payload`);
  }
  return body as unknown as Paginated<PublicListing>;
}

export async function fetchPublishedListing(id: string): Promise<PublicListing | null> {
  const path = `/api/v1/listings/${encodeURIComponent(id)}/`;
  const body = await directoryFetch<unknown>(path);
  if (body === null) {
    return null;
  }
  if (!isRecord(body) || typeof body.id !== "string") {
    throw new Error(`Listing API ${path} returned a malformed payload`);
  }
  return body as unknown as PublicListing;
}

export async function fetchPublishedListingBySlug(slug: string): Promise<PublicListing | null> {
  const path = `/api/v1/listings/by-slug/${encodeURIComponent(slug)}/`;
  const body = await directoryFetch<unknown>(path);
  if (body === null) {
    return null;
  }
  if (!isRecord(body) || typeof body.id !== "string") {
    throw new Error(`Listing API ${path} returned a malformed payload`);
  }
  return body as unknown as PublicListing;
}

/** Canonical path of a listing's public page; null until it has a slug. */
export function listingPath(listing: Pick<PublicListing, "slug">): string | null {
  return listing.slug ? `/boats/${listing.slug}/` : null;
}

function isFinanceDefaults(value: unknown): value is FinanceConfigurationDefaults {
  return (
    isRecord(value) &&
    typeof value.version === "number" &&
    typeof value.annual_rate_percent === "string" &&
    typeof value.term_months === "number" &&
    typeof value.down_payment_percent === "string"
  );
}

/**
 * The platform's current finance assumptions, from the public settings endpoint
 * (Task 2). Returns null when no configuration is active, and null rather than
 * throwing on any failure (404, 429, 5xx, network, malformed body): a
 * calculator that starts un-prefilled is a worse page, not a broken one, and
 * spec §2.1 forbids substituting invented numbers for the real ones. Server
 * components only.
 */
export async function fetchFinanceDefaults(): Promise<FinanceConfigurationDefaults | null> {
  try {
    const body = await directoryFetch<unknown>("/api/v1/platform/public-settings/");
    if (!isRecord(body)) {
      return null;
    }
    return isFinanceDefaults(body.finance_configuration) ? body.finance_configuration : null;
  } catch {
    return null;
  }
}

/**
 * Spec §18.3's calculator target, exactly:
 * /financing/?listing=<uuid>&price=<server-formatted-price>&currency=EUR
 * The price is the server's own string and exists only as the finance page's
 * immediate display fallback while its authoritative quote loads.
 */
export function financingHref(listing: PublicListing): string {
  const search = new URLSearchParams({
    listing: listing.id,
    price: listing.price.amount,
    currency: listing.price.currency,
  });
  return `/financing/?${search.toString()}`;
}
