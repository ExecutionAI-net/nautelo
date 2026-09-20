import { getRequestLocale } from "@/lib/i18n/requestLocale";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ContactPanel from "@/components/contact/ContactPanel";
import InquiryForm from "@/components/inquiry/InquiryForm";
import BoatCard from "@/components/listings/BoatCard";
import { fetchBroker } from "@/lib/api/brokers";
import { fetchInquiryConfig } from "@/lib/api/inquiry-config";
import { fetchPublishedListings } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const broker = await fetchBroker(slug);
  return {
    title: broker?.name ?? "Broker",
    alternates: { canonical: `/brokers/${slug}/` },
  };
}

export default async function BrokerPage({ params }: { params: Params }) {
  const { slug } = await params;
  const broker = await fetchBroker(slug);
  if (!broker) {
    notFound();
  }
  const locale = await getRequestLocale();
  const [listings, inquiryConfig] = await Promise.all([
    fetchPublishedListings({ broker: slug }),
    fetchInquiryConfig(),
  ]);

  return (
    <main className="w-full bg-surface">
      <div className="relative w-full bg-surface-container-low py-space-xl overflow-hidden">
        {broker.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={broker.cover_image_url} className="absolute inset-0 h-full w-full object-cover opacity-25" />
        ) : null}
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-secondary-fixed opacity-20 blur-3xl pointer-events-none" />
        <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop relative z-10 flex flex-col gap-space-lg lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-space-lg">
            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-surface-container-lowest shadow-sm flex items-center justify-center">
              {broker.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={broker.logo_url} className="w-full h-full object-cover" />
              ) : (
                <span aria-hidden="true" className="font-headline-md text-headline-md text-primary">{broker.name.slice(0, 1)}</span>
              )}
            </div>
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <span className="text-secondary font-semibold">Directory</span>
                <span className="text-outline-variant">/</span>
                <span>Yacht broker</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{broker.name}</h1>
              {broker.city || broker.country_code ? (
                <p className="flex items-center gap-1 font-body-md text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">location_on</span>
                  {[broker.city, broker.country_code].filter(Boolean).join(", ")}
                </p>
              ) : null}
              {broker.tagline ? <p className="max-w-2xl font-body-lg text-body-lg text-on-surface-variant">{broker.tagline}</p> : null}
              {broker.website_url ? (
                <a href={broker.website_url} rel="noopener noreferrer nofollow" target="_blank" className="font-body-md text-primary underline">
                  {broker.website_url}
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-space-md bg-surface-container-lowest rounded-xl shadow-sm px-space-lg py-space-md">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Active listings</span>
              <span className="font-headline-md text-headline-md text-primary">{broker.listing_count}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin lg:px-margin-desktop">
      {broker.about || broker.specialties.length > 0 ? (
        <section className="mb-space-xl rounded-xl bg-surface-container-lowest p-space-lg shadow-sm" aria-labelledby="about-heading">
          <h2 id="about-heading" className="font-headline-sm text-headline-sm text-primary">About {broker.name}</h2>
          {broker.about ? <p className="mt-space-sm whitespace-pre-line font-body-md text-on-surface-variant">{broker.about}</p> : null}
          {broker.specialties.length > 0 ? (
            <div className="mt-space-md flex flex-wrap gap-space-xs">
              {broker.specialties.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded bg-surface-container font-label-md text-label-md text-on-surface">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      <h2 className="mb-space-md font-headline-sm text-headline-sm text-primary">Active listings ({broker.listing_count})</h2>
      <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ul className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-3">
          {(listings?.results ?? []).map((listing) => (
            <li key={listing.id}>
              <BoatCard locale={locale} listing={listing} disclaimerId="finance-disclaimer" />
            </li>
          ))}
        </ul>
        <aside className="flex flex-col gap-space-lg">
          <ContactPanel targetType="broker" targetId={broker.id} locale={locale} />
          {inquiryConfig?.enabled ? (
            <InquiryForm
              context={{ type: "BROKER", id: broker.id, label: broker.name }}
              config={inquiryConfig}
              locale={locale}
            />
          ) : null}
        </aside>
      </div>
      </div>
    </main>
  );
}
