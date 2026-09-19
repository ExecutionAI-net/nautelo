import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
  const locale = DEFAULT_LOCALE;
  const [listings, inquiryConfig] = await Promise.all([
    fetchPublishedListings({ broker: slug }),
    fetchInquiryConfig(),
  ]);

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <h1 className="font-headline-md text-headline-md text-primary">{broker.name}</h1>
      {broker.website_url ? (
        <p className="mt-space-xs">
          <a
            href={broker.website_url}
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="font-body-md text-primary underline"
          >
            {broker.website_url}
          </a>
        </p>
      ) : null}

      <div className="mt-space-lg grid grid-cols-1 gap-space-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ul className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          {(listings?.results ?? []).map((listing) => (
            <li key={listing.id}>
              <BoatCard locale={locale} listing={listing} disclaimerId="finance-disclaimer" />
            </li>
          ))}
        </ul>
        {inquiryConfig?.enabled ? (
          <aside>
            <InquiryForm
              context={{ type: "BROKER", id: broker.id, label: broker.name }}
              config={inquiryConfig}
              locale={locale}
            />
          </aside>
        ) : null}
      </div>
    </main>
  );
}
