"use client";

import { useEffect, useState } from "react";

import { fetchPricingClient, formatPrice, type ListingPackage } from "@/lib/api/plans";
import { startListingRightCheckout } from "@/lib/api/sellerListings";

/** Package picker + quantity + checkout for paid listings (one-off). */
export default function PaidListingBuy({ label = "Buy paid listings" }: { label?: string }) {
  const [packages, setPackages] = useState<ListingPackage[]>([]);
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPricingClient().then(
      (pricing) => {
        const list = pricing.listing_packages ?? [];
        setPackages(list);
        setSelected((current) => current || list[0]?.slug || "");
      },
      () => setPackages([]),
    );
  }, []);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const { checkout_url } = await startListingRightCheckout(undefined, quantity, selected);
      window.location.assign(checkout_url);
    } catch {
      setError("Checkout is not available right now.");
      setBusy(false);
    }
  }

  if (packages.length === 0) {
    return <p className="font-body-sm text-on-surface-variant">Paid listings are not on sale yet.</p>;
  }

  return (
    <div className="flex flex-col gap-space-sm">
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="sr-only">Package</legend>
        {packages.map((pkg) => (
          <label
            key={pkg.slug}
            className={`flex cursor-pointer items-center justify-between gap-space-sm rounded-lg px-space-sm py-space-xs ${selected === pkg.slug ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-lowest text-on-surface"}`}
          >
            <span className="flex items-center gap-space-xs">
              <input type="radio" name="listing-package" value={pkg.slug} checked={selected === pkg.slug} onChange={() => setSelected(pkg.slug)} />
              <span className="font-body-md">
                {pkg.name} · {pkg.publication_days} days · {pkg.image_limit} photos{pkg.video_limit ? ` + ${pkg.video_limit} video` : ""}
              </span>
            </span>
            <span className="font-label-md font-semibold">{formatPrice(pkg.amount, pkg.currency)}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-space-sm">
        <label className="font-label-sm text-on-surface-variant" htmlFor="paid-listing-quantity">
          Quantity
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
          {label}
        </button>
      </div>
      {error ? <p role="alert" className="font-body-sm text-error">{error}</p> : null}
    </div>
  );
}
