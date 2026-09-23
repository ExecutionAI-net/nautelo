"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useState } from "react";

import AuthShell from "@/components/auth/AuthShell";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import { ApiError, apiFetch } from "@/lib/api/client";
import { fetchPricingClient, fetchServiceCategoriesClient, formatPrice, type PlanSummary, type ServiceCategoryOption } from "@/lib/api/plans";

const INPUT =
  "mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md";

const COPY: Record<"BROKER" | "PROFESSIONAL", { heading: MessageKey; name: MessageKey; pitch: MessageKey }> = {
  BROKER: { heading: "auth.org_register.broker_heading", name: "auth.org_register.broker_name", pitch: "auth.org_register.broker_pitch" },
  PROFESSIONAL: { heading: "auth.org_register.professional_heading", name: "auth.org_register.professional_name", pitch: "auth.org_register.professional_pitch" },
};

/** Organization sign-up. The person registering becomes the owner (administrator). */
export default function OrganizationRegisterForm({ orgType }: { orgType: "BROKER" | "PROFESSIONAL" }) {
  const t = useT();
  const copy = COPY[orgType];
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [plan, setPlan] = useState("");
  const [categories, setCategories] = useState<ServiceCategoryOption[]>([]);
  const [category, setCategory] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
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

  useEffect(() => {
    if (orgType !== "PROFESSIONAL") return;
    fetchServiceCategoriesClient().then(setCategories, () => setCategories([]));
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
          newsletter_opt_in: newsletterOptIn,
          country_code: country,
          plan,
          category,
        }),
      });
      setDone(true);
    } catch (caught) {
      const first = caught instanceof ApiError ? Object.values(caught.fields)[0]?.[0]?.message : undefined;
      setError(first ?? t("auth.org_register.error_fallback"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell tab="register" heading={t(copy.heading)}>
      {done ? (
        <p role="status" className="max-w-sm font-body-md">
          {t("auth.org_register.done_prefix")}{" "}
          <Link href="/login" className="text-primary underline">
            {t("auth.org_register.sign_in")}
          </Link>{" "}
          {t("auth.org_register.done_suffix")}
        </p>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="w-full space-y-space-md">
          <p className="font-body-sm text-on-surface-variant">{t(copy.pitch)}</p>
          <label className="block font-label-md text-label-md">
            {t(copy.name)}
            <input className={INPUT} required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            {t("auth.org_register.owner_full_name")}
            <input className={INPUT} autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            {t("auth.org_register.email")}
            <input className={INPUT} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            {t("auth.org_register.password")}
            <input className={INPUT} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            {t("auth.org_register.phone")}
            <input className={INPUT} type="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            {t("auth.org_register.country")}
            <select className={INPUT} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="ES">{t("auth.org_register.country_es")}</option>
              <option value="IT">{t("auth.org_register.country_it")}</option>
            </select>
          </label>
          {orgType === "PROFESSIONAL" ? (
            <label className="block font-label-md text-label-md">
              {t("auth.org_register.category_legend")}
              <select className={INPUT} required value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="" disabled>
                  {t("auth.org_register.category_placeholder")}
                </option>
                {categories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {orgType === "BROKER" ? (
            <fieldset className="space-y-space-xs">
              <legend className="font-label-md text-label-md">{t("auth.org_register.plan_legend")}</legend>
              {plans.map((item) => (
                <label key={item.slug} className="flex cursor-pointer items-center justify-between gap-space-sm rounded-lg bg-surface-container-lowest px-space-sm py-space-xs">
                  <span className="flex items-center gap-space-xs">
                    <input type="radio" name="plan" value={item.slug} checked={plan === item.slug} onChange={() => setPlan(item.slug)} />
                    <span className="font-body-md">
                      {item.name}
                      {item.listing_limit
                        ? ` ${t("auth.org_register.listings_limit", { count: item.listing_limit })}`
                        : ` ${t("auth.org_register.listings_unlimited")}`}
                      {item.seat_limit ? ` ${t("auth.org_register.seats", { count: item.seat_limit })}` : ""}
                    </span>
                  </span>
                  <span className="font-label-md font-semibold">
                    {formatPrice(item.monthly_price, item.currency)}
                    {t("auth.org_register.per_month")}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <label className="flex items-start gap-space-xs font-body-sm">
            <input type="checkbox" checked={newsletterOptIn} onChange={(e) => setNewsletterOptIn(e.target.checked)} />
            {t("auth.org_register.newsletter")}
          </label>
          {error ? (
            <p role="alert" className="font-body-sm text-error">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || (orgType === "BROKER" && !plan) || (orgType === "PROFESSIONAL" && !category)}
            className="w-full rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary disabled:opacity-50"
          >
            {t("auth.org_register.submit")}
          </button>
          <p className="font-body-sm text-on-surface-variant">
            {t("auth.org_register.looking_personal")}{" "}
            <Link href="/register" className="text-primary underline">
              {t("auth.org_register.create_personal")}
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
