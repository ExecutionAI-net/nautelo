import type { Metadata } from "next";
import Link from "next/link";

import BoatCard from "@/components/listings/BoatCard";
import { isFinanceablePrice } from "@/components/listings/money";
import { fetchPublishedListings } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";
import { tf } from "@/lib/i18n/finance";

export const dynamic = "force-dynamic";

const CANONICAL_PATH = "/boats/";
// One footnote per list region, which every eligible card's asterisk points at
// (spec §18.1: "The disclaimer asterisk resolves within the card/list region").
const DISCLAIMER_ID = "finance-disclaimer";

export function generateMetadata(): Metadata {
  return {
    title: tf(DEFAULT_LOCALE, "boats.title"),
    description: tf(DEFAULT_LOCALE, "boats.intro"),
    alternates: { canonical: CANONICAL_PATH },
  };
}

// Next 16: searchParams is a Promise. Verify against
// node_modules/next/dist/docs/ before changing this signature.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// The API returns absolute next/previous URLs; the page's own links stay
// relative so a shared URL always points at this site (spec §29.4's shareable,
// back-button-safe filter state, applied to the one control this page has).
function pageLink(apiUrl: string | null): string | null {
  if (!apiUrl) {
    return null;
  }
  const page = new URL(apiUrl).searchParams.get("page");
  return page ? `/boats/?page=${page}` : "/boats/";
}

export default async function BoatsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const locale = DEFAULT_LOCALE;
  // A null here would mean the collection endpoint itself 404'd, which is a
  // deployment fault rather than a product state — unlike Phase 5's directory,
  // these endpoints have no rollout flag. Let it throw to the error boundary
  // instead of rendering "no boats", which would be a lie.
  const results = await fetchPublishedListings({ page: first(params.page) });
  if (results === null) {
    throw new Error("GET /api/v1/listings/ is unavailable");
  }

  // Mirrors BoatCard: a card shows its estimate only for a visible block on a
  // financeable price, so the footnote appears exactly when an asterisk does.
  const showsFinance = results.results.some(
    (listing) => listing.finance?.visible === true && isFinanceablePrice(listing.price),
  );
  const previousHref = pageLink(results.previous);
  const nextHref = pageLink(results.next);

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <h1 className="font-headline-md text-headline-md text-primary">
        {tf(locale, "boats.title")}
      </h1>
      <p className="mt-space-sm font-body-md text-on-surface-variant">
        {tf(locale, "boats.intro")}
      </p>

      {results.results.length === 0 ? (
        <p className="mt-space-xl font-body-md text-on-surface-variant">
          {tf(locale, "boats.empty")}
        </p>
      ) : (
        <ul className="mt-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3">
          {results.results.map((listing) => (
            <li key={listing.id}>
              <BoatCard locale={locale} listing={listing} disclaimerId={DISCLAIMER_ID} />
            </li>
          ))}
        </ul>
      )}

      {/* Rendered only when a card on this page actually shows an estimate: an
          asterisk with nothing behind it and a footnote with no asterisk are
          both wrong. */}
      {showsFinance ? (
        <p
          id={DISCLAIMER_ID}
          className="mt-space-lg font-body-sm text-on-surface-variant"
        >
          * {tf(locale, "finance.illustrative_disclaimer")}
        </p>
      ) : null}

      {previousHref || nextHref ? (
        <nav className="mt-space-lg flex gap-space-md" aria-label={tf(locale, "boats.title")}>
          {previousHref ? <Link href={previousHref}>{tf(locale, "boats.previous")}</Link> : null}
          {nextHref ? <Link href={nextHref}>{tf(locale, "boats.next")}</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
