import { getRequestLocale } from "@/lib/i18n/requestLocale";
import type { Metadata } from "next";
import Link from "next/link";

import AdSlot from "@/components/content/AdSlot";
import BoatCard from "@/components/listings/BoatCard";
import { isFinanceablePrice } from "@/components/listings/money";
import { fetchListingFacets, fetchPublishedListings, type ListingSearch } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";
import { tf } from "@/lib/i18n/finance";

export const dynamic = "force-dynamic";

const CANONICAL_PATH = "/boats/";
// One footnote per list region, which every eligible card's asterisk points at
// (spec §18.1: "The disclaimer asterisk resolves within the card/list region").
const DISCLAIMER_ID = "finance-disclaimer";

const COUNTRY_NAMES: Record<string, string> = { ES: "Spain", IT: "Italy" };

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "year_desc", label: "Year: newest first" },
  { value: "year_asc", label: "Year: oldest first" },
];

const FILTER_KEYS = [
  "q",
  "brand",
  "country",
  "region",
  "seller_type",
  "boat_type",
  "condition",
  "model",
  "fuel_type",
  "cabins_min",
  "price_min",
  "price_max",
  "year_min",
  "year_max",
  "sort",
] as const;

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

function hrefFor(filters: ListingSearch, page?: string): string {
  const search = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) search.set(key, value);
  }
  if (page && page !== "1") search.set("page", page);
  const serialized = search.toString();
  return serialized ? `${CANONICAL_PATH}?${serialized}` : CANONICAL_PATH;
}

// The API returns absolute next/previous URLs; the page's own links stay
// relative so a shared URL always points at this site (spec §29.4's shareable,
// back-button-safe filter state).
function pageOf(apiUrl: string | null): string | null {
  if (!apiUrl) return null;
  return new URL(apiUrl).searchParams.get("page") ?? "1";
}

const FIELD =
  "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md text-on-surface focus:outline-none";
const LABEL = "mb-1 block font-label-sm uppercase tracking-wider text-on-surface-variant";

export default async function BoatsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const filters: ListingSearch = {};
  for (const key of FILTER_KEYS) {
    const value = first(params[key]);
    if (value) filters[key] = value;
  }
  const page = first(params.page);

  const [results, facets] = await Promise.all([
    // A null here would mean the collection endpoint itself 404'd, which is a
    // deployment fault rather than a product state. Let it throw to the error
    // boundary instead of rendering "no boats", which would be a lie.
    fetchPublishedListings({ ...filters, page }),
    fetchListingFacets(),
  ]);
  if (results === null) {
    throw new Error("GET /api/v1/listings/ is unavailable");
  }

  // Mirrors BoatCard: a card shows its estimate only for a visible block on a
  // financeable price, so the footnote appears exactly when an asterisk does.
  const showsFinance = results.results.some(
    (listing) => listing.finance?.visible === true && isFinanceablePrice(listing.price),
  );
  const previousPage = pageOf(results.previous);
  const nextPage = pageOf(results.next);
  const active = FILTER_KEYS.filter((key) => key !== "sort" && filters[key]);
  const chipLabel = (key: (typeof FILTER_KEYS)[number]) => {
    const value = filters[key] ?? "";
    if (key === "country") return COUNTRY_NAMES[value.toUpperCase()] ?? value;
    if (key === "seller_type") return value === "BROKER" ? "Professional broker" : "Private owner";
    if (key === "price_min") return `From €${value}`;
    if (key === "price_max") return `Up to €${value}`;
    if (key === "year_min") return `From ${value}`;
    if (key === "year_max") return `Until ${value}`;
    if (key === "cabins_min") return `${value}+ cabins`;
    if (key === "q") return `“${value}”`;
    return value;
  };

  return (
    <main className="w-full bg-surface">
      <header className="bg-surface-container-low py-space-xl">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-space-md px-margin-mobile md:px-margin lg:flex-row lg:items-end lg:justify-between lg:px-margin-desktop">
          <div>
            <span className="font-label-sm uppercase tracking-widest text-secondary">Mediterranean yacht exchange</span>
            <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{tf(locale, "boats.title")}</h1>
            <p className="mt-space-xs max-w-2xl font-body-md text-on-surface-variant">{tf(locale, "boats.intro")}</p>
          </div>
          <form action={CANONICAL_PATH} method="get" role="search" className="flex w-full gap-space-sm lg:max-w-xl">
            {FILTER_KEYS.filter((key) => key !== "q" && filters[key]).map((key) => (
              <input key={key} type="hidden" name={key} value={filters[key]} />
            ))}
            <label className="sr-only" htmlFor="boat-search">
              Search boats
            </label>
            <input
              id="boat-search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Brand, model or port, e.g. Lagoon or Palma"
              className="flex-1 rounded-lg bg-surface-container-lowest px-space-md py-space-sm font-body-md shadow-sm focus:outline-none"
            />
            <button type="submit" className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container">
              Search
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-space-lg px-margin-mobile py-space-xl md:px-margin lg:grid-cols-[280px_1fr] lg:px-margin-desktop">
        <aside aria-label="Filter registry">
          <form action={CANONICAL_PATH} method="get" className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-title-md text-title-md text-primary">Filter registry</h2>
              <Link href={CANONICAL_PATH} className="font-label-sm text-secondary hover:underline">
                Reset all
              </Link>
            </div>
            {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}

            <div>
              <label className={LABEL} htmlFor="f-type">
                Boat type
              </label>
              <select id="f-type" name="boat_type" defaultValue={filters.boat_type ?? ""} className={FIELD}>
                <option value="">All boat types</option>
                {(facets.boat_types ?? []).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-condition">
                Condition
              </label>
              <select id="f-condition" name="condition" defaultValue={filters.condition ?? ""} className={FIELD}>
                <option value="">Any</option>
                <option value="used">Used</option>
                <option value="new">New</option>
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-brand">
                Brand
              </label>
              <select id="f-brand" name="brand" defaultValue={filters.brand ?? ""} className={FIELD}>
                <option value="">All brands</option>
                {facets.brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-model">
                Model
              </label>
              <input id="f-model" name="model" defaultValue={filters.model ?? ""} placeholder="Any model" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="f-country">
                Country
              </label>
              <select id="f-country" name="country" defaultValue={filters.country ?? ""} className={FIELD}>
                <option value="">Spain &amp; Italy</option>
                {facets.countries.map((country) => (
                  <option key={country} value={country}>
                    {COUNTRY_NAMES[country] ?? country}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-region">
                Region
              </label>
              <select id="f-region" name="region" defaultValue={filters.region ?? ""} className={FIELD}>
                <option value="">All regions</option>
                {facets.regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend className={LABEL}>Price range (€)</legend>
              <div className="grid grid-cols-2 gap-space-xs">
                <input aria-label="Minimum price" name="price_min" type="number" min={0} placeholder="Min" defaultValue={filters.price_min ?? ""} className={FIELD} />
                <input aria-label="Maximum price" name="price_max" type="number" min={0} placeholder="Max" defaultValue={filters.price_max ?? ""} className={FIELD} />
              </div>
            </fieldset>
            <fieldset>
              <legend className={LABEL}>Year built</legend>
              <div className="grid grid-cols-2 gap-space-xs">
                <input aria-label="Earliest year" name="year_min" type="number" min={1900} placeholder="From" defaultValue={filters.year_min ?? ""} className={FIELD} />
                <input aria-label="Latest year" name="year_max" type="number" min={1900} placeholder="To" defaultValue={filters.year_max ?? ""} className={FIELD} />
              </div>
            </fieldset>
            <div>
              <label className={LABEL} htmlFor="f-fuel">
                Fuel type
              </label>
              <select id="f-fuel" name="fuel_type" defaultValue={filters.fuel_type ?? ""} className={FIELD}>
                <option value="">Any fuel</option>
                {(facets.fuel_types ?? []).map((fuel) => (
                  <option key={fuel} value={fuel}>
                    {fuel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-cabins">
                Cabins
              </label>
              <select id="f-cabins" name="cabins_min" defaultValue={filters.cabins_min ?? ""} className={FIELD}>
                <option value="">Any</option>
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count}+
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-seller">
                Seller type
              </label>
              <select id="f-seller" name="seller_type" defaultValue={filters.seller_type ?? ""} className={FIELD}>
                <option value="">Any seller</option>
                <option value="BROKER">Professional broker</option>
                <option value="PRIVATE">Private owner</option>
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-sort">
                Sort by
              </label>
              <select id="f-sort" name="sort" defaultValue={filters.sort ?? "newest"} className={FIELD}>
                {SORTS.map((sort) => (
                  <option key={sort.value} value={sort.value}>
                    {sort.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary hover:bg-primary-container">
              Update results ({results.count ?? results.results.length})
            </button>
          </form>
        </aside>

        <section aria-label="Results">
          <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
            <p className="font-title-md text-title-md text-primary">
              <span className="font-spec-num">{results.count ?? results.results.length}</span> boats found
            </p>
            {active.length > 0 ? (
              <ul className="mt-space-xs flex flex-wrap items-center gap-space-xs" aria-label="Active filters">
                {active.map((key) => (
                  <li key={key} className="rounded-full bg-secondary-container px-space-sm py-0.5 font-label-sm text-on-secondary-container">
                    {chipLabel(key)}
                  </li>
                ))}
                <li>
                  <Link href={CANONICAL_PATH} className="font-label-sm text-secondary hover:underline">
                    Clear filters
                  </Link>
                </li>
              </ul>
            ) : null}
          </div>

          {results.results.length === 0 ? (
            <p className="mt-space-xl font-body-md text-on-surface-variant">
              {active.length > 0 ? "No boats match these filters." : tf(locale, "boats.empty")}
            </p>
          ) : (
            <ul className="mt-space-lg grid grid-cols-1 gap-space-lg sm:grid-cols-2 xl:grid-cols-3">
              {results.results.map((listing) => (
                <li key={listing.id}>
                  <BoatCard locale={locale} listing={listing} disclaimerId={DISCLAIMER_ID} />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-space-lg">
            <AdSlot placement="BOAT_LIST" />
          </div>

          {/* Rendered only when a card on this page actually shows an estimate: an
              asterisk with nothing behind it and a footnote with no asterisk are
              both wrong. */}
          {showsFinance ? (
            <p id={DISCLAIMER_ID} className="mt-space-lg font-body-sm text-on-surface-variant">
              * {tf(locale, "finance.illustrative_disclaimer")}
            </p>
          ) : null}

          {previousPage || nextPage ? (
            <nav
              className="mt-space-lg flex items-center justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-sm"
              aria-label={tf(locale, "boats.title")}
            >
              {previousPage ? (
                <Link href={hrefFor(filters, previousPage)} rel="prev">
                  {tf(locale, "boats.previous")}
                </Link>
              ) : (
                <span />
              )}
              {nextPage ? (
                <Link href={hrefFor(filters, nextPage)} rel="next">
                  {tf(locale, "boats.next")}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
