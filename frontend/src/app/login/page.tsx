"use client";

import { useT } from "@/i18n/client";
import { localizePath } from "@/lib/i18n/localePath";
import { Suspense, useState } from "react";
import Link from "@/components/layout/LocaleLink";

import AuthShell from "@/components/auth/AuthShell";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { dashboardHomeFor } from "@/lib/auth/home";
import { isSafeNextUrl, safeNextUrl } from "@/lib/auth/next-url";
import { useSession } from "@/lib/auth/session";
import { resolveLocale, type Locale } from "@/lib/i18n/directory";
import { writeLocaleCookie } from "@/lib/i18n/useLocale";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useSession();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);
  const toggleLabel = t(visible ? "auth.password.hide" : "auth.password.show");

  const destination = safeNextUrl(searchParams.get("next"));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(email, password);
      // No explicit ?next=: go to the account's own dashboard, not the home page.
      const target = isSafeNextUrl(searchParams.get("next")) ? destination : dashboardHomeFor(user);
      // The account's saved language wins over whatever language this login
      // page happened to be shown in, so a returning user always lands back
      // in their own language even on a browser that never set the cookie.
      const accountLocale = resolveLocale(user?.locale) as Locale;
      writeLocaleCookie(accountLocale);
      router.replace(localizePath(target, accountLocale));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : t("auth.login.failed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-space-md">
            <label className="block font-label-md text-label-md" htmlFor="email">
        {t("auth.login.email")}
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md"
        />
      </label>
      <label className="block font-label-md text-label-md" htmlFor="password">
        {t("auth.login.password")}
        <div className="relative mt-space-xs">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm pr-10 font-body-md"
          />
          <button
            type="button"
            aria-label={toggleLabel}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-on-surface-variant hover:text-primary"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {visible ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </label>
      {error ? (
        <p role="alert" className="font-body-sm text-error">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary p-space-sm font-label-md text-label-md text-on-primary disabled:opacity-50"
      >
        {submitting ? t("auth.login.signing_in") : t("auth.login.sign_in")}
      </button>
      <p className="font-body-sm">
        <Link href="/forgot-password" className="text-primary underline">
          {t("auth.login.forgot_password")}
        </Link>
      </p>
      <p className="font-body-sm">
        {t("auth.login.new_here")}{" "}
        <Link href="/register" className="text-primary underline">
          {t("auth.login.create_account")}
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  const t = useT();
  return (
    <AuthShell tab="login" heading={t("auth.login.heading")}>
      <Suspense fallback={<p className="font-body-md">{t("auth.reset.loading")}</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
