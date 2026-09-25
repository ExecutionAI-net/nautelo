"use client";

import PromotePanel from "@/components/promotion/PromotePanel";
import { useEffect, useRef, useState } from "react";

import ManageBillingButton from "@/components/team/ManageBillingButton";
import { useCheckoutReturn } from "@/lib/api/checkoutReturn";
import { apiFetch } from "@/lib/api/client";
import { formatPrice } from "@/lib/api/plans";

interface Membership {
  profile_status: string;
  trial_ends_at: string | null;
  trial_available: boolean;
  trial_days: number;
  status: "INACTIVE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "LAPSED" | "CANCELED";
  current_period_end: string | null;
  past_due_since: string | null;
  cancel_at_period_end?: boolean;
  plan: { name: string; tagline: string; monthly_price: string; currency: string } | null;
}

const STATUS_COPY: Record<Membership["status"], string> = {
  INACTIVE: "Not subscribed",
  TRIALING: "Free trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment overdue",
  LAPSED: "Offline - payment not received",
  CANCELED: "Canceled",
};

const isLive = (status: Membership["status"]) => status === "TRIALING" || status === "ACTIVE" || status === "PAST_DUE";

export default function ProviderMembership() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const returned = useCheckoutReturn();
  const polls = useRef(0);

  useEffect(() => {
    apiFetch<Membership>("/api/v1/provider/membership/").then(setMembership, () =>
      setError("Create your professional profile first, then come back to activate it."),
    );
  }, []);

  useEffect(() => {
    // Back from a successful checkout, Stripe's webhook may still be in flight:
    // re-read the status for up to half a minute until the membership is live.
    if (returned !== "success" || !membership || isLive(membership.status) || polls.current >= 10) return;
    const timer = setTimeout(() => {
      polls.current += 1;
      apiFetch<Membership>("/api/v1/provider/membership/").then(setMembership, () => undefined);
    }, 3000);
    return () => clearTimeout(timer);
  }, [returned, membership]);

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

  const live = isLive(membership.status);
  return (
    <div className="flex flex-col gap-space-lg">
      {returned ? (
        <p
          role="status"
          className={`rounded-lg p-space-sm font-body-md ${returned === "success" ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-low text-on-surface-variant"}`}
        >
          {returned === "success"
            ? live
              ? "Thank you. Your membership is set up: the details are below."
              : "Thank you. Your profile goes live as soon as Stripe confirms the payment, usually within a minute."
            : "Checkout cancelled. Nothing was charged."}
        </p>
      ) : null}
      <div>
        <span className="font-label-sm uppercase tracking-wider text-secondary font-semibold">Service provider / My plan</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">My plan</h1>
        <p className="mt-space-xs font-body-md text-on-surface-variant">
          Your profile is listed in the Nautelo directory while your monthly membership is paid. It goes live the moment your payment is confirmed.
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
        {membership.status === "TRIALING" && membership.trial_ends_at && membership.cancel_at_period_end ? (
          <p role="status" className="font-body-sm text-on-surface-variant">
            Cancellation scheduled: your free trial ends on {new Date(membership.trial_ends_at).toLocaleDateString("en-GB")} and your
            card will not be charged. You can resume the membership from Manage billing until then.
          </p>
        ) : null}
        {membership.status === "TRIALING" && membership.trial_ends_at && !membership.cancel_at_period_end ? (
          <p className="font-body-sm text-on-surface-variant">
            Free trial until {new Date(membership.trial_ends_at).toLocaleDateString("en-GB")}. Your card is charged then, and monthly after that. Cancel any time before.
          </p>
        ) : null}
        {membership.current_period_end && live && membership.status !== "TRIALING" && membership.cancel_at_period_end ? (
          <p role="status" className="font-body-sm text-on-surface-variant">
            Cancellation scheduled: your membership ends on {new Date(membership.current_period_end).toLocaleDateString("en-GB")}. You keep
            full access until then and can resume it from Manage billing.
          </p>
        ) : null}
        {membership.current_period_end && live && membership.status !== "TRIALING" && !membership.cancel_at_period_end ? (
          <p className="font-body-sm text-on-surface-variant">
            Paid until {new Date(membership.current_period_end).toLocaleDateString("en-GB")}. Renews automatically each month.
          </p>
        ) : null}
        {!live && !membership.plan ? (
          <p role="status" className="rounded-lg bg-surface-container-low p-space-md font-body-md text-on-surface-variant">
            Membership is not open yet. We will let you know as soon as plans are available.
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
              {membership.status === "INACTIVE" ? (membership.trial_available ? `Start your ${membership.trial_days}-day free trial` : "Subscribe") : "Pay and bring my profile back"}
            </button>
          </div>
        ) : null}
        {membership.status !== "INACTIVE" ? <ManageBillingButton portalEndpoint="/api/v1/provider/membership/portal/" /> : null}
        {error ? <p role="alert" className="font-body-sm text-error">{error}</p> : null}
      </section>

      <PromotePanel mode="profile" returnPath="/dashboard/service-provider/membership/" />
    </div>
  );
}
