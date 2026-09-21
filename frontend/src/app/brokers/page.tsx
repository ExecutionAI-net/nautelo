import { specialtyLabels } from "@/lib/i18n/specialties";
import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";

import { fetchBrokers } from "@/lib/api/brokers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Brokers",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function hrefWith(current: Record<string, string>, change: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...change })) if (value) query.set(key, value);
  const text = query.toString();
  return `/brokers/${text ? `?${text}` : ""}`;
}

export default async function BrokersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const current = { q: first(params.q), country: first(params.country), specialty: first(params.specialty) };
  const page = first(params.page);
  const brokers = await fetchBrokers({ page, ...current });
  if (brokers === null) {
    throw new Error("GET /api/v1/brokers/ is unavailable");
  }
  const countries = Object.entries(brokers.facets?.countries ?? {});
  const specialties = Object.keys(brokers.facets?.specialties ?? {});
  const countryTotal = countries.reduce((sum, [, n]) => sum + n, 0);
  const active = [
    current.country ? { label: countryName(current.country), clear: hrefWith(current, { country: "", page: "" }) } : null,
    current.specialty ? { label: current.specialty, clear: hrefWith(current, { specialty: "", page: "" }) } : null,
    current.q ? { label: `"${current.q}"`, clear: hrefWith(current, { q: "", page: "" }) } : null,
  ].filter((item): item is { label: string; clear: string } => item !== null);

  return (
    <main className="w-full bg-surface">
      <div className="relative w-full bg-surface-container-low py-space-xl overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-secondary-fixed opacity-20 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-32 w-80 h-80 rounded-full bg-primary-fixed opacity-25 blur-2xl pointer-events-none" />
        <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop relative z-10">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider mb-space-sm">
            <span className="text-secondary font-semibold">Directory</span>
            <span className="text-outline-variant">/</span>
            <span>Western Mediterranean Maritime Network</span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
            <div className="max-w-3xl">
              <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Yacht brokers</h1>
              <p className="mt-space-xs font-body-lg text-body-lg text-on-surface-variant">
                Find brokerage firms that sell boats in Spain, Italy and the rest of the Mediterranean.
              </p>
            </div>
          </div>

          <div className="mt-space-xl bg-surface-container-lowest p-space-md md:p-space-lg rounded-xl shadow-sm">
            <form method="get" action="/brokers/" className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-center">
              <div className="md:col-span-4 relative">
                <label className="sr-only" htmlFor="broker-search-input">Search by broker or company name</label>
                <div className="absolute inset-y-0 left-0 pl-space-md flex items-center pointer-events-none text-primary">
                  <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">search</span>
                </div>
                <input
                  id="broker-search-input"
                  name="q"
                  defaultValue={current.q}
                  placeholder="Search by broker, company or city..."
                  className="w-full pl-11 pr-space-md py-3 rounded-lg bg-surface-container-low text-primary font-body-md text-body-md placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:outline-none transition-colors"
                />
              </div>
              <div className="md:col-span-3 relative">
                <label className="sr-only" htmlFor="location-select">Location filter</label>
                <div className="absolute inset-y-0 left-0 pl-space-md flex items-center pointer-events-none text-secondary">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">location_on</span>
                </div>
                <select id="location-select" name="country" defaultValue={current.country} className="w-full appearance-none pl-11 pr-10 py-3 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none cursor-pointer">
                  <option value="">All locations</option>
                  {countries.map(([code, count]) => (
                    <option key={code} value={code}>
                      {countryName(code)} ({count})
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3 relative">
                <label className="sr-only" htmlFor="speciality-select">Boat speciality filter</label>
                <div className="absolute inset-y-0 left-0 pl-space-md flex items-center pointer-events-none text-secondary">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">sailing</span>
                </div>
                <select id="speciality-select" name="specialty" defaultValue={current.specialty} className="w-full appearance-none pl-11 pr-10 py-3 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none cursor-pointer">
                  <option value="">All specialities</option>
                  {specialties.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 flex">
                <button type="submit" className="w-full h-12 flex items-center justify-center gap-space-xs rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-sm font-body-md">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">tune</span>
                  Apply filters
                </button>
              </div>
            </form>
            <div className="mt-space-md pt-space-md flex flex-wrap items-center justify-between gap-space-sm">
              <div className="flex flex-wrap items-center gap-space-xs">
                {active.length > 0 ? (
                  <>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mr-space-xs">Active filters:</span>
                    {active.map((item) => (
                      <Link key={item.label} href={item.clear} className="inline-flex items-center gap-space-xs pl-space-sm pr-space-xs py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md" aria-label={`Remove ${item.label} filter`}>
                        {item.label}
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">close</span>
                      </Link>
                    ))}
                    <Link href="/brokers/" className="font-label-sm text-label-sm text-secondary hover:text-primary transition-colors underline ml-space-xs">
                      Clear all
                    </Link>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                <span className="font-spec-num text-spec-num text-primary font-semibold">Showing {brokers.count}</span>
                <span>registered brokerage firms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl">
        {countries.length > 0 ? (
          <div className="mb-space-xl p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-sm">
              <span className="p-2 rounded-lg bg-surface-container text-secondary">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">hub</span>
              </span>
              <div>
                <div className="font-title-md text-title-md text-primary">Coverage across the network</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">The countries where most of our brokerage firms are based.</div>
              </div>
            </div>
            <div className="flex flex-col gap-1 w-full md:w-72">
              <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                {countries.slice(0, 3).map(([code, count]) => (
                  <span key={code}>
                    {countryName(code)} ({count})
                  </span>
                ))}
              </div>
              <div className="w-full h-2 rounded-full bg-surface-container flex overflow-hidden">
                {countries.slice(0, 3).map(([code, count], index) => (
                  <div key={code} className={index === 0 ? "bg-primary h-full" : index === 1 ? "bg-secondary h-full" : "bg-surface-tint h-full"} style={{ width: `${(count / countryTotal) * 100}%` }} />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {brokers.results.length === 0 ? (
          <p className="font-body-md text-on-surface-variant">No brokers match these filters.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
            {brokers.results.map((broker) => (
              <li key={broker.id} className="group flex flex-col justify-between bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow p-space-lg">
                <div>
                  <div className="flex items-start gap-space-md">
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-surface-container flex items-center justify-center">
                      {broker.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" src={broker.logo_url} className="w-full h-full object-cover" />
                      ) : (
                        <span aria-hidden="true" className="font-headline-sm text-primary">{broker.name.slice(0, 1)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-headline-sm text-headline-sm text-primary tracking-tight truncate group-hover:text-secondary transition-colors">{broker.name}</h2>
                      {broker.city || broker.country_code ? (
                        <div className="mt-1 flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px] text-secondary" aria-hidden="true">location_on</span>
                          {[broker.city, broker.country_code ? countryName(broker.country_code) : ""].filter(Boolean).join(", ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {broker.cover_image_url ? (
                    <div className="mt-space-md aspect-[16/9] rounded-lg overflow-hidden bg-surface-container">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" src={broker.cover_image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ) : null}
                  {broker.tagline ? <p className="mt-space-md font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{broker.tagline}</p> : null}
                  {broker.specialties.length > 0 ? (
                    <div className="mt-space-md flex flex-wrap gap-space-xs">
                      {specialtyLabels(broker.specialties).map((tag) => (
                        <span key={tag} className="px-2.5 py-1 rounded bg-surface-container font-label-md text-label-md text-on-surface">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="mt-space-lg pt-space-md flex items-center justify-between gap-space-md bg-surface-container-low -mx-space-lg -mb-space-lg px-space-lg pb-space-md rounded-b-xl">
                  <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-secondary" aria-hidden="true">sailing</span>
                    <span className="font-spec-num text-spec-num text-primary font-semibold">{broker.listing_count}</span>
                    active {broker.listing_count === 1 ? "listing" : "listings"}
                  </span>
                  <Link href={broker.url} className="inline-flex items-center gap-1 rounded bg-primary px-space-md py-space-sm font-body-md text-on-primary hover:bg-primary-container">
                    View profile
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        {brokers.next || brokers.previous ? (
          <nav aria-label="Pagination" className="mt-space-xl flex items-center justify-center gap-space-sm">
            {brokers.previous ? (
              <Link href={hrefWith(current, { page: String(Math.max(1, Number(page || 1) - 1)) })} className="px-space-md py-space-sm rounded bg-surface-container-lowest text-primary shadow-sm">
                Previous
              </Link>
            ) : null}
            {brokers.next ? (
              <Link href={hrefWith(current, { page: String(Number(page || 1) + 1) })} className="px-space-md py-space-sm rounded bg-surface-container-lowest text-primary shadow-sm">
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
