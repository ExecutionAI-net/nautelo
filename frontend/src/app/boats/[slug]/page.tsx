import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import InquiryForm from "@/components/inquiry/InquiryForm";
import ShareButtons from "@/components/listings/ShareButtons";
import { safeMoney } from "@/components/listings/money";
import { fetchInquiryConfig } from "@/lib/api/inquiry-config";
import { fetchPublishedListingBySlug, listingPath } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise.
type Params = Promise<{ slug: string }>;

const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const listing = await fetchPublishedListingBySlug(slug);
  if (!listing) {
    return { title: "Boat" };
  }
  return {
    title: listing.title[DEFAULT_LOCALE] || `${listing.brand_name} ${listing.model_name}`,
    description: listing.description[DEFAULT_LOCALE]?.slice(0, 160) || undefined,
    alternates: { canonical: listingPath(listing) ?? undefined },
  };
}

export default async function BoatDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const locale = DEFAULT_LOCALE;
  const listing = await fetchPublishedListingBySlug(slug);
  if (!listing) {
    notFound();
  }
  const inquiryConfig = await fetchInquiryConfig();
  const modelName = listing.custom_model_name || listing.model_name;
  const heading = `${listing.manufacture_year} ${listing.brand_name} ${modelName}`;
  const price = safeMoney(locale, listing.price.amount, listing.price.currency);
  const location = [listing.location.city, listing.location.region, listing.location.country]
    .filter(Boolean)
    .join(", ");
  const canonicalUrl = `${SITE_URL}${listingPath(listing) ?? `/boats/${slug}/`}`;
  const images = listing.media.filter((item) => item.media_type === "IMAGE" && item.url);
  const specs = Object.entries(listing.specifications).filter(
    ([, value]) => value !== null && value !== "",
  );

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {listing.title[locale] || heading}
          </h1>
          <p className="mt-space-xs font-body-md text-on-surface-variant">
            {heading}
            {location ? ` · ${location}` : ""}
          </p>
          {images.length > 0 ? (
            <ul className="mt-space-md grid grid-cols-2 gap-space-sm">
              {images.map((item) => (
                <li key={item.media_id}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- CDN URL */}
                  <img src={item.url ?? ""} alt={heading} loading="lazy" className="w-full rounded-lg object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
          {price ? (
            <p className="mt-space-sm font-title-md text-title-md text-on-surface">{price}</p>
          ) : null}
          <div className="mt-space-md">
            <ShareButtons url={canonicalUrl} locale={locale} />
          </div>
          {listing.description[locale] ? (
            <p className="mt-space-lg whitespace-pre-line font-body-md text-on-surface">
              {listing.description[locale]}
            </p>
          ) : null}
          {specs.length > 0 ? (
            <dl className="mt-space-lg grid grid-cols-1 gap-space-sm sm:grid-cols-2">
              {specs.map(([key, value]) => (
                <div key={key}>
                  <dt className="font-body-sm text-on-surface-variant">{key.replace(/_/g, " ")}</dt>
                  <dd className="font-body-md text-on-surface">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <aside className="flex flex-col gap-space-md">
          {listing.broker ? (
            <p className="font-body-md text-on-surface">
              <Link href={`/brokers/${listing.broker.slug}/`} className="text-primary underline">
                {listing.broker.name}
              </Link>
            </p>
          ) : null}
          {inquiryConfig?.enabled ? (
            <InquiryForm
              context={{ type: "LISTING", id: listing.id, label: heading }}
              config={inquiryConfig}
              locale={locale}
            />
          ) : null}
          <Link href="/boats/" className="font-body-md text-primary underline">
            ←
          </Link>
        </aside>
      </div>
    </main>
  );
}
