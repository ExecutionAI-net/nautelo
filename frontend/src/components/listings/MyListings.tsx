"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useMemo, useState } from "react";

import PaidListingBuy from "@/components/listings/PaidListingBuy";
import PromotionDialog from "@/components/promotion/PromotionDialog";
import { fetchMyListings, fetchMyPaidListings, renewListing, type MyListingRow, type OwnedPackage, cancelCheckout } from "@/lib/api/sellerListings";

type Filter = "all" | "active" | "review" | "drafts";

const FILTERS: { key: Filter; label: string; statuses: string[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "active", label: "Published", statuses: ["PUBLISHED"] },
  { key: "review", label: "In review", statuses: ["PENDING_APPROVAL"] },
  { key: "drafts", label: "Drafts", statuses: ["DRAFT"] },
];

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Published",
  PENDING_APPROVAL: "In review",
  DRAFT: "Draft",
  EXPIRED: "Expired",
};

const RENEW_WINDOW_MS = 7 * 24 * 3600 * 1000;

function renewable(row: MyListingRow): boolean {
  if (row.seller_type !== "PRIVATE" || !row.expires_at) return false;
  if (row.status === "EXPIRED") return true;
  return row.status === "PUBLISHED" && new Date(row.expires_at).getTime() - Date.now() <= RENEW_WINDOW_MS;
}

function RenewPanel({ row }: { row: MyListingRow }) {
  const [owned, setOwned] = useState<OwnedPackage[] | null>(null);
  const [choice, setChoice] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  useEffect(() => {
    fetchMyPaidListings().then(
      ({ results }) => {
        setOwned(results);
        setChoice((current) => current || results[0]?.package || "");
      },
      () => setOwned([]),
    );
  }, []);

  async function renew() {
    setState("busy");
    try {
      await renewListing(row.id, choice);
      window.location.reload();
    } catch {
      setState("error");
    }
  }
  const expiry = row.expires_at ? new Date(row.expires_at).toLocaleDateString("en") : "";
  return (
    <div className="mt-space-xs flex flex-col gap-space-xs rounded-lg bg-secondary-container p-space-sm text-on-secondary-container">
      <p className="font-body-sm">
        {row.status === "EXPIRED" ? `Expired on ${expiry}.` : `Goes offline on ${expiry}.`} Use a paid listing to keep it online for another period.
      </p>
      {owned && owned.length > 0 ? (
        <>
          <select
            aria-label="Paid listing to use"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className="rounded-lg bg-surface-container-lowest px-space-sm py-1 font-body-sm text-on-surface"
          >
            {owned.map((item) => (
              <option key={item.package} value={item.package}>
                {item.publication_days ?? 30} days, {item.image_limit ?? 20} photos{item.video_limit ? ` + ${item.video_limit} video` : ""} ({item.count} left)
              </option>
            ))}
          </select>
          <button type="button" disabled={state === "busy"} onClick={() => void renew()} className="rounded-lg bg-primary px-space-md py-space-xs font-label-md text-on-primary disabled:opacity-50">
            {row.status === "EXPIRED" ? "Re-activate" : "Extend"}
          </button>
        </>
      ) : owned ? (
        <PaidListingBuy />
      ) : null}
      {state === "error" ? <p role="alert" className="font-body-sm text-error">This listing could not be renewed.</p> : null}
    </div>
  );
}

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

export function ListingCard({ row, returnPath = "/dashboard/private-seller/listings/" }: { row: MyListingRow; returnPath?: string }) {
  const [promoting, setPromoting] = useState(false);
  const featuredUntil = row.featured_until ?? null; // the API sends it only while the promotion runs
  const promotable = row.status === "PUBLISHED" || row.status === "PENDING_APPROVAL";
  const price = money(row);
  const location = [row.city, row.country].filter(Boolean).join(", ");
  // Sellers often put the year in the title themselves; do not print it twice.
  const heading = row.year && !row.title.includes(String(row.year)) ? `${row.year} ${row.title}` : row.title;
  const published = row.status === "PUBLISHED" && row.slug;
  const viewHref = published ? `/boats/${row.slug}/` : `/dashboard/listings/${row.id}/preview/`;
  return (
    <li className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm md:flex-row">
      <Link
        href={viewHref}
        aria-label={published ? "View public page" : "Preview listing"}
        className="group relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg bg-surface-container-high md:w-72"
      >
        {row.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- owner-signed media URL
          <img src={row.image_url} alt={row.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
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
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/0 font-label-md text-label-md text-on-primary opacity-0 transition-all group-hover:bg-primary/40 group-hover:opacity-100">
          {published ? "View public page" : "Preview"}
        </span>
      </Link>

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
        {row.promo_impressions ? (
          <p className="font-body-sm text-body-sm text-secondary">
            Featured: seen {row.promo_impressions.toLocaleString("en")} times, {(row.promo_clicks ?? 0).toLocaleString("en")} clicks
          </p>
        ) : null}
      </div>

      <div className="flex flex-col justify-center gap-space-xs rounded-lg bg-surface-container-low p-space-md md:w-52">
        {published ? (
          <Link href={`/boats/${row.slug}/`} className="rounded-lg bg-primary px-space-md py-space-sm text-center font-body-md text-on-primary hover:bg-primary-container">
            View public page
          </Link>
        ) : null}
        <Link
          href={row.seller_type === "BROKER" ? `/dashboard/broker/fleet/${row.id}/` : `/sell/${row.id}/`}
          className={`rounded-lg px-space-md py-space-sm text-center font-body-md ${published ? "bg-surface-container-lowest text-primary" : "bg-primary text-on-primary hover:bg-primary-container"}`}
        >
          {row.status === "DRAFT" ? "Continue editing" : "Edit listing"}
        </Link>
        {featuredUntil ? (
          <p className="rounded-lg bg-secondary-container px-space-md py-space-xs text-center font-label-md text-on-secondary-container">
            Featured until {new Date(featuredUntil).toLocaleDateString("en-GB")}
          </p>
        ) : null}
        {promotable ? (
          <button type="button" onClick={() => setPromoting(true)} className="rounded-lg bg-surface-container-lowest px-space-md py-space-sm text-center font-body-md text-primary">
            {featuredUntil ? "Extend promotion" : "Promote this boat"}
          </button>
        ) : null}
        {promoting ? (
          <PromotionDialog listingId={row.id} title={row.title} imageUrl={row.image_url} returnPath={returnPath} onSkip={() => setPromoting(false)} />
        ) : null}
        {renewable(row) ? <RenewPanel row={row} /> : null}
      </div>
    </li>
  );
}

interface Props {
  eyebrow?: string;
  heading?: string;
  createHref?: string;
  createLabel?: string;
  /** Broker fleet view: only broker-owned listings, with inventory KPIs. */
  fleet?: boolean;
}

function KpiCard({ label, value, note, icon, accent, onClick }: { label: string; value: string; note: string; icon: string; accent: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-surface-container-lowest p-5 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow text-left"
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-label-sm uppercase tracking-wider text-outline">{label}</span>
          <span className="font-headline-lg text-headline-lg text-primary leading-none">{value}</span>
        </div>
        <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{icon}</span>
        </div>
      </div>
      <div className="mt-4 pt-3 text-body-sm text-outline">{note}</div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${accent}`} />
    </button>
  );
}

export default function MyListings({
  eyebrow = "Seller area / My listings",
  heading = "My listings",
  createHref = "/sell/create/",
  createLabel = "Create new listing",
  fleet = false,
}: Props = {}) {
  const [rows, setRows] = useState<MyListingRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [checkout, setCheckout] = useState<"success" | "cancelled" | null>(null);

  useEffect(() => {
    // Stripe sends the buyer back here with ?checkout=success|cancelled (payments/checkout.py).
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("checkout");
    if (outcome !== "success" && outcome !== "cancelled") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the return flag once
    setCheckout(outcome);
    const order = params.get("order");
    if (outcome === "cancelled" && order) void cancelCheckout(order).catch(() => undefined);
    params.delete("checkout");
    params.delete("order");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMyListings()
      .then((data) => {
        if (!cancelled) setRows(fleet ? data.filter((row) => row.seller_type === "BROKER") : data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fleet]);

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
      {checkout ? (
        <p
          role="status"
          className={`mb-space-md rounded-lg p-space-sm font-body-md ${checkout === "success" ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-low text-on-surface-variant"}`}
        >
          {checkout === "success"
            ? "Payment received. Your paid listing is ready: create a new listing or renew one below."
            : "Checkout cancelled. Nothing was charged."}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">{eyebrow}</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{heading}</h1>
        </div>
        <Link href={createHref} className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container">
          {createLabel}
        </Link>
      </div>

      {fleet && rows ? (
        <div className="mt-space-lg grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Vessels" value={String(rows.length)} note={`${counts.active} published`} icon="directions_boat" accent="bg-secondary" onClick={() => setFilter("all")} />
          <KpiCard
            label="Published value"
            value={new Intl.NumberFormat("en", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(
              rows.filter((row) => row.status === "PUBLISHED").reduce((sum, row) => sum + (Number(row.price) || 0), 0),
            )}
            note="Asking prices of the published vessels"
            icon="euro"
            accent="bg-secondary-fixed-dim"
            onClick={() => setFilter("active")}
          />
          <KpiCard label="In review" value={String(counts.review)} note="Waiting for staff approval" icon="assignment_turned_in" accent="bg-tertiary-fixed-dim" onClick={() => setFilter("review")} />
          <KpiCard label="Drafts" value={String(counts.drafts)} note="Not yet submitted" icon="edit_note" accent="bg-outline-variant" onClick={() => setFilter("drafts")} />
        </div>
      ) : null}

      {failed ? (
        <p role="alert" className="mt-space-md">
          Your listings could not be loaded.
        </p>
      ) : rows === null ? (
        <p className="mt-space-md text-on-surface-variant">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-space-md text-on-surface-variant">
          You have no listings yet. <Link href={createHref} className="text-primary underline">Create one</Link>.
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
              <ListingCard key={row.id} row={row} returnPath={fleet ? "/dashboard/broker/fleet/" : undefined} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
