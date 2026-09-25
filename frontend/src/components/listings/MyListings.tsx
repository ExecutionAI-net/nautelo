"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useMemo, useState } from "react";

import PaidListingBuy from "@/components/listings/PaidListingBuy";
import PromotionDialog from "@/components/promotion/PromotionDialog";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import { deleteListing, fetchMyListings, fetchMyPaidListings, pauseListing, resumeListing, renewListing, type MyListingRow, type OwnedPackage, cancelCheckout, cancelPromotionCheckout } from "@/lib/api/sellerListings";

type Filter = "all" | "active" | "review" | "drafts";

const FILTERS: { key: Filter; labelKey: MessageKey; statuses: string[] }[] = [
  { key: "all", labelKey: "sell.my_listings.filter_all", statuses: [] },
  { key: "active", labelKey: "sell.my_listings.filter_published", statuses: ["PUBLISHED"] },
  { key: "review", labelKey: "sell.my_listings.filter_review", statuses: ["PENDING_APPROVAL"] },
  { key: "drafts", labelKey: "sell.my_listings.filter_drafts", statuses: ["DRAFT"] },
];

const STATUS_LABEL: Record<string, MessageKey> = {
  PUBLISHED: "sell.my_listings.status_published",
  PENDING_APPROVAL: "sell.my_listings.status_review",
  DRAFT: "sell.my_listings.status_draft",
  EXPIRED: "sell.my_listings.status_expired",
  PAUSED: "sell.my_listings.status_paused",
};

const RENEW_WINDOW_MS = 7 * 24 * 3600 * 1000;

function renewable(row: MyListingRow): boolean {
  if (row.seller_type !== "PRIVATE" || !row.expires_at) return false;
  if (row.status === "EXPIRED") return true;
  return row.status === "PUBLISHED" && new Date(row.expires_at).getTime() - Date.now() <= RENEW_WINDOW_MS;
}

function RenewPanel({ row }: { row: MyListingRow }) {
  const t = useT();
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
        {row.status === "EXPIRED"
          ? t("sell.my_listings.renew_expired_on", { date: expiry })
          : t("sell.my_listings.renew_goes_offline_on", { date: expiry })}{" "}
        {t("sell.my_listings.renew_hint")}
      </p>
      {owned && owned.length > 0 ? (
        <>
          <select
            aria-label={t("sell.my_listings.renew_select_label")}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className="rounded-lg bg-surface-container-lowest px-space-sm py-1 font-body-sm text-on-surface"
          >
            {owned.map((item) => (
              <option key={item.package} value={item.package}>
                {item.video_limit
                  ? t("sell.my_listings.renew_option_with_video", {
                      days: item.publication_days ?? 30,
                      photos: item.image_limit ?? 20,
                      video: item.video_limit,
                      count: item.count,
                    })
                  : t("sell.my_listings.renew_option", {
                      days: item.publication_days ?? 30,
                      photos: item.image_limit ?? 20,
                      count: item.count,
                    })}
              </option>
            ))}
          </select>
          <button type="button" disabled={state === "busy"} onClick={() => void renew()} className="rounded-lg bg-primary px-space-md py-space-xs font-label-md text-on-primary disabled:opacity-50">
            {row.status === "EXPIRED" ? t("sell.my_listings.renew_reactivate") : t("sell.my_listings.renew_extend")}
          </button>
        </>
      ) : owned ? (
        <PaidListingBuy />
      ) : null}
      {state === "error" ? <p role="alert" className="font-body-sm text-error">{t("sell.my_listings.renew_error")}</p> : null}
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

export function ListingCard({
  row,
  returnPath = "/dashboard/private-seller/listings/",
  onDeleted,
}: {
  row: MyListingRow;
  returnPath?: string;
  /** Notifies the parent list so its own state/counters stay in sync;
   *  the card removes itself either way. */
  onDeleted?: (id: string) => void;
}) {
  const t = useT();
  const [promoting, setPromoting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteState, setDeleteState] = useState<"idle" | "busy" | "error" | "done">("idle");
  const [pauseState, setPauseState] = useState<"idle" | "busy" | "error">("idle");
  const featuredUntil = row.featured_until ?? null; // the API sends it only while the promotion runs
  const promotable = row.status === "PUBLISHED" || row.status === "PENDING_APPROVAL";
  const price = money(row);
  const location = [row.city, row.country].filter(Boolean).join(", ");
  // Sellers often put the year in the title themselves; do not print it twice.
  const heading = row.year && !row.title.includes(String(row.year)) ? `${row.year} ${row.title}` : row.title;
  const published = row.status === "PUBLISHED" && row.slug;
  const viewHref = published ? `/boats/${row.slug}/` : `/dashboard/listings/${row.id}/preview/`;

  async function confirmDelete() {
    setConfirmingDelete(false);
    setDeleteState("busy");
    try {
      await deleteListing(row.id, row.version);
      setDeleteState("done");
      onDeleted?.(row.id);
    } catch {
      setDeleteState("error");
    }
  }

  async function togglePause() {
    setPauseState("busy");
    try {
      if (row.status === "PAUSED") await resumeListing(row.id, row.version);
      else await pauseListing(row.id, row.version);
      window.location.reload();
    } catch {
      setPauseState("error");
    }
  }

  if (deleteState === "done") return null;

  return (
    <li className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm md:flex-row">
      <Link
        href={viewHref}
        aria-label={published ? t("sell.my_listings.view_public_page") : t("sell.my_listings.preview_listing")}
        className="group relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg bg-surface-container-high md:w-72"
      >
        {row.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- owner-signed media URL
          <img src={row.image_url} alt={row.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : null}
        <span className="absolute left-2 top-2 rounded bg-surface-container-lowest/90 px-2 py-0.5 font-label-sm text-label-sm text-primary">
          {STATUS_LABEL[row.status] ? t(STATUS_LABEL[row.status]) : row.status}
        </span>
        {location ? (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-surface-container-lowest/90 px-2 py-0.5 font-label-sm text-label-sm text-primary">
            <span className="material-symbols-outlined text-xs text-secondary" aria-hidden="true">location_on</span>
            {location}
          </span>
        ) : null}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/0 font-label-md text-label-md text-on-primary opacity-0 transition-all group-hover:bg-primary/40 group-hover:opacity-100">
          {published ? t("sell.my_listings.view_public_page") : t("sell.my_listings.preview")}
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
            <Spec label={t("sell.my_listings.spec_length")} value={row.loa_m ? `${row.loa_m} m` : "-"} />
            <Spec label={t("sell.my_listings.spec_beam")} value={row.beam_m ? `${row.beam_m} m` : "-"} />
            <Spec label={t("sell.my_listings.spec_engine")} value={row.engine || "-"} />
          </div>
        ) : null}
        <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-base" aria-hidden="true">visibility</span>
          {t("sell.my_listings.views_count", { count: row.views.toLocaleString("en") })}
        </p>
        {row.promo_impressions ? (
          <p className="font-body-sm text-body-sm text-secondary">
            {t("sell.my_listings.promo_stats", {
              impressions: row.promo_impressions.toLocaleString("en"),
              clicks: (row.promo_clicks ?? 0).toLocaleString("en"),
            })}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col justify-center gap-space-xs rounded-lg bg-surface-container-low p-space-md md:w-52">
        {published ? (
          <Link href={`/boats/${row.slug}/`} className="rounded-lg bg-primary px-space-md py-space-sm text-center font-body-md text-on-primary hover:bg-primary-container">
            {t("sell.my_listings.view_public_page")}
          </Link>
        ) : null}
        <Link
          href={row.seller_type === "BROKER" ? `/dashboard/broker/fleet/${row.id}/` : `/sell/${row.id}/`}
          className={`rounded-lg px-space-md py-space-sm text-center font-body-md ${published ? "bg-surface-container-lowest text-primary" : "bg-primary text-on-primary hover:bg-primary-container"}`}
        >
          {row.status === "DRAFT" ? t("sell.my_listings.continue_editing") : t("sell.my_listings.edit_listing")}
        </Link>
        {featuredUntil ? (
          <p className="rounded-lg bg-secondary-container px-space-md py-space-xs text-center font-label-md text-on-secondary-container">
            {t("sell.my_listings.featured_until", { date: new Date(featuredUntil).toLocaleDateString("en-GB") })}
          </p>
        ) : null}
        {promotable ? (
          <button type="button" onClick={() => setPromoting(true)} className="rounded-lg bg-surface-container-lowest px-space-md py-space-sm text-center font-body-md text-primary">
            {featuredUntil ? t("sell.my_listings.extend_promotion") : t("sell.my_listings.promote_this_boat")}
          </button>
        ) : null}
        {promoting ? (
          <PromotionDialog
            listingId={row.id}
            title={row.title}
            imageUrl={row.image_url}
            returnPath={returnPath}
            live={row.status === "PUBLISHED"}
            featuredUntil={featuredUntil}
            onSkip={() => setPromoting(false)}
          />
        ) : null}
        {renewable(row) ? <RenewPanel row={row} /> : null}
        {row.status === "PUBLISHED" || row.status === "PAUSED" ? (
          <button
            type="button"
            onClick={() => void togglePause()}
            disabled={pauseState === "busy"}
            className="rounded-lg border border-outline px-space-md py-space-sm text-center font-body-md text-on-surface disabled:opacity-50"
          >
            {row.status === "PAUSED" ? t("sell.my_listings.resume_listing") : t("sell.my_listings.pause_listing")}
          </button>
        ) : null}
        {pauseState === "error" ? <p role="alert" className="font-body-sm text-error">{t("sell.my_listings.pause_error")}</p> : null}
        {confirmingDelete ? (
          <div role="dialog" aria-modal="true" aria-label={t("sell.my_listings.delete_dialog_label")} className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm">
            <p className="font-body-sm text-on-surface">{t("sell.my_listings.delete_confirm")}</p>
            <div className="mt-space-xs flex flex-col gap-space-xs">
              <button type="button" onClick={() => void confirmDelete()} className="w-full rounded-lg bg-error px-space-md py-space-xs font-label-md text-on-error">
                {t("sell.my_listings.delete_yes")}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="w-full rounded-lg border border-outline px-space-md py-space-xs font-label-md text-on-surface">
                {t("sell.my_listings.delete_cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingDelete(true)} disabled={deleteState === "busy"} className="rounded-lg px-space-md py-space-sm text-center font-body-md text-error disabled:opacity-50">
            {t("sell.my_listings.delete_listing")}
          </button>
        )}
        {deleteState === "error" ? <p role="alert" className="font-body-sm text-error">{t("sell.my_listings.delete_error")}</p> : null}
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
  eyebrow,
  heading,
  createHref = "/sell/create/",
  createLabel,
  fleet = false,
}: Props = {}) {
  const t = useT();
  const [rows, setRows] = useState<MyListingRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [checkout, setCheckout] = useState<"success" | "cancelled" | "promotion_success" | "promotion_cancelled" | null>(null);

  useEffect(() => {
    // Stripe sends the buyer back here with ?checkout=success|cancelled (payments/checkout.py)
    // or ?promotion=success|cancelled[&listing=] (promotions/checkout.py).
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("checkout");
    const promotion = params.get("promotion");
    if (outcome !== "success" && outcome !== "cancelled" && promotion !== "success" && promotion !== "cancelled") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the return flag once
    setCheckout(outcome === "success" || outcome === "cancelled" ? outcome : promotion === "success" ? "promotion_success" : "promotion_cancelled");
    const order = params.get("order");
    if (outcome === "cancelled" && order) void cancelCheckout(order).catch(() => undefined);
    const listing = params.get("listing");
    if (promotion === "cancelled" && listing) void cancelPromotionCheckout(listing).catch(() => undefined);
    params.delete("checkout");
    params.delete("order");
    params.delete("promotion");
    params.delete("listing");
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
          className={`mb-space-md rounded-lg p-space-sm font-body-md ${checkout.endsWith("success") ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-low text-on-surface-variant"}`}
        >
          {checkout === "success"
            ? t("sell.my_listings.checkout_success")
            : checkout === "promotion_success"
              ? t("sell.my_listings.checkout_promotion_success")
              : t("sell.my_listings.checkout_cancelled")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">{eyebrow ?? t("sell.my_listings.eyebrow")}</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{heading ?? t("sell.my_listings.heading")}</h1>
        </div>
        <Link href={createHref} className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container">
          {createLabel ?? t("sell.my_listings.create_new_listing")}
        </Link>
      </div>

      {fleet && rows ? (
        <div className="mt-space-lg grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label={t("sell.my_listings.kpi_vessels")}
            value={String(rows.length)}
            note={t("sell.my_listings.kpi_vessels_note", { count: counts.active })}
            icon="directions_boat"
            accent="bg-secondary"
            onClick={() => setFilter("all")}
          />
          <KpiCard
            label={t("sell.my_listings.kpi_published_value")}
            value={new Intl.NumberFormat("en", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(
              // Only EUR listings are summed - adding a USD or GBP asking
              // price to a EUR total would be a made-up number, not a total.
              rows
                .filter((row) => row.status === "PUBLISHED" && (row.currency ?? "EUR") === "EUR")
                .reduce((sum, row) => sum + (Number(row.price) || 0), 0),
            )}
            note={t("sell.my_listings.kpi_published_value_note")}
            icon="euro"
            accent="bg-secondary-fixed-dim"
            onClick={() => setFilter("active")}
          />
          <KpiCard
            label={t("sell.my_listings.kpi_in_review")}
            value={String(counts.review)}
            note={t("sell.my_listings.kpi_in_review_note")}
            icon="assignment_turned_in"
            accent="bg-tertiary-fixed-dim"
            onClick={() => setFilter("review")}
          />
          <KpiCard
            label={t("sell.my_listings.kpi_drafts")}
            value={String(counts.drafts)}
            note={t("sell.my_listings.kpi_drafts_note")}
            icon="edit_note"
            accent="bg-outline-variant"
            onClick={() => setFilter("drafts")}
          />
        </div>
      ) : null}

      {failed ? (
        <p role="alert" className="mt-space-md">
          {t("sell.my_listings.load_error")}
        </p>
      ) : rows === null ? (
        <p className="mt-space-md text-on-surface-variant">{t("sell.my_listings.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-space-md text-on-surface-variant">
          {t("sell.my_listings.empty")} <Link href={createHref} className="text-primary underline">{t("sell.my_listings.empty_create_one")}</Link>.
        </p>
      ) : (
        <>
          <div role="tablist" aria-label={t("sell.my_listings.filter_tablist")} className="mt-space-lg flex flex-wrap gap-space-xs rounded-xl bg-surface-container p-space-sm">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`rounded-full px-space-md py-space-xs font-label-md ${filter === item.key ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface-variant"}`}
              >
                {t(item.labelKey)} ({counts[item.key]})
              </button>
            ))}
          </div>
          <ul className="mt-space-md flex flex-col gap-space-md">
            {visible.map((row) => (
              <ListingCard
                key={row.id}
                row={row}
                returnPath={fleet ? "/dashboard/broker/fleet/" : undefined}
                onDeleted={(id) => setRows((current) => (current ?? []).filter((item) => item.id !== id))}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
