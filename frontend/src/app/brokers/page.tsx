import type { Metadata } from "next";
import Link from "next/link";

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
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <h1 className="font-headline-md text-headline-md text-primary">Brokers</h1>
      {brokers.results.length === 0 ? (
        <p className="mt-space-lg font-body-md text-on-surface-variant">No brokers yet.</p>
      ) : (
        <ul className="mt-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3">
          {brokers.results.map((broker) => (
            <li key={broker.id} className="rounded-xl border border-outline-variant p-space-md">
              <Link href={broker.url} className="font-title-md text-title-md text-primary underline">
                {broker.name}
              </Link>
              <p className="font-body-sm text-on-surface-variant">
                {broker.listing_count} {broker.listing_count === 1 ? "boat" : "boats"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
