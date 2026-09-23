"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api/client";

/**
 * A professional's profile is never listed publicly until its membership is
 * paid (professionals/billing.py), but nothing on the dashboard said so - a
 * profile could sit unlisted indefinitely with the owner assuming it was
 * live. Shown on the provider overview and the profile editor; not shown
 * once the profile is ACTIVE.
 */
export default function UnpaidNotice({ status }: { status: string | undefined }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status || status === "ACTIVE") return null;

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const { checkout_url } = await apiFetch<{ checkout_url: string }>("/api/v1/provider/membership/checkout/", {
        method: "POST",
      });
      window.location.assign(checkout_url);
    } catch {
      setError("Could not start checkout. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-space-sm rounded-xl border border-error bg-error-container p-space-md sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="font-body-md font-semibold text-error">
        Your profile is not paid, so it is not listed publicly yet. Pay now to go live.
      </p>
      <div className="flex shrink-0 items-center gap-space-sm">
        <button
          type="button"
          disabled={busy}
          onClick={() => void pay()}
          className="rounded-lg bg-error px-space-md py-space-sm font-body-md text-on-error disabled:opacity-50"
        >
          Pay now
        </button>
      </div>
      {error ? <p className="font-body-sm text-error">{error}</p> : null}
    </div>
  );
}
