"use client";

import { useState } from "react";

import PhoneNumberField from "@/components/forms/PhoneNumberField";
import { useT } from "@/i18n/client";
import { apiFetch } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { resolveLocale, type Locale } from "@/lib/i18n/directory";
import { localizePath, splitLocalePath } from "@/lib/i18n/localePath";
import { writeLocaleCookie } from "@/lib/i18n/useLocale";

const LOCALES = [
  { value: "EN", label: "English" },
  { value: "IT", label: "Italiano" },
  { value: "ES", label: "Español" },
] as const;

const FIELD = "mt-space-xs w-full rounded-lg bg-surface-container-low p-space-sm font-body-md text-primary focus:outline-none";
const CARD = "bg-surface-container-lowest rounded-2xl shadow-sm p-space-lg flex flex-col gap-space-md";

function Heading({ icon, tile, kicker, title }: { icon: string; tile: string; kicker: string; title: string }) {
  return (
    <div className="flex items-start gap-space-md border-b border-surface-container-high pb-space-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tile}`}>
        <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{icon}</span>
      </div>
      <div className="flex flex-col">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">{kicker}</span>
        <h2 className="font-headline-sm text-headline-sm text-primary">{title}</h2>
      </div>
    </div>
  );
}

export default function AccountSettings() {
  const t = useT();
  const { session, reload } = useSession();
  const user = session?.user;
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ?? "");
  const [newsletterOptIn, setNewsletterOptIn] = useState(user?.newsletter_opt_in ?? false);
  const [locale, setLocale] = useState<string>(user?.locale ?? "EN");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!user) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("idle");
    const previousLocale = user!.locale;
    try {
      await apiFetch("/api/v1/account/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone_number: phoneNumber, newsletter_opt_in: newsletterOptIn, locale }),
      });
      await reload();
      setStatus("saved");
      // Saving a new interface language does nothing to what's already on
      // screen unless we do what LanguageSwitcher does for the nav pills:
      // remember the choice and reopen this same page under that language's
      // address, so getRequestLocale() (and every t()) actually picks it up.
      if (locale !== previousLocale) {
        const chosen = resolveLocale(locale) as Locale;
        writeLocaleCookie(chosen);
        const { path } = splitLocalePath(window.location.pathname);
        window.location.assign(`${localizePath(path, chosen)}${window.location.search}${window.location.hash}`);
      }
    } catch {
      setStatus("error");
    }
  }

  async function sendResetLink() {
    setConfirmingReset(false);
    setResetStatus("sending");
    try {
      await apiFetch("/api/v1/auth/password-reset/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user!.email }),
      });
      setResetStatus("sent");
    } catch {
      setResetStatus("error");
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-space-lg">
      <div>
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">{t("auth.account_settings.breadcrumb")}</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">{t("auth.account_settings.title")}</h1>
        <p className="mt-space-xs font-body-md text-on-surface-variant">{t("auth.account_settings.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <div className="lg:col-span-7 flex flex-col gap-space-lg">
          <section className={CARD}>
            <Heading icon="person" tile="bg-primary-fixed text-primary" kicker={t("auth.account_settings.profile_kicker")} title={t("auth.account_settings.profile_title")} />
            <label className="font-label-sm uppercase text-on-surface-variant">
              {t("auth.account_settings.full_name")}
              <input className={FIELD} value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>
            <PhoneNumberField
              value={phoneNumber}
              onChange={setPhoneNumber}
              countryLabel={t("auth.account_settings.country_code")}
              numberLabel={t("auth.account_settings.phone_number")}
              selectClassName={FIELD}
              inputClassName={FIELD}
              labelClassName="font-label-sm uppercase text-on-surface-variant"
            />
            <label className="flex items-start gap-space-xs font-body-sm text-on-surface">
              <input
                type="checkbox"
                checked={newsletterOptIn}
                onChange={(event) => setNewsletterOptIn(event.target.checked)}
              />
              {t("auth.account_settings.newsletter")}
            </label>
            <div>
              <span className="font-label-sm uppercase text-on-surface-variant">{t("auth.account_settings.email")}</span>
              <div className="mt-space-xs flex flex-wrap items-center gap-space-sm">
                <span className="font-body-md text-primary">{user.email}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-label-sm ${
                    user.email_verified ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]" aria-hidden="true">{user.email_verified ? "verified" : "info"}</span>
                  {user.email_verified ? t("auth.account_settings.email_verified") : t("auth.account_settings.email_not_verified")}
                </span>
              </div>
            </div>
          </section>
          <div className="flex items-center gap-space-md">
            <button type="submit" className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container">
              {t("auth.account_settings.save")}
            </button>
            {status === "saved" ? <p role="status" className="font-body-md text-secondary">{t("auth.account_settings.saved")}</p> : null}
            {status === "error" ? (
              <p role="alert" className="text-error">
                {t("auth.account_settings.save_error")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-space-lg">
          <section className={CARD}>
            <Heading icon="language" tile="bg-secondary-fixed text-on-secondary-fixed" kicker={t("auth.account_settings.language_kicker")} title={t("auth.account_settings.language_title")} />
            <label className="font-label-sm uppercase text-on-surface-variant">
              {t("auth.account_settings.language_kicker")}
              <select className={FIELD} value={locale} onChange={(event) => setLocale(event.target.value)}>
                {LOCALES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className={CARD}>
            <Heading icon="lock" tile="bg-tertiary-fixed text-on-tertiary-fixed" kicker={t("auth.account_settings.security_kicker")} title={t("auth.account_settings.password_title")} />
            <p className="font-body-md text-on-surface-variant">{t("auth.account_settings.password_help")}</p>
            {confirmingReset ? (
              <div role="dialog" aria-modal="true" aria-label={t("auth.account_settings.reset_dialog_label")} className="rounded-lg border border-outline-variant bg-surface-container-low p-space-md">
                <p className="font-body-md text-on-surface">
                  {t("auth.account_settings.reset_confirm_prefix")} <strong>{user.email}</strong>?
                </p>
                <div className="mt-space-sm flex gap-space-sm">
                  <button
                    type="button"
                    onClick={() => void sendResetLink()}
                    className="rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary"
                  >
                    {t("auth.account_settings.reset_confirm_yes")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(false)}
                    className="rounded-lg border border-outline px-space-md py-space-sm font-label-md text-label-md text-on-surface"
                  >
                    {t("auth.account_settings.reset_cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                className="w-fit rounded-lg bg-surface-container px-space-md py-space-sm font-body-md text-primary hover:bg-surface-container-high"
              >
                {t("auth.account_settings.send_reset_link")}
              </button>
            )}
            {resetStatus === "sent" ? <p role="status" className="font-body-md text-secondary">{t("auth.account_settings.reset_sent")}</p> : null}
            {resetStatus === "error" ? (
              <p role="alert" className="text-error">
                {t("auth.account_settings.reset_error")}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </form>
  );
}
