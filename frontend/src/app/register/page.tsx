"use client";

import Link from "next/link";
import { useState } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";

const ROLES = [
  { value: "BUYER", label: "I want to buy a boat" },
  { value: "PRIVATE_SELLER", label: "I want to sell my boat" },
  { value: "SERVICE_PROVIDER", label: "I offer nautical services" },
] as const;

const INPUT =
  "mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("BUYER");
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
        body: JSON.stringify({ email, password, full_name: fullName, primary_role: role }),
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
    <main className="flex min-h-screen items-center justify-center bg-background p-space-lg">
      {done ? (
        <p role="status" className="max-w-sm font-body-md">
          Account created. Check your inbox for the verification link, then{" "}
          <Link href="/login" className="text-primary underline">
            sign in
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={submit} className="w-full max-w-sm space-y-space-md">
          <h1 className="font-headline-md text-headline-md text-primary">Create your account</h1>
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
          <label className="block font-label-md text-label-md">
            I am joining to
            <select className={INPUT} value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
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
        </form>
      )}
    </main>
  );
}
