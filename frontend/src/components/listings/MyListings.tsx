"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchMyListings, type MyListingRow } from "@/lib/api/sellerListings";

type Filter = "all" | "active" | "review" | "drafts";

const FILTERS: { key: Filter; label: string; statuses: string[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "active", label: "Active", statuses: ["PUBLISHED"] },
  { key: "review", label: "In review", statuses: ["PENDING_APPROVAL"] },
  { key: "drafts", label: "Drafts", statuses: ["DRAFT"] },
];

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Publicly live",
  PENDING_APPROVAL: "In review",
  DRAFT: "Draft",
};

function money(row: MyListingRow): string | null {
  if (!row.price) return null;
  const amount = Number(row.price);
  if (!Number.isFinite(amount)) return null;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: row.currency || "EUR", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${row.currency} ${row.price}`;
  }
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-label-sm text-label-sm uppercase text-outline">{label}</span>
      <span className="font-body-md text-body-md text-on-surface">{value}</span>
    </div>
  );
}

function ListingCard({ row }: { row: MyListingRow }) {
  const price = money(row);
  const location = [row.city, row.country].filter(Boolean).join(", ");
  const heading = [row.year, row.title].filter(Boolean).join(" ");
  const published = row.status === "PUBLISHED" && row.slug;
  return (
    <li className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm md:flex-row">
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg bg-surface-container-high md:w-72">
        {row.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- owner-signed media URL
          <img src={row.image_url} alt={row.title} className="h-full w-full object-cover" />
        ) : null}
        <span className="absolute left-2 top-2 rounded bg-surface-container-lowest/90 px-2 py-0.5 font-label-sm text-label-sm text-primary">
          {STATUS_LABEL[row.status] ?? row.status}
        </span>
        {location ? (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-surface-container-lowest/90 px-2 py-0.5 font-label-sm text-label-sm text-primary">
            <span className="material-symbols-outlined text-xs text-secondary" aria-hidden="true">location_on</span>
            {location}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-space-sm">
        {row.boat_type ? (
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{row.boat_type}</span>
        ) : null}
        <h2 className="font-headline-sm text-headline-sm text-primary">{heading}</h2>
        {price ? <p className="font-spec-num text-headline-sm font-semibold text-primary">{price}</p> : null}
        {row.loa_m || row.beam_m || row.engine ? (
          <div className="grid grid-cols-3 gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
            <Spec label="Length" value={row.loa_m ? `${row.loa_m} m` : "-"} />
            <Spec label="Beam" value={row.beam_m ? `${row.beam_m} m` : "-"} />
            <Spec label="Engine" value={row.engine || "-"} />
          </div>
        ) : null}
        <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-base" aria-hidden="true">visibility</span>
          {row.views.toLocaleString("en")} views
        </p>
      </div>

      <div className="flex flex-col justify-center gap-space-xs rounded-lg bg-surface-container-low p-space-md md:w-52">
        {published ? (
          <Link href={`/boats/${row.slug}/`} className="rounded-lg bg-primary px-space-md py-space-sm text-center font-body-md text-on-primary hover:bg-primary-container">
            View public page
          </Link>
        ) : null}
        <Link
          href={`/sell/${row.id}/`}
          className={`rounded-lg px-space-md py-space-sm text-center font-body-md ${published ? "bg-surface-container-lowest text-primary" : "bg-primary text-on-primary hover:bg-primary-container"}`}
        >
          {row.status === "DRAFT" ? "Continue editing" : "Edit listing"}
        </Link>
      </div>
    </li>
  );
}

export default function MyListings() {
  const [rows, setRows] = useState<MyListingRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    fetchMyListings()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: rows?.length ?? 0, active: 0, review: 0, drafts: 0 };
    for (const row of rows ?? []) {
      for (const item of FILTERS) {
        if (item.statuses.includes(row.status)) result[item.key] += 1;
      }
    }
    return result;
  }, [rows]);

  const visible = useMemo(() => {
    const statuses = FILTERS.find((item) => item.key === filter)?.statuses ?? [];
    return (rows ?? []).filter((row) => statuses.length === 0 || statuses.includes(row.status));
  }, [rows, filter]);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Bespoke maritime portfolio</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">My vessel listings</h1>
        </div>
        <Link href="/sell/create/" className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container">
          Create new listing
        </Link>
      </div>

      {failed ? (
        <p role="alert" className="mt-space-md">
          Your listings could not be loaded.
        </p>
      ) : rows === null ? (
        <p className="mt-space-md text-on-surface-variant">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-space-md text-on-surface-variant">
          You have no listings yet. <Link href="/sell/create/" className="text-primary underline">Create one</Link>.
        </p>
      ) : (
        <>
          <div role="tablist" aria-label="Filter listings" className="mt-space-lg flex flex-wrap gap-space-xs rounded-xl bg-surface-container p-space-sm">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`rounded-full px-space-md py-space-xs font-label-md ${filter === item.key ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface-variant"}`}
              >
                {item.label} ({counts[item.key]})
              </button>
            ))}
          </div>
          <ul className="mt-space-md flex flex-col gap-space-md">
            {visible.map((row) => (
              <ListingCard key={row.id} row={row} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
