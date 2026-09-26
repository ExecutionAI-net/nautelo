"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useState } from "react";

import AuthShell from "@/components/auth/AuthShell";
import NewPasswordFields from "@/components/forms/NewPasswordFields";
import PhoneNumberField from "@/components/forms/PhoneNumberField";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import { ApiError, apiFetch } from "@/lib/api/client";
import {
  fetchBrokerRolesClient,
  fetchPricingClient,
  fetchServiceCategoriesClient,
  formatPrice,
  type BrokerRoleOption,
  type PlanSummary,
  type ServiceCategoryOption,
} from "@/lib/api/plans";
import { uploadRegistrationDocument, uploadRegistrationLogo } from "@/lib/api/orgRegistrationUploads";
import FileInput from "@/components/forms/FileInput";

const INPUT =
  "mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md";

const MAX_CATEGORIES = 2;

const COPY: Record<"BROKER" | "PROFESSIONAL", { heading: MessageKey; name: MessageKey; pitch: MessageKey }> = {
  BROKER: { heading: "auth.org_register.broker_heading", name: "auth.org_register.broker_name", pitch: "auth.org_register.broker_pitch" },
  PROFESSIONAL: { heading: "auth.org_register.professional_heading", name: "auth.org_register.professional_name", pitch: "auth.org_register.professional_pitch" },
};

function newRegistrationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Organization sign-up. The person registering becomes the owner (administrator). */
export default function OrganizationRegisterForm({ orgType }: { orgType: "BROKER" | "PROFESSIONAL" }) {
  const t = useT();
  const copy = COPY[orgType];
  const [registrationId] = useState(newRegistrationId);
  const [step, setStep] = useState<1 | 2>(1);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [plan, setPlan] = useState("");
  const [categories, setCategories] = useState<ServiceCategoryOption[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [roles, setRoles] = useState<BrokerRoleOption[]>([]);
  const [role, setRole] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [country, setCountry] = useState("ES");
  const [logoKey, setLogoKey] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const [logoState, setLogoState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [documentKeys, setDocumentKeys] = useState<string[]>([]);
  const [documentState, setDocumentState] = useState<"idle" | "uploading" | "done" | "error">("idle");
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
    fetchBrokerRolesClient().then(setRoles, () => setRoles([]));
  }, [orgType]);

  useEffect(() => {
    if (orgType !== "PROFESSIONAL") return;
    fetchServiceCategoriesClient().then(setCategories, () => setCategories([]));
  }, [orgType]);

  function toggleCategory(slug: string) {
    setSelectedCategories((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      if (current.length >= MAX_CATEGORIES) return current;
      return [...current, slug];
    });
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoState("uploading");
    try {
      const key = await uploadRegistrationLogo(registrationId, file);
      setLogoKey(key);
      setLogoFileName(file.name);
      setLogoState("done");
    } catch {
      setLogoState("error");
    }
  }

  function removeLogo() {
    setLogoKey("");
    setLogoFileName("");
    setLogoState("idle");
  }

  async function handleDocumentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setDocumentState("uploading");
    try {
      const key = await uploadRegistrationDocument(registrationId, file);
      setDocumentKeys((current) => [...current, key]);
      setDocumentState("done");
    } catch {
      setDocumentState("error");
    } finally {
      event.target.value = "";
    }
  }

  function removeDocument(key: string) {
    setDocumentKeys((current) => current.filter((item) => item !== key));
  }

  const step1Valid = fullName.trim() !== "" && email.trim() !== "" && password.trim() !== "" && phone.trim() !== "";

  const brokerValid =
    orgType !== "BROKER" ||
    (Boolean(plan) && tradingName.trim() !== "" && role !== "" && logoKey !== "" && documentKeys.length > 0);
  const professionalValid = orgType !== "PROFESSIONAL" || selectedCategories.length > 0;
  const canSubmit = organizationName.trim() !== "" && step1Valid && brokerValid && professionalValid && acceptTerms;

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
          categories: selectedCategories,
          trading_name: tradingName,
          role,
          registration_id: registrationId,
          logo_key: logoKey,
          document_keys: documentKeys,
          accept_terms: acceptTerms,
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

  const personalFields = (
    <>
      <label className="block font-label-md text-label-md">
        {t("auth.org_register.owner_full_name")} <span aria-hidden="true" className="text-error">*</span>
        <input className={INPUT} autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </label>
      <label className="block font-label-md text-label-md">
        {t("auth.org_register.email")} <span aria-hidden="true" className="text-error">*</span>
        <input className={INPUT} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <NewPasswordFields value={password} onChange={setPassword} label={t("auth.org_register.password")} inputClassName={INPUT} />
      <PhoneNumberField
        value={phone}
        onChange={setPhone}
        countryLabel={t("auth.org_register.phone_country")}
        numberLabel={t("auth.org_register.phone")}
        required
        selectClassName={INPUT}
        inputClassName={INPUT}
      />
      <label className="block font-label-md text-label-md">
        {t("auth.org_register.country")} <span aria-hidden="true" className="text-error">*</span>
        <select className={INPUT} required value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="ES">{t("auth.org_register.country_es")}</option>
          <option value="IT">{t("auth.org_register.country_it")}</option>
        </select>
      </label>
    </>
  );

  const brokerFields = orgType === "BROKER" && (
    <>
      <label className="block font-label-md text-label-md">
        {t("auth.org_register.trading_name")} <span aria-hidden="true" className="text-error">*</span>
        <input className={INPUT} required value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
        <span className="mt-space-xs block font-body-sm text-on-surface-variant">{t("auth.org_register.trading_name_hint")}</span>
      </label>
      <label className="block font-label-md text-label-md">
        {t("auth.org_register.role_legend")} <span aria-hidden="true" className="text-error">*</span>
        <select className={INPUT} required value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="" disabled>
            {t("auth.org_register.role_placeholder")}
          </option>
          {roles.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className="block font-label-md text-label-md">
        {t("auth.org_register.logo_legend")} <span aria-hidden="true" className="text-error">*</span>
        <FileInput
          accept="image/png,image/jpeg,image/webp"
          required={!logoKey}
          fileName={logoFileName}
          ariaLabel={t("auth.org_register.logo_legend")}
          onChange={(e) => void handleLogoChange(e)}
        />
        {logoState === "uploading" ? <span className="mt-space-xs block font-body-sm">{t("auth.org_register.logo_uploading")}</span> : null}
        {logoState === "done" ? (
          <span className="mt-space-xs flex items-center gap-space-sm font-body-sm text-primary">
            {t("auth.org_register.logo_uploaded")}
            <button type="button" className="text-error underline" onClick={removeLogo}>
              {t("auth.org_register.logo_remove")}
            </button>
          </span>
        ) : null}
        {logoState === "error" ? <span className="mt-space-xs block font-body-sm text-error">{t("auth.org_register.logo_error")}</span> : null}
      </div>
      <div className="block font-label-md text-label-md">
        {t("auth.org_register.documents_legend")} <span aria-hidden="true" className="text-error">*</span>
        <FileInput
          accept="image/png,image/jpeg,application/pdf"
          required={documentKeys.length === 0}
          ariaLabel={t("auth.org_register.documents_legend")}
          onChange={(e) => void handleDocumentChange(e)}
        />
        <span className="mt-space-xs block font-body-sm text-on-surface-variant">{t("auth.org_register.documents_hint")}</span>
        {documentState === "uploading" ? <span className="mt-space-xs block font-body-sm">{t("auth.org_register.documents_uploading")}</span> : null}
        {documentState === "error" ? <span className="mt-space-xs block font-body-sm text-error">{t("auth.org_register.documents_error")}</span> : null}
        {documentKeys.length > 0 ? (
          <ul className="mt-space-xs space-y-space-xs">
            {documentKeys.map((key, index) => (
              <li key={key} className="flex items-center justify-between gap-space-sm font-body-sm">
                <span>{t("auth.org_register.documents_uploaded", { count: index + 1 })}</span>
                <button type="button" className="text-error underline" onClick={() => removeDocument(key)}>
                  {t("auth.org_register.document_remove")}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <fieldset className="space-y-space-sm">
        <div className="flex items-center justify-between gap-space-sm">
          <legend className="font-label-md text-label-md">{t("auth.org_register.plan_legend")}</legend>
          <Link
            href="/pricing/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-outline px-space-sm py-1 font-label-sm text-primary hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
            {t("auth.org_register.compare_plans")}
          </Link>
        </div>
        {plans.map((item) => {
          const selected = plan === item.slug;
          return (
            <label
              key={item.slug}
              className={`flex cursor-pointer items-center justify-between gap-space-md rounded-xl border px-space-md py-space-sm transition-colors ${
                selected ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"
              }`}
            >
              <span className="flex items-center gap-space-sm">
                <input type="radio" name="plan" value={item.slug} checked={selected} onChange={() => setPlan(item.slug)} />
                <span className="flex flex-col">
                  <span className={`font-title-sm text-title-sm ${selected ? "text-on-primary" : "text-primary"}`}>{item.name}</span>
                  <span className={`flex flex-wrap items-center gap-space-sm font-body-sm ${selected ? "text-on-primary" : "text-on-surface-variant"}`}>
                    <span className="flex items-center gap-1">
                      <span className={`material-symbols-outlined text-[14px] ${selected ? "text-secondary-fixed" : "text-secondary"}`} aria-hidden="true">check</span>
                      {item.listing_limit
                        ? t("auth.org_register.listings_limit", { count: item.listing_limit })
                        : t("auth.org_register.listings_unlimited")}
                    </span>
                    {item.seat_limit ? (
                      <span className="flex items-center gap-1">
                        <span className={`material-symbols-outlined text-[14px] ${selected ? "text-secondary-fixed" : "text-secondary"}`} aria-hidden="true">check</span>
                        {t("auth.org_register.seats", { count: item.seat_limit })}
                      </span>
                    ) : null}
                  </span>
                </span>
              </span>
              <span className={`whitespace-nowrap font-label-lg font-semibold ${selected ? "text-on-primary" : "text-primary"}`}>
                {formatPrice(item.monthly_price, item.currency)}
                {t("auth.org_register.per_month")}
              </span>
            </label>
          );
        })}
      </fieldset>
    </>
  );

  const professionalFields = orgType === "PROFESSIONAL" && (
    <fieldset className="space-y-space-xs">
      <legend className="font-label-md text-label-md">
        {t("auth.org_register.category_legend")} <span aria-hidden="true" className="text-error">*</span>
      </legend>
      <p className="font-body-sm text-on-surface-variant">{t("auth.org_register.category_limit_hint")}</p>
      {categories.map((item) => {
        const checked = selectedCategories.includes(item.slug);
        const disabled = !checked && selectedCategories.length >= MAX_CATEGORIES;
        return (
          <label key={item.slug} className="flex cursor-pointer items-center gap-space-xs">
            <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleCategory(item.slug)} />
            <span className="font-body-md">{item.name}</span>
          </label>
        );
      })}
    </fieldset>
  );

  const companyFields = (
    <>
      <label className="block font-label-md text-label-md">
        {t(copy.name)} <span aria-hidden="true" className="text-error">*</span>
        <input className={INPUT} required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
      </label>
      {brokerFields}
      {professionalFields}
      <label className="flex items-start gap-space-xs font-body-sm">
        <input type="checkbox" checked={newsletterOptIn} onChange={(e) => setNewsletterOptIn(e.target.checked)} />
        {t("auth.org_register.newsletter")}
      </label>
      <label className="flex items-start gap-space-xs font-body-sm">
        <input type="checkbox" required checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
        {t("auth.org_register.accept_terms_prefix")}{" "}
        <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">
          {t("auth.org_register.accept_terms_link")}
        </Link>
        <span aria-hidden="true" className="text-error">*</span>
      </label>
    </>
  );

  const isWizard = orgType === "PROFESSIONAL";

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
          <p className="font-body-sm text-on-surface-variant">{t("auth.required_hint")}</p>
          {isWizard ? (
            <p className="font-label-md text-label-md">{t(step === 1 ? "auth.org_register.step1_heading" : "auth.org_register.step2_heading")}</p>
          ) : null}
          {!isWizard || step === 1 ? personalFields : null}
          {!isWizard || step === 2 ? companyFields : null}
          {error ? (
            <p role="alert" className="font-body-sm text-error">
              {error}
            </p>
          ) : null}
          {isWizard && step === 1 ? (
            <button
              type="button"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
              className="w-full rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary disabled:opacity-50"
            >
              {t("auth.org_register.step_next")}
            </button>
          ) : (
            <div className="space-y-space-sm">
              {isWizard ? (
                <button type="button" onClick={() => setStep(1)} className="w-full rounded-lg border border-outline-variant px-space-md py-space-sm font-body-md">
                  {t("auth.org_register.step_back")}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={busy || !canSubmit}
                className="w-full rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary disabled:opacity-50"
              >
                {t("auth.org_register.submit")}
              </button>
            </div>
          )}
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
