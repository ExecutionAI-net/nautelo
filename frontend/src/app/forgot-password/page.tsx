"use client";

import Link from "@/components/layout/LocaleLink";

import AuthShell from "@/components/auth/AuthShell";
import { useState } from "react";

import { apiFetch } from "@/lib/api/client";

export default function ForgotPasswordPage() {
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
    <AuthShell tab="recovery" heading="Reset your password">
      {sent ? (
        <p role="status" className="max-w-sm font-body-md">
          If that address has an account, a reset link is on its way. It expires in one hour.
        </p>
      ) : (
        <form onSubmit={submit} className="w-full space-y-space-md">
                    <label className="block font-label-md text-label-md">
            Email
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
              The request failed. Please try again.
            </p>
          ) : null}
          <button type="submit" className="w-full rounded-lg bg-primary p-space-sm text-on-primary">
            Send reset link
          </button>
          <Link href="/login" className="font-body-sm text-primary underline">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
