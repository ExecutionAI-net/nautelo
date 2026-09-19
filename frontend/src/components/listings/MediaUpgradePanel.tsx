"use client";

import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { applyMediaUpgrade, startMediaUpgradeCheckout } from "@/lib/api/sellerListings";

/** Spec 23/24: apply an already-owned upgrade to this listing, or buy one. */
export default function MediaUpgradePanel({
  listingId,
  onApplied,
  returnUrl = "/sell/",
}: {
  listingId: string;
  onApplied: () => void;
  returnUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [canBuy, setCanBuy] = useState(false);
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    setMessage(null);
    try {
      await applyMediaUpgrade(listingId);
      setMessage("Upgrade applied. Your media limits are now higher.");
      setCanBuy(false);
      onApplied();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "media_upgrade_unavailable") {
        setMessage("You have no unused media upgrade.");
        setCanBuy(true);
      } else if (caught instanceof ApiError && caught.code === "media_upgrade_already_applied") {
        setMessage("This listing already has the upgrade.");
      } else {
        setMessage("The upgrade could not be applied.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function buy() {
    setBusy(true);
    try {
      const session = await startMediaUpgradeCheckout(listingId, returnUrl);
      window.location.assign(session.checkout_url);
    } catch {
      setMessage("Checkout is not available right now.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-space-md">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-primary underline">
        Need more photos or videos?
      </button>
      {open ? (
        <div role="region" aria-label="Media upgrade" className="mt-space-sm rounded-lg border border-outline-variant p-space-sm">
          <p className="font-body-md">
            A media upgrade raises this listing&apos;s image and video limits.
          </p>
          <div className="mt-space-sm flex gap-space-sm">
            <button type="button" disabled={busy} onClick={() => void apply()}>
              Apply my upgrade
            </button>
            {canBuy ? (
              <button type="button" disabled={busy} onClick={() => void buy()}>
                Buy an upgrade
              </button>
            ) : null}
          </div>
          {message ? (
            <p role="status" className="mt-space-xs font-body-sm">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
