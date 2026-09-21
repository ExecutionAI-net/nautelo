import type { MetadataRoute } from "next";

import {
  fetchProfessionals,
  fetchServiceCategories,
  type ProfessionalCard,
} from "@/lib/api/directory";
import { fetchBrokers } from "@/lib/api/brokers";
import { fetchPublishedListings, listingPath } from "@/lib/api/listings";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/lib/i18n/directory";
import { prefixFor } from "@/lib/i18n/localePath";

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

async function allBrokerPaths(): Promise<string[]> {
  const paths: string[] = [];
  let page = 1;
  for (;;) {
    const batch = await fetchBrokers({ page: String(page) });
    if (batch === null) {
      return paths;
    }
    paths.push(...batch.results.map((broker) => broker.url));
    if (!batch.next) {
      return paths;
    }
    page += 1;
  }
}

/** Each public page appears once per language, every entry pointing at all the others (and English as the default). */
function inEveryLanguage(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  return entries.flatMap((entry) => {
    const path = entry.url.slice(PUBLIC_BASE_URL.length);
    const languages: Record<string, string> = Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [locale, `${PUBLIC_BASE_URL}${prefixFor(locale)}${path}`]),
    );
    languages["x-default"] = `${PUBLIC_BASE_URL}${path}`;
    return SUPPORTED_LOCALES.map((locale) => ({ ...entry, url: languages[locale], alternates: { languages } }));
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return inEveryLanguage(await englishSitemap());
}

async function englishSitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, professionals, listingPaths, brokerPaths] = await Promise.all([
    fetchServiceCategories(DEFAULT_LOCALE),
    allProfessionals(),
    allListingPaths().catch(() => [] as string[]),
    allBrokerPaths().catch(() => [] as string[]),
  ]);

  // With the flag off the directory has no public URLs at all, so the sitemap
  // is empty rather than advertising a page that now 404s.
  const boats: MetadataRoute.Sitemap = [
    { url: `${PUBLIC_BASE_URL}/boats/`, changeFrequency: "daily", priority: 1 },
    { url: `${PUBLIC_BASE_URL}/brokers/`, changeFrequency: "daily", priority: 0.9 },
    { url: `${PUBLIC_BASE_URL}/pricing/`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${PUBLIC_BASE_URL}/financing/`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${PUBLIC_BASE_URL}/guides/`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${PUBLIC_BASE_URL}/sell/`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${PUBLIC_BASE_URL}/contact/`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${PUBLIC_BASE_URL}/privacy/`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${PUBLIC_BASE_URL}/terms/`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${PUBLIC_BASE_URL}/cookies/`, changeFrequency: "yearly", priority: 0.2 },
    ...brokerPaths.map((path) => ({
      url: `${PUBLIC_BASE_URL}${path}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
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
