"use client";

import Link from "@/components/layout/LocaleLink";

import AuthShell from "@/components/auth/AuthShell";
import { useT } from "@/i18n/client";
import { useState } from "react";

import { apiFetch } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(false);
    try {
      await apiFetch("/api/v1/auth/password-reset/", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch {
      setError(true);
    }
  }

  return (
    <AuthShell tab="recovery" heading={t("auth.forgot.heading")}>
      {sent ? (
        <p role="status" className="max-w-sm font-body-md">
          {t("auth.forgot.sent")}
        </p>
      ) : (
        <form onSubmit={submit} className="w-full space-y-space-md">
                    <label className="block font-label-md text-label-md">
            {t("auth.forgot.email")}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md"
            />
          </label>
          {error ? (
            <p role="alert" className="font-body-sm text-error">
              {t("auth.forgot.failed")}
            </p>
          ) : null}
          <button type="submit" className="w-full rounded-lg bg-primary p-space-sm text-on-primary">
            {t("auth.forgot.send")}
          </button>
          <Link href="/login" className="font-body-sm text-primary underline">
            {t("auth.forgot.back_to_sign_in")}
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
