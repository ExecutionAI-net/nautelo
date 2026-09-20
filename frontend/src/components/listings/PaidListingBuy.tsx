"use client";

import { useState } from "react";

import { startListingRightCheckout } from "@/lib/api/sellerListings";

/** Quantity picker + checkout button for paid listings (one-off, no expiry). */
export default function PaidListingBuy({ label = "Buy paid listings" }: { label?: string }) {
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const { checkout_url } = await startListingRightCheckout(undefined, quantity);
      window.location.assign(checkout_url);
    } catch {
      setError("Checkout is not available right now.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-xs">
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
          disabled={busy}
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
