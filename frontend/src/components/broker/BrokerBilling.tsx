"use client";

import { useEffect, useState } from "react";

import ManageBillingButton from "@/components/team/ManageBillingButton";
import { apiFetch } from "@/lib/api/client";
import { formatPrice } from "@/lib/api/plans";

interface Billing {
  broker_status: string;
  status: "INACTIVE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "LAPSED" | "CANCELED";
  current_period_end: string | null;
  trial_ends_at: string | null;
  trial_available: boolean;
  trial_days: number;
  past_due_since: string | null;
  plan: { name: string; monthly_price: string; currency: string } | null;
}

const STATUS_COPY: Record<Billing["status"], string> = {
  INACTIVE: "Not subscribed",
  TRIALING: "Free trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment overdue",
  LAPSED: "Suspended - payment not received",
  CANCELED: "Canceled",
};

/** Subscription status and the Stripe checkout (free trial with a card up front). */
export default function BrokerBilling({ brokerId }: { brokerId: string }) {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<Billing>(`/api/v1/brokers/${brokerId}/subscription/`).then(setBilling, () => setBilling(null));
  }, [brokerId]);

  async function start() {
    setBusy(true);
    setMessage(null);
    try {
      const { checkout_url } = await apiFetch<{ checkout_url: string }>(`/api/v1/brokers/${brokerId}/subscription/`, { method: "POST" });
      window.location.assign(checkout_url);
    } catch {
      setMessage("Checkout is not available yet. Please try again soon.");
      setBusy(false);
    }
  }

  if (!billing) return null;
  const live = billing.status === "TRIALING" || billing.status === "ACTIVE" || billing.status === "PAST_DUE";
  const date = (value: string | null) => (value ? new Date(value).toLocaleDateString("en-GB") : "");

  return (
    <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-xl shadow-sm" aria-label="Billing">
      <div className="flex flex-wrap items-center gap-space-sm">
        <span className="rounded-full bg-secondary-container px-space-sm py-0.5 font-label-sm font-semibold uppercase text-on-secondary-container">
          {STATUS_COPY[billing.status]}
        </span>
        <span className="rounded-full bg-surface-container-low px-space-sm py-0.5 font-label-sm">Brokerage: {billing.broker_status.toLowerCase()}</span>
      </div>
      {billing.status === "TRIALING" ? (
        <p className="font-body-md">
          Your free trial runs until {date(billing.trial_ends_at)}. Your card is charged
          {billing.plan ? ` ${formatPrice(billing.plan.monthly_price, billing.plan.currency)}` : ""} then, and monthly after that. Cancel any time before.
        </p>
      ) : null}
      {billing.status === "ACTIVE" && billing.current_period_end ? (
        <p className="font-body-md">Paid until {date(billing.current_period_end)}. Renews automatically.</p>
      ) : null}
      {billing.status === "PAST_DUE" ? (
        <p role="alert" className="rounded-lg bg-error-container p-space-sm font-body-sm text-on-error-container">
          We could not collect your last payment. The brokerage goes offline 24 hours after the due date unless it is paid.
        </p>
      ) : null}
      {billing.broker_status === "PENDING" || billing.broker_status === "DRAFT" ? (
        <p className="font-body-sm text-on-surface-variant">The brokerage goes live after our team has reviewed and approved it.</p>
      ) : null}
      {!live && billing.plan ? (
        <div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void start()}
            className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container disabled:opacity-50"
          >
            {billing.trial_available ? `Start your ${billing.trial_days}-day free trial` : "Subscribe"}
          </button>
          {billing.trial_available ? (
            <p className="mt-space-xs font-body-sm text-on-surface-variant">A card is required. You are not charged until the trial ends.</p>
          ) : null}
        </div>
      ) : null}
      {billing.status !== "INACTIVE" ? <ManageBillingButton portalEndpoint={`/api/v1/brokers/${brokerId}/subscription/portal/`} /> : null}
      {message ? (
        <p role="alert" className="font-body-sm text-error">
          {message}
        </p>
      ) : null}
    </section>
  );
}
