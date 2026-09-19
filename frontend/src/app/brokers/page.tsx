import type { Metadata } from "next";
import Link from "next/link";

import PageBand from "@/components/layout/PageBand";
import { fetchBrokers } from "@/lib/api/brokers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Brokers",
  alternates: { canonical: "/brokers/" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BrokersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Array.isArray(params.page) ? params.page[0] : params.page;
  const brokers = await fetchBrokers(page);
  if (brokers === null) {
    throw new Error("GET /api/v1/brokers/ is unavailable");
  }
  return (
    <main className="w-full bg-surface">
      <PageBand
        eyebrow="Directory / Western Mediterranean maritime network"
        title="Yacht brokers"
        subtitle="Connect with yacht brokers and brokerage firms across Spain and Italy."
      />
      <div className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin lg:px-margin-desktop">
        {brokers.results.length === 0 ? (
          <p className="font-body-md text-on-surface-variant">No brokers yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-space-lg sm:grid-cols-2 lg:grid-cols-3">
            {brokers.results.map((broker) => (
              <li key={broker.id} className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
                <div>
                  <p className="font-headline-sm text-headline-sm text-primary">{broker.name}</p>
                  <p className="mt-space-xs font-body-sm text-on-surface-variant">
                    {broker.listing_count} active {broker.listing_count === 1 ? "listing" : "listings"}
                  </p>
                </div>
                <Link
                  href={broker.url}
                  className="inline-flex items-center justify-center self-start rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary hover:bg-primary-container"
                >
                  View profile
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
