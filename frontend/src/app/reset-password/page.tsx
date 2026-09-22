"use client";

import Link from "@/components/layout/LocaleLink";

import AuthShell from "@/components/auth/AuthShell";
import { useT } from "@/i18n/client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";

function ResetForm() {
  const t = useT();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/v1/auth/password-reset/confirm/", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (caught) {
      const fields = caught instanceof ApiError ? caught.fields : {};
      setError(
        fields.password?.[0]?.message ?? t("auth.reset.expired"),
      );
    }
  }

  if (done) {
    return (
      <p role="status" className="max-w-sm font-body-md">
        {t("auth.reset.done")}{" "}
        <Link href="/login" className="text-primary underline">
          {t("auth.reset.sign_in")}
        </Link>
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="w-full space-y-space-md">
            <label className="block font-label-md text-label-md">
        {t("auth.reset.new_password")}
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md"
        />
      </label>
      {error ? (
        <p role="alert" className="font-body-sm text-error">
          {error}
        </p>
      ) : null}
      <button type="submit" className="w-full rounded-lg bg-primary p-space-sm text-on-primary">
        {t("auth.reset.change_password")}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const t = useT();
  return (
    <AuthShell tab="recovery" heading={t("auth.reset.heading")}>
      <Suspense fallback={<p>{t("auth.reset.loading")}</p>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
