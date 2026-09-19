import type { MetadataRoute } from "next";

import {
  fetchProfessionals,
  fetchServiceCategories,
  type ProfessionalCard,
} from "@/lib/api/directory";
import { fetchPublishedListings, listingPath } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://127.0.0.1:3020";

async function allProfessionals(): Promise<ProfessionalCard[]> {
  const collected: ProfessionalCard[] = [];
  let page = 1;
  // Task 7's max_page_size is 48.
  for (;;) {
    const batch = await fetchProfessionals(
      { page: String(page), page_size: "48" },
      DEFAULT_LOCALE,
    );
    // null = the rollout flag is off; there is nothing public to list.
    if (batch === null) {
      return collected;
    }
    collected.push(...batch.results);
    if (!batch.next) {
      return collected;
    }
    page += 1;
  }
}

async function allListingPaths(): Promise<string[]> {
  const paths: string[] = [];
  let page = 1;
  for (;;) {
    const batch = await fetchPublishedListings({ page: String(page), page_size: "48" });
    if (batch === null) {
      return paths;
    }
    for (const listing of batch.results) {
      const path = listingPath(listing);
      if (path) {
        paths.push(path);
      }
    }
    if (!batch.next) {
      return paths;
    }
    page += 1;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, professionals, listingPaths] = await Promise.all([
    fetchServiceCategories(DEFAULT_LOCALE),
    allProfessionals(),
    allListingPaths().catch(() => [] as string[]),
  ]);

  // With the flag off the directory has no public URLs at all, so the sitemap
  // is empty rather than advertising a page that now 404s.
  const boats: MetadataRoute.Sitemap = [
    { url: `${PUBLIC_BASE_URL}/boats/`, changeFrequency: "daily", priority: 1 },
    ...listingPaths.map((path) => ({
      url: `${PUBLIC_BASE_URL}${path}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
  if (categories === null) {
    return boats;
  }

  // /services/ and /professionals/ are never emitted: nothing in the database
  // produces them, so the retired URLs are absent by construction (spec 32.2).
  return [
    ...boats,
    {
      url: `${PUBLIC_BASE_URL}/services/professionals/`,
      changeFrequency: "daily",
      priority: 1,
    },
    ...categories
      .filter((category) => category.has_seo_page)
      .map((category) => ({
        url: `${PUBLIC_BASE_URL}/services/${category.slug}/`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ...professionals.map((professional) => ({
      url: `${PUBLIC_BASE_URL}${professional.url}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
