"use client";

import Link from "@/components/layout/LocaleLink";

import AuthShell from "@/components/auth/AuthShell";
import PhoneNumberField from "@/components/forms/PhoneNumberField";
import { useT } from "@/i18n/client";
import { useState } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";

const INPUT =
  "mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md";

export default function RegisterPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/v1/auth/register/", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          phone_number: phoneNumber,
          newsletter_opt_in: newsletterOptIn,
        }),
      });
      setDone(true);
    } catch (caught) {
      const first =
        caught instanceof ApiError ? Object.values(caught.fields)[0]?.[0]?.message : undefined;
      setError(first || t("auth.register.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell tab="register" heading={t("auth.register.heading")}>
      {done ? (
        <p role="status" className="max-w-sm font-body-md">
          {t("auth.register.done")}{" "}
          <Link href="/login" className="text-primary underline">
            {t("auth.register.sign_in")}
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={submit} className="w-full space-y-space-md">
                    <label className="block font-label-md text-label-md">
            {t("auth.register.full_name")}
            <input className={INPUT} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <PhoneNumberField
            value={phoneNumber}
            onChange={setPhoneNumber}
            countryLabel={t("auth.register.phone_country")}
            numberLabel={t("auth.register.phone")}
            required
            selectClassName={INPUT}
            inputClassName={INPUT}
          />
          <label className="block font-label-md text-label-md">
            {t("auth.register.email")}
            <input className={INPUT} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            {t("auth.register.password")}
            <input className={INPUT} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="flex items-start gap-space-xs font-body-sm">
            <input type="checkbox" checked={newsletterOptIn} onChange={(e) => setNewsletterOptIn(e.target.checked)} />
            {t("auth.register.newsletter")}
          </label>
          {error ? (
            <p role="alert" className="font-body-sm text-error">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary p-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
          >
            {busy ? t("auth.register.creating") : t("auth.register.create_account")}
          </button>
          <p className="font-body-sm">
            {t("auth.register.already_registered")}{" "}
            <Link href="/login" className="text-primary underline">
              {t("auth.register.sign_in")}
            </Link>
          </p>
          <p className="font-body-sm text-on-surface-variant">
            {t("auth.register.representing_business")}{" "}
            <Link href="/register/professional" className="text-primary underline">
              {t("auth.register.register_professional")}
            </Link>{" "}
            {t("auth.register.or")}{" "}
            <Link href="/register/broker" className="text-primary underline">
              {t("auth.register.as_broker")}
            </Link>
            .
          </p>
        </form>
      )}
    </AuthShell>
  );
}
