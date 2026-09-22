import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";

import FinanceSimulator from "@/components/finance/FinanceSimulator";
import FinancingInfo from "@/components/finance/FinancingInfo";

export const dynamic = "force-dynamic";

// Next 16: searchParams is a Promise.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("finance.page.title"),
    description: t("finance.page.intro"),
  };
}

export default async function FinancingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getT();
  const params = await searchParams;

  return (
    <main className="w-full bg-surface">
      {/* Hero: breadcrumb, eyebrow, headline, intro, trust badges */}
      <section className="border-b border-outline-variant bg-surface-container-low py-space-xl">
        <div className="mx-auto max-w-[1440px] px-margin-mobile md:px-margin lg:px-margin-desktop">
          <nav aria-label="Breadcrumb" className="mb-space-md flex items-center gap-space-xs font-body-sm text-on-surface-variant">
            <Link href="/" className="hover:text-on-surface">{t("finance.hero.breadcrumb_home")}</Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-secondary">{t("finance.hero.breadcrumb_current")}</span>
          </nav>
          <div className="max-w-3xl">
            <span className="font-label-sm uppercase tracking-widest text-secondary">{t("finance.hero.eyebrow")}</span>
            <h1 className="mt-space-xs font-headline-lg text-headline-lg text-primary">{t("finance.page.title")}</h1>
            <p className="mt-space-xs font-body-md text-on-surface-variant">{t("finance.page.intro")}</p>
            <div className="mt-space-md flex flex-wrap gap-space-md border-t border-outline-variant pt-space-sm font-body-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-secondary" />{t("finance.hero.badge1")}</span>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-secondary" />{t("finance.hero.badge2")}</span>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-secondary" />{t("finance.hero.badge3")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Calculator + context sidebar */}
      <section className="py-space-xl lg:py-space-2xl">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-space-xl px-margin-mobile md:px-margin lg:grid-cols-12 lg:px-margin-desktop">
          <div className="lg:col-span-7">
            <FinanceSimulator initialPrice={Number.parseFloat(first(params.price) ?? "") || undefined} />
          </div>
          <aside className="flex flex-col gap-space-lg lg:col-span-5">
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
              <h2 className="font-headline-sm text-headline-sm text-primary">{t("finance.benefits.title")}</h2>
              <ul className="mt-space-md flex flex-col gap-space-md font-body-sm text-on-surface-variant">
                {(
                  [
                    ["finance.benefit1.title", "finance.benefit1.text"],
                    ["finance.benefit2.title", "finance.benefit2.text"],
                    ["finance.benefit3.title", "finance.benefit3.text"],
                  ] as const
                ).map(([titleKey, textKey]) => (
                  <li key={titleKey} className="flex items-start gap-space-sm">
                    <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-container text-xs font-bold text-on-secondary-container">✓</span>
                    <div>
                      <strong className="block font-title-md text-primary">{t(titleKey)}</strong>
                      {t(textKey)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div id="comparison" className="scroll-mt-24 rounded-xl border border-outline-variant bg-surface-container-low p-space-lg">
              <h3 className="font-headline-sm text-headline-sm text-primary">{t("finance.compare.title")}</h3>
              <p className="mt-space-xs font-body-sm text-on-surface-variant">{t("finance.compare.intro")}</p>
              <div className="mt-space-md flex flex-col gap-space-sm">
                <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm">
                  <span className="block font-label-sm uppercase tracking-wider text-secondary">{t("finance.compare.loan_title")}</span>
                  <p className="mt-1 font-body-sm text-on-surface-variant">{t("finance.compare.loan_text")}</p>
                </div>
                <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm">
                  <span className="block font-label-sm uppercase tracking-wider text-secondary">{t("finance.compare.leasing_title")}</span>
                  <p className="mt-1 font-body-sm text-on-surface-variant">{t("finance.compare.leasing_text")}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-space-md font-body-sm text-on-surface-variant">
              <strong className="mb-1 block font-title-md text-primary">{t("finance.compliance.title")}</strong>
              {t("finance.compliance.text")}
            </div>
          </aside>
        </div>
      </section>

      <FinancingInfo
        start={{
          price: first(params.price),
          down: first(params.down),
          term: first(params.term),
          product: first(params.product),
          country: first(params.country),
          condition: first(params.condition),
          use: first(params.use),
          year: first(params.year),
        }}
      />
    </main>
  );
}
