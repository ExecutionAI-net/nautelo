// Public broker directory reads (spec 4.1). Server components only:
// directoryFetch forwards the visitor IP and the internal service secret.
import { directoryFetch, type Paginated } from "@/lib/api/directory";

export interface PublicBroker {
  id: string;
  name: string;
  slug: string;
  url: string;
  website_url: string | null;
  listing_count: number;
  tagline: string;
  about: string;
  city: string;
  country_code: string;
  logo_url: string;
  cover_image_url: string;
  specialties: string[];
}

export interface BrokerLocationFacet {
  country: string;
  place_id: number | null;
  city: string;
  count: number;
}

export interface BrokerFacets {
  countries: Record<string, number>;
  specialties: Record<string, number>;
  locations: BrokerLocationFacet[];
}

export async function fetchBrokers(
  params: { page?: string; q?: string; country?: string; place?: string; specialty?: string } = {},
): Promise<(Paginated<PublicBroker> & { facets?: BrokerFacets }) | null> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const text = query.toString();
  return directoryFetch<Paginated<PublicBroker> & { facets?: BrokerFacets }>(`/api/v1/brokers/${text ? `?${text}` : ""}`);
}

export async function fetchBroker(slug: string): Promise<PublicBroker | null> {
  return directoryFetch<PublicBroker>(`/api/v1/brokers/by-slug/${encodeURIComponent(slug)}/`);
}
