"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";

function ResetForm() {
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
        fields.password?.[0]?.message ?? "This reset link is invalid or has expired. Request a new one.",
      );
    }
  }

  if (done) {
    return (
      <p role="status" className="max-w-sm font-body-md">
        Your password was changed.{" "}
        <Link href="/login" className="text-primary underline">
          Sign in
        </Link>
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-space-md">
      <h1 className="font-headline-md text-headline-md text-primary">Choose a new password</h1>
      <label className="block font-label-md text-label-md">
        New password
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
        Change password
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-space-lg">
      <Suspense fallback={<p>Loading…</p>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
