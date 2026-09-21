"use client";

import { useLocaleOrDefault } from "@/components/layout/LocaleContext";
import { localizePath } from "@/lib/i18n/localePath";
import { Suspense, useState } from "react";
import Link from "@/components/layout/LocaleLink";

import AuthShell from "@/components/auth/AuthShell";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { safeNextUrl } from "@/lib/auth/next-url";
import { useSession } from "@/lib/auth/session";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = safeNextUrl(searchParams.get("next"));
  const pageLocale = useLocaleOrDefault();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.replace(localizePath(destination, pageLocale));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-space-md">
            <label className="block font-label-md text-label-md" htmlFor="email">
        Email
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
        Password
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md"
        />
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
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="font-body-sm">
        <Link href="/forgot-password" className="text-primary underline">
          Forgot your password?
        </Link>
      </p>
      <p className="font-body-sm">
        New here?{" "}
        <Link href="/register" className="text-primary underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell tab="login" heading="Sign in">
      <Suspense fallback={<p className="font-body-md">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
