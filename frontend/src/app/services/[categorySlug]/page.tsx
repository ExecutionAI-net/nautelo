import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ProfessionalResultCard from "@/components/directory/ProfessionalCard";
import {
  EMPTY_PROFESSIONAL_PAGE,
  fetchProfessionals,
  fetchServiceCategory,
} from "@/lib/api/directory";
import { DEFAULT_LOCALE, t } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise. Verify against node_modules/next/dist/docs/.
type Params = Promise<{ categorySlug: string }>;

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
    alternates: { canonical: `/services/${category.slug}/` },
  };
}

export default async function ServiceCategoryPage({ params }: { params: Params }) {
  const { categorySlug } = await params;
  const locale = DEFAULT_LOCALE;
  const category = await fetchServiceCategory(categorySlug, locale);

  // Only the approved SEO categories are public pages (spec 1). An active
  // category without has_seo_page is a filter value, not a URL.
  if (!category || !category.has_seo_page) {
    notFound();
  }

  // The flag-off case already 404ed above (fetchServiceCategory returned null),
  // so a null here can only be a race with a flag flip mid-render: degrade to
  // the empty state rather than throwing.
  const results =
    (await fetchProfessionals({ category: category.slug }, locale)) ??
    EMPTY_PROFESSIONAL_PAGE;

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
      </section>
    </main>
  );
}
