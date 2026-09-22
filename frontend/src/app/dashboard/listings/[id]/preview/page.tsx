"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import RequirePermission from "@/components/auth/RequirePermission";
import Link from "@/components/layout/LocaleLink";
import { BoatDetailView } from "@/components/listings/BoatDetailView";
import { useT } from "@/i18n/client";
import type { PublicListing } from "@/lib/api/listings";
import { fetchListingPreview } from "@/lib/api/sellerListings";
import { useLocale } from "@/lib/i18n/useLocale";
import { ApiError } from "@/lib/api/client";

/**
 * The owner's own preview of a listing that isn't published yet (or has a
 * pending edit) — the same visual layout as the real /boats/[slug]/ page,
 * fed from the draft instead of the approved snapshot. Never shows
 * ShareButtons or InquiryForm: nobody should be able to share or message a
 * listing that buyers cannot actually see.
 */
export default function ListingPreviewPage() {
  const params = useParams<{ id: string }>();
  const t = useT();
  const locale = useLocale();
  const [listing, setListing] = useState<PublicListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setListing(null);
    setError(null);
    fetchListingPreview(params.id)
      .then((row) => {
        if (!cancelled) setListing(row);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : t("boat.preview_error"));
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, t]);

  return (
    <RequirePermission>
      <main className="w-full bg-surface">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-space-sm bg-primary px-margin-mobile py-space-sm text-on-primary md:px-margin lg:px-margin-desktop">
          <p className="font-label-md text-label-md uppercase tracking-wider">{t("boat.preview_banner")}</p>
          <Link href={`/sell/${params.id}/`} className="font-label-md text-label-md underline">
            {t("boat.preview_back")}
          </Link>
        </div>
        {error ? (
          <p className="p-space-lg font-body-md text-error">{error}</p>
        ) : listing ? (
          <BoatDetailView listing={listing} locale={locale} t={t} />
        ) : (
          <p className="p-space-lg font-body-md text-on-surface-variant" aria-busy="true">
            {t("boat.preview_loading")}
          </p>
        )}
      </main>
    </RequirePermission>
  );
}
