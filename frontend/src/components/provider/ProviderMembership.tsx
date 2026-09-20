"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import { formatPrice } from "@/lib/api/plans";

interface Membership {
  profile_status: string;
  status: "INACTIVE" | "ACTIVE" | "PAST_DUE" | "LAPSED" | "CANCELED";
  current_period_end: string | null;
  past_due_since: string | null;
  plan: { name: string; tagline: string; monthly_price: string; currency: string } | null;
}

const STATUS_COPY: Record<Membership["status"], string> = {
  INACTIVE: "Not subscribed",
  ACTIVE: "Active",
  PAST_DUE: "Payment overdue",
  LAPSED: "Offline - payment not received",
  CANCELED: "Canceled",
};

export default function ProviderMembership() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<Membership>("/api/v1/provider/membership/").then(setMembership, () =>
      setError("Create your professional profile first, then come back to activate it."),
    );
  }, []);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const { checkout_url } = await apiFetch<{ checkout_url: string }>("/api/v1/provider/membership/checkout/", {
        method: "POST",
      });
      window.location.assign(checkout_url);
    } catch {
      setError("Membership sign-up is not open yet. Please try again soon.");
      setBusy(false);
    }
  }

  if (error && !membership) return <p role="alert" className="font-body-md text-on-surface-variant">{error}</p>;
  if (!membership) return <p className="font-body-md text-on-surface-variant">Loading...</p>;

  const live = membership.status === "ACTIVE" || membership.status === "PAST_DUE";
  return (
    <div className="flex flex-col gap-space-lg">
      <div>
        <span className="font-label-sm uppercase tracking-wider text-secondary font-semibold">Service provider / Membership</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Membership</h1>
        <p className="mt-space-xs font-body-md text-on-surface-variant">
          Your profile is listed in the NAUTA directory while your monthly membership is paid. It goes live automatically once the payment is confirmed.
        </p>
      </div>

      <section className="rounded-xl bg-surface-container-lowest p-space-xl shadow-sm flex flex-col gap-space-md">
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm uppercase font-semibold">
            {STATUS_COPY[membership.status]}
          </span>
          <span className="px-space-sm py-0.5 rounded-full bg-surface-container-low text-on-surface font-label-sm">
            Profile: {membership.profile_status.toLowerCase()}
          </span>
        </div>
        {membership.plan ? (
          <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-space-sm">
            <div>
              <h2 className="font-headline-md text-headline-md text-primary">{membership.plan.name}</h2>
              <p className="font-body-md text-on-surface-variant">{membership.plan.tagline}</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-headline-lg text-headline-lg text-primary">
                {formatPrice(membership.plan.monthly_price, membership.plan.currency)}
              </span>
              <span className="font-body-sm text-on-surface-variant">/ month</span>
            </div>
          </div>
        ) : (
          <p className="font-body-md text-on-surface-variant">Membership sign-up will open soon.</p>
        )}
        {membership.status === "PAST_DUE" ? (
          <p role="alert" className="rounded-lg bg-error-container p-space-sm font-body-sm text-on-error-container">
            We could not collect your last payment. Your profile goes offline 24 hours after the due date unless it is paid.
          </p>
        ) : null}
        {membership.current_period_end && live ? (
          <p className="font-body-sm text-on-surface-variant">
            Paid until {new Date(membership.current_period_end).toLocaleDateString("en")}. Renews automatically each month.
          </p>
        ) : null}
        {!live && membership.plan ? (
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void subscribe()}
              className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container disabled:opacity-50"
            >
              {membership.status === "INACTIVE" ? "Subscribe and go live" : "Pay and bring my profile back"}
            </button>
          </div>
        ) : null}
        {error ? <p role="alert" className="font-body-sm text-error">{error}</p> : null}
      </section>
    </div>
  );
}
