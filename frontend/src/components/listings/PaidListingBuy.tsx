"use client";

import { useEffect, useId, useState } from "react";

import { useLocaleOrDefault } from "@/components/layout/LocaleContext";
import { useT } from "@/i18n/client";
import { fetchPricingClient, formatPrice, type ListingPackage } from "@/lib/api/plans";
import { startListingRightCheckout } from "@/lib/api/sellerListings";

/** Package picker + quantity + checkout for paid listings (one-off). */
export default function PaidListingBuy({ label }: { label?: string }) {
  const t = useT();
  const locale = useLocaleOrDefault();
  const [packages, setPackages] = useState<ListingPackage[]>([]);
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Two pickers can share a page (the "package you picked" card and the media step); a
  // radio group name per instance keeps one from unchecking the other.
  const group = useId();

  useEffect(() => {
    // The pricing page sends the seller here with the package they chose (?package=<slug>).
    const wanted = new URLSearchParams(window.location.search).get("package") ?? "";
    fetchPricingClient(locale).then(
      (pricing) => {
        const list = pricing.listing_packages ?? [];
        setPackages(list);
        setSelected((current) => current || (list.some((pkg) => pkg.slug === wanted) ? wanted : "") || list[0]?.slug || "");
      },
      () => setPackages([]),
    );
  }, [locale]);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const { checkout_url } = await startListingRightCheckout(undefined, quantity, selected);
      window.location.assign(checkout_url);
    } catch {
      setError(t("sell.package.checkout_unavailable"));
      setBusy(false);
    }
  }

  if (packages.length === 0) {
    return <p className="font-body-sm text-on-surface-variant">{t("sell.package.none")}</p>;
  }

  return (
    <div className="flex flex-col gap-space-sm">
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="sr-only">{t("sell.package.legend")}</legend>
        {packages.map((pkg) => (
          <label
            key={pkg.slug}
            className={`flex cursor-pointer items-center justify-between gap-space-sm rounded-lg px-space-sm py-space-xs ${selected === pkg.slug ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-lowest text-on-surface"}`}
          >
            <span className="flex items-center gap-space-xs">
              <input type="radio" name={`listing-package${group}`} value={pkg.slug} checked={selected === pkg.slug} onChange={() => setSelected(pkg.slug)} />
              <span className="font-body-md">
                {pkg.name} · {t("sell.package.summary", { days: pkg.publication_days, photos: pkg.image_limit })}
                {pkg.video_limit ? ` + ${t("sell.package.video", { count: pkg.video_limit })}` : ""}
              </span>
            </span>
            <span className="font-label-md font-semibold">{formatPrice(pkg.amount, pkg.currency)}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-space-sm">
        <label className="font-label-sm text-on-surface-variant" htmlFor="paid-listing-quantity">
          {t("sell.package.quantity")}
        </label>
        <input
          id="paid-listing-quantity"
          type="number"
          min={1}
          max={20}
          value={quantity}
          onChange={(event) => setQuantity(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
          className="w-16 rounded-lg bg-surface-container-lowest px-space-sm py-1 font-body-md text-on-surface"
        />
        <button
          type="button"
          disabled={busy || !selected}
          onClick={() => void buy()}
          className="rounded-lg bg-primary px-space-md py-space-xs font-label-md text-on-primary hover:bg-primary-container disabled:opacity-50"
        >
          {label ?? t("sell.package.buy")}
        </button>
      </div>
      {error ? <p role="alert" className="font-body-sm text-error">{error}</p> : null}
    </div>
  );
}
