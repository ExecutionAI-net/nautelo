"use client";

import { useEffect, useState } from "react";

import PromotionDialog from "@/components/promotion/PromotionDialog";
import { apiFetch } from "@/lib/api/client";
import { fetchMyListings, type MyListingRow } from "@/lib/api/sellerListings";

/**
 * "Promote" block for the My plan pages. Brokers pick one of their vessels; professionals
 * promote their directory profile. Buying opens the same pop-up used in the sell form.
 */
export default function PromotePanel({
  mode,
  returnPath,
  profileName,
}: {
  mode: "listings" | "profile";
  returnPath: string;
  profileName?: string;
}) {
  const [rows, setRows] = useState<MyListingRow[] | null>(null);
  const [target, setTarget] = useState<MyListingRow | "profile" | null>(null);
  const [paid, setPaid] = useState(false);
  const [seen, setSeen] = useState<{ impressions: number; clicks: number } | null>(null);

  useEffect(() => {
    // Stripe returns here with ?promotion=success.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the return flag once
    if (new URLSearchParams(window.location.search).get("promotion") === "success") setPaid(true);
    if (mode === "profile") {
      apiFetch<{ profile: { impressions: number; clicks: number } | null }>("/api/v1/promotions/stats/").then(
        (report) => setSeen(report.profile),
        () => undefined,
      );
      return;
    }
    fetchMyListings().then(
      (all) => setRows(all.filter((row) => row.seller_type === "BROKER" && (row.status === "PUBLISHED" || row.status === "PENDING_APPROVAL"))),
      () => setRows([]),
    );
  }, [mode]);

  return (
    <section aria-labelledby="promote-heading" className="rounded-xl bg-surface-container-lowest p-space-xl shadow-sm">
      <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">Promotion</span>
      <h2 id="promote-heading" className="mt-1 font-headline-md text-primary">
        {mode === "listings" ? "Put your vessels in front of more buyers" : "Put your profile in front of more customers"}
      </h2>
      <p className="mt-1 font-body-md text-on-surface-variant">
        {mode === "listings"
          ? "Featured vessels appear in the moving strip on the home page, carry a Featured badge and lead the boat listings."
          : "A featured profile carries a Featured badge and is shown first in the professionals directory."}{" "}
        Choose 1 week, 2 weeks or 1 month. The promotion starts when the {mode === "listings" ? "vessel is live" : "profile is live"}.
      </p>
      {paid ? <p role="status" className="mt-space-sm font-body-md text-secondary">Promotion paid. It starts as soon as it can go live.</p> : null}

      {mode === "profile" && seen && seen.impressions > 0 ? (
        <p className="mt-space-sm font-body-md text-secondary">
          Your profile was seen {seen.impressions.toLocaleString("en")} times while featured, with {seen.clicks.toLocaleString("en")} clicks.
        </p>
      ) : null}

      {mode === "profile" ? (
        <button
          type="button"
          onClick={() => setTarget("profile")}
          className="mt-space-md rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container"
        >
          Promote my profile
        </button>
      ) : rows === null ? (
        <p className="mt-space-md font-body-md text-on-surface-variant">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="mt-space-md font-body-md text-on-surface-variant">Add a vessel to your fleet to promote it.</p>
      ) : (
        <ul className="mt-space-md grid gap-space-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-space-md rounded-lg bg-surface-container-low p-space-sm">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-surface-container-high">
                {row.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- owner-signed media URL
                  <img alt="" src={row.image_url} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-title-md">{[row.year, row.title].filter(Boolean).join(" ")}</p>
                <p className="font-body-sm text-on-surface-variant">
                  {row.promo_impressions ? `Seen ${row.promo_impressions.toLocaleString("en")} times, ${(row.promo_clicks ?? 0).toLocaleString("en")} clicks. ` : ""}
                  {row.featured_until ? `Featured until ${new Date(row.featured_until).toLocaleDateString("en-GB")}` : row.status === "PUBLISHED" ? "Live" : "In review"}
                </p>
              </div>
              <button type="button" onClick={() => setTarget(row)} className="shrink-0 rounded-lg bg-primary px-space-md py-space-xs font-label-md text-on-primary">
                {row.featured_until ? "Extend" : "Promote"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {target ? (
        <PromotionDialog
          target={target === "profile" ? "profile" : "listing"}
          listingId={target === "profile" ? undefined : target.id}
          title={target === "profile" ? (profileName ?? "Your profile") : target.title}
          imageUrl={target === "profile" ? null : target.image_url}
          returnPath={returnPath}
          onSkip={() => setTarget(null)}
        />
      ) : null}
    </section>
  );
}
