import type { MessageKey } from "@/i18n";
import { getT } from "@/i18n/server";
import { getRequestLocale } from "@/lib/i18n/requestLocale";
import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";

import AdSlot from "@/components/content/AdSlot";
import BoatCard from "@/components/listings/BoatCard";
import { isFinanceablePrice } from "@/components/listings/money";
import MobileFilters from "@/components/listings/MobileFilters";
import SortSelect from "@/components/listings/SortSelect";
import LocationFacetFilter from "@/components/places/LocationFacetFilter";
import { fetchListingFacets, fetchPublishedListings, type ListingSearch } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";


export const dynamic = "force-dynamic";

const CANONICAL_PATH = "/boats/";
// One footnote per list region, which every eligible card's asterisk points at
// (spec §18.1: "The disclaimer asterisk resolves within the card/list region").
const DISCLAIMER_ID = "finance-disclaimer";

const COUNTRY_NAMES = new Proxy({} as Record<string, string>, {
  get: (_target, code: string) => {
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
    } catch {
      return code;
    }
  },
});

const SORTS: { value: string; key: MessageKey }[] = [
  { value: "newest", key: "boats.sort.newest" },
  { value: "price_asc", key: "boats.sort.price_asc" },
  { value: "price_desc", key: "boats.sort.price_desc" },
  { value: "year_desc", key: "boats.sort.year_desc" },
  { value: "year_asc", key: "boats.sort.year_asc" },
];

const FILTER_KEYS = [
  "q",
  "mode",
  "query",
  "brand",
  "country",
  "region",
  "place",
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
  "length_min",
  "length_max",
  "sort",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("boats.title"),
    description: t("boats.intro"),
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
  const t = await getT();
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
  const active = FILTER_KEYS.filter((key) => key !== "sort" && key !== "mode" && filters[key]);
  const filterCount = active.filter((key) => key !== "q" && key !== "query").length;
  const interpretation = (results as { interpretation?: { labels: string[]; relaxed?: string[] } }).interpretation;
  const understood = interpretation?.labels ?? [];
  const relaxed = interpretation?.relaxed ?? [];
  const chipLabel = (key: (typeof FILTER_KEYS)[number]) => {
    const value = filters[key] ?? "";
    if (key === "country") return COUNTRY_NAMES[value.toUpperCase()] ?? value;
    if (key === "seller_type") return t(value === "BROKER" ? "boats.f.broker" : "boats.f.private");
    if (key === "price_min") return t("boats.chip.from_price", { value });
    if (key === "price_max") return t("boats.chip.up_to_price", { value });
    if (key === "year_min") return t("boats.chip.from_year", { value });
    if (key === "year_max") return t("boats.chip.until_year", { value });
    if (key === "length_min") return t("boats.chip.from_length", { value });
    if (key === "length_max") return t("boats.chip.up_to_length", { value });
    if (key === "cabins_min") return t("boats.chip.cabins_plus", { value });
    if (key === "q" || key === "query") return `“${value}”`;
    return value;
  };

  return (
    <main className="w-full bg-surface">
      <header className="bg-surface-container-low py-space-xl">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-space-md px-margin-mobile md:px-margin lg:flex-row lg:items-end lg:justify-between lg:px-margin-desktop">
          <div>
            <span className="font-label-sm uppercase tracking-widest text-secondary">{t("boats.eyebrow")}</span>
            <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{t("boats.title")}</h1>
            <p className="mt-space-xs max-w-2xl font-body-md text-on-surface-variant">{t("boats.intro")}</p>
          </div>
          <form action={CANONICAL_PATH} method="get" role="search" className="flex w-full gap-space-sm lg:max-w-xl">
            {FILTER_KEYS.filter((key) => key !== "q" && key !== "query" && key !== "mode" && filters[key]).map((key) => (
              <input key={key} type="hidden" name={key} value={filters[key]} />
            ))}
            <label className="sr-only" htmlFor="boat-search">
              {t("boats.search_label")}
            </label>
            <input type="hidden" name="mode" value="semantic" />
            <input
              id="boat-search"
              name="query"
              maxLength={300}
              defaultValue={filters.query ?? filters.q ?? ""}
              placeholder={t("boats.search_placeholder")}
              className="flex-1 rounded-lg bg-surface-container-lowest px-space-md py-space-sm font-body-md shadow-sm focus:outline-none"
            />
            <button type="submit" className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container">
              {t("boats.search_button")}
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-space-lg px-margin-mobile py-space-xl md:px-margin lg:grid-cols-[280px_1fr] lg:px-margin-desktop">
        <aside aria-label={t("boats.filters")}>
<MobileFilters label={filterCount > 0 ? t("boats.filters_active", { count: filterCount }) : t("boats.filters")}>
          <form action={CANONICAL_PATH} method="get" className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-title-md text-title-md text-primary">{t("boats.filters")}</h2>
              <Link href={CANONICAL_PATH} className="font-label-sm text-secondary hover:underline">
                {t("boats.reset_all")}
              </Link>
            </div>
            {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
            {filters.query ? (
              <>
                <input type="hidden" name="mode" value="semantic" />
                <input type="hidden" name="query" value={filters.query} />
              </>
            ) : null}

            <div>
              <label className={LABEL} htmlFor="f-type">
                {t("boats.f.boat_type")}
              </label>
              <select id="f-type" name="boat_type" defaultValue={filters.boat_type ?? ""} className={FIELD}>
                <option value="">{t("boats.f.all_types")}</option>
                {(facets.boat_types ?? []).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-condition">
                {t("boats.f.condition")}
              </label>
              <select id="f-condition" name="condition" defaultValue={filters.condition ?? ""} className={FIELD}>
                <option value="">{t("boats.f.any")}</option>
                <option value="used">{t("boats.f.used")}</option>
                <option value="new">{t("boats.f.new")}</option>
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-brand">
                {t("boats.f.brand")}
              </label>
              <select id="f-brand" name="brand" defaultValue={filters.brand ?? ""} className={FIELD}>
                <option value="">{t("boats.f.all_brands")}</option>
                {facets.brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-model">
                {t("boats.f.model")}
              </label>
              <input id="f-model" name="model" defaultValue={filters.model ?? ""} placeholder={t("boats.f.any_model")} className={FIELD} />
            </div>
            <LocationFacetFilter
              key={`${filters.country ?? ""}|${filters.place ?? ""}`}
              locations={facets.locations ?? []}
              idPrefix="f"
              labelClass={LABEL}
              labels={{ country: t("place.country"), allCountries: t("place.all_countries"), city: t("place.city"), allCities: t("place.all_cities"), chooseCountry: t("place.choose_country"), searchCity: t("place.search_city") }}
              wrapperClass=""
              initial={{ country: filters.country, place: filters.place }}
            />
            <fieldset>
              <legend className={LABEL}>{t("boats.f.price_range")}</legend>
              <div className="grid grid-cols-2 gap-space-xs">
                <input aria-label={t("boats.f.min_price")} name="price_min" type="number" min={0} placeholder={t("boats.f.min")} defaultValue={filters.price_min ?? ""} className={FIELD} />
                <input aria-label={t("boats.f.max_price")} name="price_max" type="number" min={0} placeholder={t("boats.f.max")} defaultValue={filters.price_max ?? ""} className={FIELD} />
              </div>
            </fieldset>
            <fieldset>
              <legend className={LABEL}>{t("boats.f.year_built")}</legend>
              <div className="grid grid-cols-2 gap-space-xs">
                <input aria-label={t("boats.f.earliest_year")} name="year_min" type="number" min={1900} placeholder={t("boats.f.from")} defaultValue={filters.year_min ?? ""} className={FIELD} />
                <input aria-label={t("boats.f.latest_year")} name="year_max" type="number" min={1900} placeholder={t("boats.f.to")} defaultValue={filters.year_max ?? ""} className={FIELD} />
              </div>
            </fieldset>
            <fieldset>
              <legend className={LABEL}>{t("boats.f.length")}</legend>
              <div className="grid grid-cols-2 gap-space-xs">
                <input aria-label={t("boats.f.min_length")} name="length_min" type="number" min={0} step="0.5" placeholder={t("boats.f.min")} defaultValue={filters.length_min ?? ""} className={FIELD} />
                <input aria-label={t("boats.f.max_length")} name="length_max" type="number" min={0} step="0.5" placeholder={t("boats.f.max")} defaultValue={filters.length_max ?? ""} className={FIELD} />
              </div>
            </fieldset>
            <div>
              <label className={LABEL} htmlFor="f-fuel">
                {t("boats.f.fuel")}
              </label>
              <select id="f-fuel" name="fuel_type" defaultValue={filters.fuel_type ?? ""} className={FIELD}>
                <option value="">{t("boats.f.any_fuel")}</option>
                {(facets.fuel_types ?? []).map((fuel) => (
                  <option key={fuel} value={fuel}>
                    {fuel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-cabins">
                {t("boats.f.cabins")}
              </label>
              <select id="f-cabins" name="cabins_min" defaultValue={filters.cabins_min ?? ""} className={FIELD}>
                <option value="">{t("boats.f.any")}</option>
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count}+
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="f-seller">
                {t("boats.f.seller")}
              </label>
              <select id="f-seller" name="seller_type" defaultValue={filters.seller_type ?? ""} className={FIELD}>
                <option value="">{t("boats.f.any_seller")}</option>
                <option value="BROKER">{t("boats.f.broker")}</option>
                <option value="PRIVATE">{t("boats.f.private")}</option>
              </select>
            </div>
            {/* Sort lives next to the results count, not here, so it applies the instant it
                changes; carry the current value through so the other filters don't reset it. */}
            {filters.sort ? <input type="hidden" name="sort" value={filters.sort} /> : null}
            <button type="submit" className="rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary hover:bg-primary-container">
              {t("boats.apply")}
            </button>
          </form>
</MobileFilters>
        </aside>

        <section aria-label={t("boats.results")}>
          <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <p className="font-title-md text-title-md text-primary">
                {t("boats.found", { count: results.count ?? results.results.length })}
              </p>
              <SortSelect
                action={CANONICAL_PATH}
                hidden={Object.fromEntries(FILTER_KEYS.filter((key) => key !== "sort" && filters[key]).map((key) => [key, filters[key] as string]))}
                value={filters.sort ?? "newest"}
                label={t("boats.f.sort")}
                options={SORTS.map((sort) => ({ value: sort.value, label: t(sort.key) }))}
              />
            </div>
            {active.length > 0 ? (
              <ul className="mt-space-xs flex flex-wrap items-center gap-space-xs" aria-label={t("boats.active_filters")}>
                {active.map((key) => (
                  <li key={key} className="rounded-full bg-secondary-container px-space-sm py-0.5 font-label-sm text-on-secondary-container">
                    {chipLabel(key)}
                  </li>
                ))}
                <li>
                  <Link href={CANONICAL_PATH} className="font-label-sm text-secondary hover:underline">
                    {t("boats.clear")}
                  </Link>
                </li>
              </ul>
            ) : null}
            {understood.length > 0 ? (
              <p className="mt-space-xs font-body-sm text-on-surface-variant">
                {t("boats.understood", { labels: understood.join(" · ") })}
                {relaxed.length > 0 ? ` ${t("boats.relaxed")}` : ""}
              </p>
            ) : null}
          </div>

          {results.results.length === 0 ? (
            <p className="mt-space-xl font-body-md text-on-surface-variant">
              {active.length > 0 ? t("boats.none_match") : t("boats.empty")}
            </p>
          ) : (
            <ul className="mt-space-lg grid grid-cols-1 gap-space-lg sm:grid-cols-2 xl:grid-cols-3">
              {results.results.map((listing, index) => (
                <li key={listing.id}>
                  {/* First row (up to xl:grid-cols-3) renders above the fold on first paint —
                      one of these is usually the page's LCP element. */}
                  <BoatCard t={t} locale={locale} listing={listing} disclaimerId={DISCLAIMER_ID} priority={index < 3} />
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
              * {t("finance.illustrative_disclaimer")}
            </p>
          ) : null}

          {previousPage || nextPage ? (
            <nav
              className="mt-space-lg flex items-center justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-sm"
              aria-label={t("boats.title")}
            >
              {previousPage ? (
                <Link href={hrefFor(filters, previousPage)} rel="prev">
                  {t("boats.previous")}
                </Link>
              ) : (
                <span />
              )}
              {nextPage ? (
                <Link href={hrefFor(filters, nextPage)} rel="next">
                  {t("boats.next")}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
    </main>
  );
}
