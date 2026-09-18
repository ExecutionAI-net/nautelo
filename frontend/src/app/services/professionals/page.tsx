import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CategoryGrid from "@/components/directory/CategoryGrid";
import DirectorySearchForm from "@/components/directory/DirectorySearchForm";
import ProfessionalResultCard from "@/components/directory/ProfessionalCard";
import { fetchProfessionals, fetchServiceCategories } from "@/lib/api/directory";
import { DEFAULT_LOCALE, t } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

// Spec 1: canonical combined URL.
const CANONICAL_PATH = "/services/professionals/";

export function generateMetadata(): Metadata {
  return {
    title: t(DEFAULT_LOCALE, "directory.services_professionals.title"),
    description: t(DEFAULT_LOCALE, "directory.intro"),
    alternates: { canonical: CANONICAL_PATH },
  };
}

// Next 16: searchParams is a Promise. Verify against
// node_modules/next/dist/docs/ before changing this signature.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// The API's `next`/`previous` are absolute API URLs (http://api-host/api/v1/...)
// and must never be rendered as hrefs — they would send the visitor off the
// site. They are used only as the truthy/falsy signal for "another page
// exists"; the href is rebuilt against this page's own canonical URL, carrying
// the active filters so paging does not silently reset the search.
function pageHref(
  filters: { q?: string; category?: string; location?: string; sort?: string },
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      search.set(key, value);
    }
  }
  // Page 1 is the bare URL: ?page=1 would make the first page reachable at two
  // different URLs, which is the duplicate-content signal spec 32.2 avoids.
  if (page > 1) {
    search.set("page", String(page));
  }
  const serialized = search.toString();
  return serialized ? `${CANONICAL_PATH}?${serialized}` : CANONICAL_PATH;
}

const PAGINATION_LINK_CLASS =
  "rounded-lg border border-outline-variant px-space-md py-space-sm font-label-md text-label-md text-primary";

export default async function CombinedDirectoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const locale = DEFAULT_LOCALE;
  const filters = {
    q: first(params.q),
    category: first(params.category),
    location: first(params.location),
    sort: first(params.sort),
    page: first(params.page),
  };

  const [categories, results] = await Promise.all([
    fetchServiceCategories(locale),
    fetchProfessionals(filters, locale),
  ]);

  // Spec 35.1: the flag gates frontend exposure, not just the API. Either
  // endpoint answering 404 means combined_services_professionals is off, so
  // the whole page stops existing — exactly what the detail page and the six
  // SEO pages already do, and what Task 6's CombinedDirectoryEnabled docstring
  // assumes ("the Next.js pages already handle 404"). An empty array here is a
  // different thing entirely and still renders the real empty state below.
  if (categories === null || results === null) {
    notFound();
  }

  const seoCategories = categories.filter((category) => category.has_seo_page);

  // A junk or absent ?page= falls back to 1: the API already ignores it the
  // same way, and NaN here would produce "?page=NaN" links.
  const parsedPage = Number.parseInt(filters.page ?? "", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const linkFilters = {
    q: filters.q,
    category: filters.category,
    location: filters.location,
    sort: filters.sort,
  };

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <section aria-labelledby="directory-title">
        <h1
          id="directory-title"
          className="font-headline-md text-headline-md text-primary"
        >
          {t(locale, "directory.services_professionals.title")}
        </h1>
        <p className="mt-space-sm max-w-2xl font-body-md text-on-surface-variant">
          {t(locale, "directory.intro")}
        </p>
        <div className="mt-space-lg">
          <DirectorySearchForm
            locale={locale}
            categories={categories.map((category) => ({
              slug: category.slug,
              name: category.name,
            }))}
            current={filters}
          />
        </div>

        {/* PHASE 6 SEAM — the approved service-request CTA belongs here.
            Spec 14.1 lists an existing service-request CTA on this page, and
            that flow is the same shared InquiryForm / InquiryService Phase 6
            mounts on the professional detail page — spec 15.1/39 forbid a
            directory-specific copy. Phase 6 renders its CTA at this position,
            opening that shared form. Nothing is rendered in the meantime: a
            button that opens nothing would be the visual-only implementation
            spec 39 prohibits. */}
      </section>

      {/* Spec 14.1 item 4's optional advertisement interstitial is deliberately
          absent: no advertisement model exists, and spec 2.1 forbids inventing
          one. The advertising phase owns it. */}

      <section aria-labelledby="categories-heading" className="mt-space-2xl">
        <h2
          id="categories-heading"
          className="font-title-lg text-title-lg text-primary"
        >
          {t(locale, "directory.categories.heading")}
        </h2>
        <div className="mt-space-md">
          <CategoryGrid locale={locale} categories={categories} />
        </div>
      </section>

      <section aria-labelledby="results-heading" className="mt-space-2xl">
        <h2 id="results-heading" className="font-title-lg text-title-lg text-primary">
          {t(locale, "directory.results.heading")}{" "}
          <span className="font-body-md text-on-surface-variant">
            ({results.count} {t(locale, "directory.results.count")})
          </span>
        </h2>
        {results.results.length === 0 ? (
          <p className="mt-space-md font-body-md text-on-surface-variant">
            {t(locale, "directory.results.empty")}
          </p>
        ) : (
          <ul className="mt-space-md grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
            {results.results.map((professional) => (
              <li key={professional.id}>
                <ProfessionalResultCard locale={locale} professional={professional} />
              </li>
            ))}
          </ul>
        )}

        {results.previous || results.next ? (
          <nav
            aria-label={t(locale, "directory.results.heading")}
            className="mt-space-lg flex gap-space-md"
          >
            {results.previous ? (
              <Link
                href={pageHref(linkFilters, currentPage - 1)}
                rel="prev"
                className={PAGINATION_LINK_CLASS}
              >
                {t(locale, "directory.pagination.previous")}
              </Link>
            ) : null}
            {results.next ? (
              <Link
                href={pageHref(linkFilters, currentPage + 1)}
                rel="next"
                className={PAGINATION_LINK_CLASS}
              >
                {t(locale, "directory.pagination.next")}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>

      {seoCategories.length > 0 ? (
        <section aria-labelledby="seo-heading" className="mt-space-2xl">
          <h2 id="seo-heading" className="font-title-lg text-title-lg text-primary">
            {t(locale, "directory.seo.heading")}
          </h2>
          <ul className="mt-space-md flex flex-wrap gap-space-md">
            {seoCategories.map((category) => (
              <li key={category.id}>
                <Link
                  href={category.url ?? `/services/${category.slug}/`}
                  className="font-body-md text-secondary underline"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
