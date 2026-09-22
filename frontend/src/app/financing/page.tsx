import { getT } from "@/i18n/server";
import { getRequestLocale } from "@/lib/i18n/requestLocale";
import type { Metadata } from "next";

import PageBand from "@/components/layout/PageBand";
import FinanceSimulator from "@/components/finance/FinanceSimulator";
import FinancingInfo from "@/components/finance/FinancingInfo";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";


export const dynamic = "force-dynamic";

const CANONICAL_PATH = "/financing/";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("finance.page.title"),
    description: t("finance.page.intro"),
  };
}

// Next 16: searchParams is a Promise.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FinancingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getT();
  const params = await searchParams;
  const locale = await getRequestLocale();

  return (
    <main className="w-full bg-surface">
      <PageBand
        eyebrow="Marine financing"
        title={t("finance.page.title")}
        subtitle={t("finance.page.intro")}
      />
      <div className="mx-auto max-w-[1440px] px-margin-mobile pt-space-xl md:px-margin lg:px-margin-desktop">
        <div className="mx-auto max-w-2xl"><FinanceSimulator initialPrice={Number.parseFloat(first(params.price) ?? "") || undefined} /></div>
      </div>
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
