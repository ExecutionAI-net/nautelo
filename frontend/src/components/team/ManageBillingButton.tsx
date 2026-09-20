"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api/client";

/** Opens the Stripe-hosted page for cards, tax details and invoices. */
export default function ManageBillingButton({ portalEndpoint }: { portalEndpoint: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const { portal_url } = await apiFetch<{ portal_url: string }>(portalEndpoint, { method: "POST" });
      window.location.assign(portal_url);
    } catch {
      setError("Billing management is not available yet. It opens once your first payment method is on file.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-space-md">
      <button
        type="button"
        disabled={busy}
        onClick={() => void open()}
        className="rounded-lg bg-surface-container-low px-space-md py-space-sm font-label-md disabled:opacity-60"
      >
        Payment methods, invoices and tax details
      </button>
      {error ? <p role="alert" className="mt-space-xs font-body-sm text-error">{error}</p> : null}
    </div>
  );
}
