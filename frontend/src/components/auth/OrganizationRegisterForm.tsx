"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AuthShell from "@/components/auth/AuthShell";
import { ApiError, apiFetch } from "@/lib/api/client";
import { fetchPricingClient, formatPrice, type PlanSummary } from "@/lib/api/plans";

const INPUT =
  "mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md";

const COPY = {
  BROKER: { heading: "Register your brokerage", name: "Brokerage name", pitch: "Create the brokerage account. You become its owner and can invite your team afterwards." },
  PROFESSIONAL: { heading: "Register your business", name: "Business name", pitch: "Create the business account for your nautical services. You become its owner and can invite your team afterwards." },
} as const;

/** Organization sign-up. The person registering becomes the owner (administrator). */
export default function OrganizationRegisterForm({ orgType }: { orgType: "BROKER" | "PROFESSIONAL" }) {
  const copy = COPY[orgType];
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [plan, setPlan] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("ES");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (orgType !== "BROKER") return;
    fetchPricingClient().then(
      (pricing) => {
        setPlans(pricing.broker_plans);
        setPlan((current) => current || pricing.broker_plans[0]?.slug || "");
      },
      () => setPlans([]),
    );
  }, [orgType]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/auth/register/organization/", {
        method: "POST",
        body: JSON.stringify({
          org_type: orgType,
          organization_name: organizationName,
          full_name: fullName,
          email,
          password,
          phone,
          country_code: country,
          plan,
        }),
      });
      setDone(true);
    } catch (caught) {
      const first = caught instanceof ApiError ? Object.values(caught.fields)[0]?.[0]?.message : undefined;
      setError(first ?? "Registration failed. Please check the details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell tab="register" heading={copy.heading}>
      {done ? (
        <p role="status" className="max-w-sm font-body-md">
          Account created. Open the verification link we emailed you, then{" "}
          <Link href="/login" className="text-primary underline">
            sign in
          </Link>{" "}
          to start your free trial and complete your profile.
        </p>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="w-full space-y-space-md">
          <p className="font-body-sm text-on-surface-variant">{copy.pitch}</p>
          <label className="block font-label-md text-label-md">
            {copy.name}
            <input className={INPUT} required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            Your full name (account owner)
            <input className={INPUT} autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            Email
            <input className={INPUT} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            Password
            <input className={INPUT} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            Business phone
            <input className={INPUT} type="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            Country
            <select className={INPUT} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="ES">Spain</option>
              <option value="IT">Italy</option>
            </select>
          </label>
          {orgType === "BROKER" ? (
            <fieldset className="space-y-space-xs">
              <legend className="font-label-md text-label-md">Plan</legend>
              {plans.map((item) => (
                <label key={item.slug} className="flex cursor-pointer items-center justify-between gap-space-sm rounded-lg bg-surface-container-lowest px-space-sm py-space-xs">
                  <span className="flex items-center gap-space-xs">
                    <input type="radio" name="plan" value={item.slug} checked={plan === item.slug} onChange={() => setPlan(item.slug)} />
                    <span className="font-body-md">
                      {item.name}
                      {item.listing_limit ? ` · ${item.listing_limit} listings` : " · unlimited listings"}
                      {item.seat_limit ? ` · ${item.seat_limit} seats` : ""}
                    </span>
                  </span>
                  <span className="font-label-md font-semibold">{formatPrice(item.monthly_price, item.currency)}/mo</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {error ? (
            <p role="alert" className="font-body-sm text-error">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy || (orgType === "BROKER" && !plan)} className="w-full rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary disabled:opacity-50">
            Create account
          </button>
          <p className="font-body-sm text-on-surface-variant">
            Looking to sell one boat?{" "}
            <Link href="/register" className="text-primary underline">
              Create a personal account
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
