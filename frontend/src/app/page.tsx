import Link from "next/link";

import BoatCard from "@/components/listings/BoatCard";
import { fetchPublishedListings, type PublicListing } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";
import { tHome } from "@/lib/i18n/home";

export const dynamic = "force-dynamic";

async function latest(): Promise<PublicListing[]> {
  try {
    const page = await fetchPublishedListings({ page_size: "6" });
    return page?.results ?? [];
  } catch {
    // The landing page must render even when the catalogue is unavailable.
    return [];
  }
}

export default async function Home() {
  const locale = DEFAULT_LOCALE;
  const boats = await latest();
  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <h1 className="font-headline-lg text-headline-lg text-primary">{tHome(locale, "home.title")}</h1>
      <p className="mt-space-sm max-w-2xl font-body-lg text-on-surface-variant">{tHome(locale, "home.intro")}</p>
      <div className="mt-space-md flex flex-wrap gap-space-sm">
        <Link href="/boats/" className="rounded-lg bg-primary px-space-md py-space-sm text-on-primary">
          {tHome(locale, "home.browse")}
        </Link>
        <Link href="/sell/" className="rounded-lg border border-outline-variant px-space-md py-space-sm text-primary">
          {tHome(locale, "home.sell")}
        </Link>
        <Link href="/services/professionals/" className="rounded-lg border border-outline-variant px-space-md py-space-sm text-primary">
          {tHome(locale, "home.services")}
        </Link>
      </div>

      {boats.length > 0 ? (
        <section className="mt-space-xl" aria-labelledby="latest-heading">
          <h2 id="latest-heading" className="font-title-lg text-title-lg text-primary">
            {tHome(locale, "home.latest")}
          </h2>
          <ul className="mt-space-md grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3">
            {boats.map((listing) => (
              <li key={listing.id}>
                <BoatCard locale={locale} listing={listing} disclaimerId="finance-disclaimer" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
