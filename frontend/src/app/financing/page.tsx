import type { Metadata } from "next";

import FinanceCalculator from "@/components/finance/FinanceCalculator";
import { fetchFinanceDefaults } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";
import { tf } from "@/lib/i18n/finance";

export const dynamic = "force-dynamic";

const CANONICAL_PATH = "/financing/";
const DEFAULT_CURRENCY = "EUR";

export function generateMetadata(): Metadata {
  return {
    title: tf(DEFAULT_LOCALE, "finance.page.title"),
    description: tf(DEFAULT_LOCALE, "finance.page.intro"),
    alternates: { canonical: CANONICAL_PATH },
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
  const params = await searchParams;
  const locale = DEFAULT_LOCALE;

  // Spec §18.3's three parameters. `listing` is the authority; `price` is an
  // untrusted display fallback the calculator shows only while the real quote
  // loads, and never sends anywhere; `currency` only selects a display format,
  // and anything unsupported falls back to EUR rather than reaching Intl.
  const listingId = first(params.listing) ?? null;
  const fallbackPrice = first(params.price) ?? null;
  const requested = (first(params.currency) ?? "").toUpperCase();
  const currency = requested === DEFAULT_CURRENCY ? requested : DEFAULT_CURRENCY;

  // Spec §2.1 / §17.5: the calculator opens on the platform's REAL current
  // assumptions, read at request time (`force-dynamic` above, `no-store`
  // inside), never on a copy compiled into this bundle. `null` when no
  // configuration is active — the form then opens un-prefilled rather than
  // inventing numbers.
  const defaults = await fetchFinanceDefaults();

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <h1 className="font-headline-md text-headline-md text-primary">
        {tf(locale, "finance.page.title")}
      </h1>
      <p className="mt-space-sm font-body-md text-on-surface-variant">
        {tf(locale, "finance.page.intro")}
      </p>
      <FinanceCalculator
        locale={locale}
        listingId={listingId}
        fallbackPrice={fallbackPrice}
        currency={currency}
        defaults={defaults}
      />
    </main>
  );
}
