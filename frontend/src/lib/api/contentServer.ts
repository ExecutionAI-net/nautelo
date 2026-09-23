// Server-side public reads of guides and ads (imports next/headers through directoryFetch; never import from a client component).
import type { AdPlacement, GuideDetail, GuideSummary, PublicAd } from "@/lib/api/content";
import { directoryFetch, type Paginated, type DirectoryFetchOptions } from "@/lib/api/directory";

export async function fetchGuides(params: { page?: string; category?: string } = {}): Promise<Paginated<GuideSummary> & { categories?: string[] }> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", params.page);
  if (params.category) search.set("category", params.category);
  const query = search.toString();
  try {
    const body = await directoryFetch<Paginated<GuideSummary> & { categories?: string[] }>(`/api/v1/guides/${query ? `?${query}` : ""}`);
    return body ?? { count: 0, next: null, previous: null, results: [] };
  } catch {
    return { count: 0, next: null, previous: null, results: [] };
  }
}

export async function fetchGuide(slug: string): Promise<GuideDetail | null> {
  try {
    return await directoryFetch<GuideDetail>(`/api/v1/guides/${encodeURIComponent(slug)}/`);
  } catch {
    return null;
  }
}

/** Active ads for one placement. An ad outage must never break the page, so any failure is an empty list. */
export async function fetchAds(placement: AdPlacement, options: DirectoryFetchOptions = {}): Promise<PublicAd[]> {
  try {
    return (await directoryFetch<PublicAd[]>(`/api/v1/ads/?placement=${placement}`, options)) ?? [];
  } catch {
    return [];
  }
}

