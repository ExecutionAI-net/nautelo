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
