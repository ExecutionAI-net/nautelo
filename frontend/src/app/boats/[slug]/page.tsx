import { getT } from "@/i18n/server";
import type { MessageKey, Translate } from "@/i18n";
import { getRequestLocale } from "@/lib/i18n/requestLocale";
import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";
import { notFound } from "next/navigation";

import InquiryForm from "@/components/inquiry/InquiryForm";
import BoatCard from "@/components/listings/BoatCard";
import ShareButtons from "@/components/listings/ShareButtons";
import { askingPrice, isFinanceablePrice, safeMoney } from "@/components/listings/money";
import { fetchInquiryConfig } from "@/lib/api/inquiry-config";
import { fetchPublishedListingBySlug, fetchPublishedListings, financingHref, listingPath } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";
import { tf } from "@/lib/i18n/finance";
import { placeLabel } from "@/lib/i18n/places";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise.
type Params = Promise<{ slug: string }>;

// The boat's own words for each stored spec, in the order a buyer reads them. Unknown keys still show, tidied.
const SPEC_ORDER: [string, MessageKey][] = [
  ["boat_type", "boat.spec.boat_type"],
  ["condition", "boat.spec.condition"],
  ["loa_m", "boat.spec.length"],
  ["length_m", "boat.spec.length"],
  ["beam_m", "boat.spec.beam"],
  ["draft_m", "boat.spec.draft"],
  ["cabins", "boat.spec.cabins"],
  ["berths", "boat.spec.berths"],
  ["heads", "boat.spec.bathrooms"],
  ["hull_material", "boat.spec.hull"],
  ["engines", "boat.spec.engines"],
  ["engine_power_hp", "boat.spec.engine_power"],
  ["engine_hours", "boat.spec.engine_hours"],
  ["fuel_type", "boat.spec.fuel"],
  ["max_speed_kn", "boat.spec.top_speed"],
  ["fuel_capacity_l", "boat.spec.fuel_tank"],
  ["water_capacity_l", "boat.spec.water_tank"],
  ["vat_paid", "boat.spec.vat_paid"],
];

function readableSpecs(specifications: Record<string, unknown>, t: Translate): { key: string; label: string; value: string }[] {
  const shown = (value: unknown) =>
    value === true ? t("boat.yes") : value === false ? t("boat.no") : typeof value === "string" ? value.charAt(0).toUpperCase() + value.slice(1) : String(value);
  const known = new Set(SPEC_ORDER.map(([key]) => key));
  const rows: { key: string; label: string; value: string }[] = [];
  const seenLabels = new Set<string>();
  for (const [key, labelKey] of SPEC_ORDER) {
    const label = t(labelKey);
    const value = specifications[key];
    if (value === null || value === undefined || value === "" || seenLabels.has(label)) continue;
    seenLabels.add(label);
    rows.push({ key, label, value: shown(value) });
  }
  for (const [key, value] of Object.entries(specifications)) {
    if (known.has(key) || value === null || value === undefined || value === "") continue;
    rows.push({ key, label: key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), value: shown(value) });
  }
  return rows;
}

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const listing = await fetchPublishedListingBySlug(slug);
  if (!listing) {
    return { title: (await getT())("boat.meta_title") };
  }
  return {
    title: listing.title[DEFAULT_LOCALE] || `${listing.brand_name} ${listing.model_name}`,
    description: listing.description[DEFAULT_LOCALE]?.slice(0, 160) || undefined,
  };
}

export default async function BoatDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const t = await getT();
  const listing = await fetchPublishedListingBySlug(slug);
  if (!listing) {
    notFound();
  }
  const inquiryConfig = await fetchInquiryConfig();
  const modelName = listing.custom_model_name || listing.model_name;
  const heading = `${listing.manufacture_year} ${listing.brand_name} ${modelName}`;
  const price = askingPrice(locale, listing.price.amount, listing.price.currency);
  const location = placeLabel(listing.location);
  const canonicalUrl = `${SITE_URL}${listingPath(listing) ?? `/boats/${slug}/`}`;
  const images = listing.media.filter((item) => item.media_type === "IMAGE" && item.url);
  const specs = readableSpecs(listing.specifications, t);

  // Similar means the same kind of boat first; only when there are too few of those does it fall back to any boat.
  const boatType = typeof listing.specifications.boat_type === "string" ? listing.specifications.boat_type : "";
  const sameType = boatType ? ((await fetchPublishedListings({ page_size: "4", exclude: listing.id, boat_type: boatType }).catch(() => null))?.results ?? []) : [];
  const others = sameType.length >= 2 ? sameType : ((await fetchPublishedListings({ page_size: "4", exclude: listing.id }).catch(() => null))?.results ?? []);
  const mainImage = images[0];
  const sideImages = images.slice(1, 3);
  const monthly =
    listing.finance?.visible === true && isFinanceablePrice(listing.price)
      ? safeMoney(locale, listing.finance.monthly_payment, listing.price.currency)
      : null;

  return (
    <main className="w-full bg-surface">
      <div className="mx-auto max-w-[1440px] px-margin-mobile py-space-lg md:px-margin lg:px-margin-desktop">
        <nav aria-label={t("boat.breadcrumb")} className="font-body-sm text-on-surface-variant">
          <Link href="/boats/" className="hover:text-primary">
            {tf(locale, "boats.title")}
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/boats/?brand=${encodeURIComponent(listing.brand_name)}`} className="hover:text-primary">
            {listing.brand_name}
          </Link>
        </nav>

        <div className="mt-space-md flex flex-col justify-between gap-space-md md:flex-row md:items-start">
          <div>
            <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm uppercase text-on-surface-variant">
              {listing.seller_type === "BROKER" ? t("boat.professional_seller") : t("boat.private_seller")}
            </span>
            <h1 className="mt-space-xs font-headline-lg text-headline-lg text-primary">
              {listing.title[locale] || heading}
            </h1>
            {location ? <p className="mt-space-xs font-body-md text-on-surface-variant">{location}</p> : null}
          </div>
          <div className="md:text-right">
            <p className="font-label-sm uppercase tracking-widest text-on-surface-variant">{t("boat.asking_price")}</p>
            {price ? <p className="font-spec-num text-headline-lg font-semibold text-primary">{price}</p> : null}
            <div className="mt-space-xs">
              <ShareButtons url={canonicalUrl} locale={locale} />
            </div>
          </div>
        </div>

        <div className="mt-space-lg grid grid-cols-1 gap-space-sm lg:grid-cols-3">
          <div className="overflow-hidden rounded-xl bg-surface-container-high lg:col-span-2">
            {mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- CDN URL
              <img src={mainImage.url ?? ""} alt={heading} className="aspect-[16/10] w-full object-cover" />
            ) : (
              <div aria-hidden="true" className="aspect-[16/10] w-full" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-space-sm lg:grid-cols-1">
            {sideImages.map((item) => (
              // eslint-disable-next-line @next/next/no-img-element -- CDN URL
              <img key={item.media_id} src={item.url ?? ""} alt={heading} loading="lazy" className="aspect-[16/10] w-full rounded-xl object-cover" />
            ))}
          </div>
        </div>
      </div>

      {specs.length > 0 ? (
        <section aria-label={t("boat.key_specs")} className="bg-surface-container-low py-space-md">
          <dl className="mx-auto grid max-w-[1440px] grid-cols-2 gap-space-sm px-margin-mobile sm:grid-cols-4 md:px-margin lg:grid-cols-6 lg:px-margin-desktop">
            {specs.map((spec) => (
              <div key={spec.key} className="rounded-lg bg-surface-container-lowest p-space-sm">
                <dt className="font-label-sm uppercase text-on-surface-variant">{spec.label}</dt>
                <dd className="font-spec-num text-title-md text-primary">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-space-xl px-margin-mobile py-space-xl md:px-margin lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:px-margin-desktop">
        <div>
          {listing.description[locale] ? (
            <>
              <h2 className="font-headline-md text-headline-md text-primary">{t("boat.description")}</h2>
              <p className="mt-space-md whitespace-pre-line rounded-xl bg-surface-container-lowest p-space-lg font-body-md text-on-surface shadow-sm">
                {listing.description[locale]}
              </p>
            </>
          ) : null}
          {monthly ? (
            <div className="mt-space-lg flex flex-col justify-between gap-space-sm rounded-xl bg-surface-container-low p-space-lg sm:flex-row sm:items-center">
              <div>
                <p className="font-label-sm uppercase tracking-widest text-on-surface-variant">{t("boat.marine_financing")}</p>
                <p className="font-title-lg text-title-lg text-primary">
                  {tf(locale, "finance.estimated_payment")} {monthly}
                  {tf(locale, "finance.per_month")}
                </p>
                <p className="font-body-sm text-on-surface-variant">{tf(locale, "finance.illustrative_disclaimer")}</p>
              </div>
              <a
                href={financingHref(listing)}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary"
              >
                {tf(locale, "finance.calculate")}
              </a>
            </div>
          ) : null}
        </div>
        <aside className="flex flex-col gap-space-md">
          <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
            <p className="font-label-sm uppercase tracking-widest text-on-surface-variant">
              {listing.broker ? t("boat.listing_brokerage") : t("boat.private_seller")}
            </p>
            {listing.broker ? (
              <p className="font-title-md text-title-md text-primary">
                <Link href={`/brokers/${listing.broker.slug}/`} className="underline">
                  {listing.broker.name}
                </Link>
              </p>
            ) : null}
            {location ? <p className="font-body-sm text-on-surface-variant">{location}</p> : null}
          </div>
          {inquiryConfig?.enabled ? (
            <InquiryForm
              context={{ type: "LISTING", id: listing.id, label: heading }}
              config={inquiryConfig}
              locale={locale}
            />
          ) : null}
        </aside>
      </div>

      {others.length > 0 ? (
        <section className="bg-surface-container-low py-space-xl">
          <div className="mx-auto max-w-[1440px] px-margin-mobile md:px-margin lg:px-margin-desktop">
            <span className="font-label-sm uppercase tracking-widest text-secondary">{t("boat.curated")}</span>
            <h2 className="mb-space-lg font-headline-lg text-headline-lg text-primary">{t("boat.similar")}</h2>
            <ul className="grid grid-cols-1 gap-space-lg sm:grid-cols-2 lg:grid-cols-4">
              {others.map((item) => (
                <li key={item.id}>
                  <BoatCard locale={locale} listing={item} disclaimerId={`finance-disclaimer-${item.id}`} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}
