import { getRequestLocale } from "@/lib/i18n/requestLocale";
import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";
import { notFound } from "next/navigation";

import ProfessionalResultCard from "@/components/directory/ProfessionalCard";
import {
  EMPTY_PROFESSIONAL_PAGE,
  fetchProfessionals,
  fetchServiceCategory,
} from "@/lib/api/directory";
import { DEFAULT_LOCALE, t } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

// Next 16: params and searchParams are Promises. Verify against
// node_modules/next/dist/docs/.
type Params = Promise<{ categorySlug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGINATION_LINK_CLASS =
  "rounded-lg border border-outline-variant px-space-md py-space-sm font-label-md text-label-md text-primary";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await fetchServiceCategory(categorySlug, DEFAULT_LOCALE);
  if (!category || !category.has_seo_page) {
    return {};
  }
  return {
    title: category.seo_title || category.name,
    description: category.seo_description || undefined,
    // Spec 1: the six approved service pages keep their own canonical URLs.
  };
}

export default async function ServiceCategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { categorySlug } = await params;
  const locale = await getRequestLocale();
  const category = await fetchServiceCategory(categorySlug, locale);

  // Only the approved SEO categories are public pages (spec 1). An active
  // category without has_seo_page is a filter value, not a URL.
  if (!category || !category.has_seo_page) {
    notFound();
  }

  // The flag-off case already 404ed above (fetchServiceCategory returned null),
  // so a null here can only be a race with a flag flip mid-render: degrade to
  // the empty state rather than throwing.
  // This page takes no filters of its own — the category is the whole query —
  // so ?page= is the only search param it reads. A junk value falls back to 1.
  const rawPage = (await searchParams).page;
  const parsedPage = Number.parseInt(
    (Array.isArray(rawPage) ? rawPage[0] : rawPage) ?? "",
    10,
  );
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const results =
    (await fetchProfessionals(
      { category: category.slug, page: currentPage > 1 ? String(currentPage) : undefined },
      locale,
    )) ?? EMPTY_PROFESSIONAL_PAGE;

  // results.next/previous are absolute API URLs and are used only as the
  // "another page exists" signal; the href points back at this page.
  const pageHref = (page: number) =>
    page > 1 ? `/services/${category.slug}/?page=${page}` : `/services/${category.slug}/`;

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <h1 className="font-headline-md text-headline-md text-primary">{category.name}</h1>
      {category.description ? (
        <p className="mt-space-sm max-w-2xl whitespace-pre-line font-body-md text-on-surface">
          {category.description}
        </p>
      ) : null}

      <p className="mt-space-lg">
        <Link
          href={`/services/professionals/?category=${encodeURIComponent(category.slug)}`}
          className="font-body-md text-secondary underline"
        >
          {t(locale, "category.browse_professionals")}
        </Link>
      </p>

      <section aria-labelledby="category-results-heading" className="mt-space-2xl">
        <h2
          id="category-results-heading"
          className="font-title-lg text-title-lg text-primary"
        >
          {t(locale, "directory.results.heading")}
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
                href={pageHref(currentPage - 1)}
                rel="prev"
                className={PAGINATION_LINK_CLASS}
              >
                {t(locale, "directory.pagination.previous")}
              </Link>
            ) : null}
            {results.next ? (
              <Link href={pageHref(currentPage + 1)} rel="next" className={PAGINATION_LINK_CLASS}>
                {t(locale, "directory.pagination.next")}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
