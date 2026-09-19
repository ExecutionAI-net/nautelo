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
}

export async function fetchBrokers(page?: string): Promise<Paginated<PublicBroker> | null> {
  const query = page ? `?page=${encodeURIComponent(page)}` : "";
  return directoryFetch<Paginated<PublicBroker>>(`/api/v1/brokers/${query}`);
}

export async function fetchBroker(slug: string): Promise<PublicBroker | null> {
  return directoryFetch<PublicBroker>(`/api/v1/brokers/by-slug/${encodeURIComponent(slug)}/`);
}
