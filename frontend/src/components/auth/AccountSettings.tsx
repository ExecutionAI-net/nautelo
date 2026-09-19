"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";

const LOCALES = [
  { value: "EN", label: "English" },
  { value: "IT", label: "Italiano" },
  { value: "ES", label: "Español" },
] as const;

export default function AccountSettings() {
  const { session, reload } = useSession();
  const user = session?.user;
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [locale, setLocale] = useState<string>(user?.locale ?? "EN");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  if (!user) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("idle");
    try {
      await apiFetch("/api/v1/account/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, locale }),
      });
      await reload();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-space-md">
      <h1 className="font-headline-md text-headline-md text-primary">Account</h1>
      <p className="font-body-md text-on-surface-variant">
        {user.email} {user.email_verified ? "" : "(email not verified)"}
      </p>
      <label className="font-body-md">
        Full name
        <input
          className="mt-space-xs w-full rounded-lg border border-outline-variant p-space-sm"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </label>
      <label className="font-body-md">
        Language
        <select
          className="mt-space-xs w-full rounded-lg border border-outline-variant p-space-sm"
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
        >
          {LOCALES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="self-start rounded-lg bg-primary px-space-md py-space-sm text-on-primary">
        Save
      </button>
      {status === "saved" ? <p role="status">Saved.</p> : null}
      {status === "error" ? (
        <p role="alert" className="text-error">
          The changes could not be saved.
        </p>
      ) : null}
    </form>
  );
}
