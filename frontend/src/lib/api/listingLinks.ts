// Pure link-building helpers kept out of listings.ts on purpose: listings.ts
// imports directoryFetch (which reaches next/headers through internal-headers.ts),
// and Next.js poisons an entire module graph the moment a Client Component can
// reach it - even for an export that never touches next/headers itself. Anything
// a Client Component needs (e.g. BoatDetailView, shared by the client-only
// owner-preview route) belongs here instead, with no server-only imports.
import type { PublicListing } from "@/lib/api/listings";

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
