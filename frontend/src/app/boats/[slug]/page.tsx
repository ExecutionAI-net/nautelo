import { getT } from "@/i18n/server";
import { getRequestLocale } from "@/lib/i18n/requestLocale";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import InquiryForm from "@/components/inquiry/InquiryForm";
import BoatCard from "@/components/listings/BoatCard";
import { BoatDetailView } from "@/components/listings/BoatDetailView";
import ShareButtons from "@/components/listings/ShareButtons";
import { fetchInquiryConfig } from "@/lib/api/inquiry-config";
import { fetchPublishedListingBySlug, fetchPublishedListings, listingPath } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise.
type Params = Promise<{ slug: string }>;

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
  const canonicalUrl = `${SITE_URL}${listingPath(listing) ?? `/boats/${slug}/`}`;

  // Similar means the same kind of boat first; only when there are too few of those does it fall back to any boat.
  const boatType = typeof listing.specifications.boat_type === "string" ? listing.specifications.boat_type : "";
  const sameType = boatType ? ((await fetchPublishedListings({ page_size: "4", exclude: listing.id, boat_type: boatType }).catch(() => null))?.results ?? []) : [];
  const others = sameType.length >= 2 ? sameType : ((await fetchPublishedListings({ page_size: "4", exclude: listing.id }).catch(() => null))?.results ?? []);

  return (
    <main className="w-full bg-surface">
      <BoatDetailView
        listing={listing}
        locale={locale}
        t={t}
        headerExtra={<ShareButtons url={canonicalUrl} locale={locale} />}
        asideExtra={
          inquiryConfig?.enabled ? (
            <InquiryForm
              context={{ type: "LISTING", id: listing.id, label: heading }}
              config={inquiryConfig}
              locale={locale}
            />
          ) : null
        }
      />

      {others.length > 0 ? (
        <section className="bg-surface-container-low py-space-xl">
          <div className="mx-auto max-w-[1440px] px-margin-mobile md:px-margin lg:px-margin-desktop">
            <span className="font-label-sm uppercase tracking-widest text-secondary">{t("boat.curated")}</span>
            <h2 className="mb-space-lg font-headline-lg text-headline-lg text-primary">{t("boat.similar")}</h2>
            <ul className="grid grid-cols-1 gap-space-lg sm:grid-cols-2 lg:grid-cols-4">
              {others.map((item) => (
                <li key={item.id}>
                  <BoatCard t={t} locale={locale} listing={item} disclaimerId={`finance-disclaimer-${item.id}`} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}
