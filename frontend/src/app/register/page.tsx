"use client";

import Link from "next/link";

import AuthShell from "@/components/auth/AuthShell";
import { useState } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";

const INPUT =
  "mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      setDone(true);
    } catch (caught) {
      const first =
        caught instanceof ApiError ? Object.values(caught.fields)[0]?.[0]?.message : undefined;
      setError(first || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell tab="register" heading="Create your account">
      {done ? (
        <p role="status" className="max-w-sm font-body-md">
          Account created. Check your inbox for the verification link, then{" "}
          <Link href="/login" className="text-primary underline">
            sign in
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={submit} className="w-full space-y-space-md">
                    <label className="block font-label-md text-label-md">
            Full name
            <input className={INPUT} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            Email
            <input className={INPUT} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block font-label-md text-label-md">
            Password
            <input className={INPUT} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
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
            {busy ? "Creating…" : "Create account"}
          </button>
          <p className="font-body-sm">
            Already registered?{" "}
            <Link href="/login" className="text-primary underline">
              Sign in
            </Link>
          </p>
          <p className="font-body-sm text-on-surface-variant">
            Representing a business?{" "}
            <Link href="/register/professional" className="text-primary underline">
              Register as a professional
            </Link>{" "}
            or{" "}
            <Link href="/register/broker" className="text-primary underline">
              as a broker
            </Link>
            .
          </p>
        </form>
      )}
    </AuthShell>
  );
}
