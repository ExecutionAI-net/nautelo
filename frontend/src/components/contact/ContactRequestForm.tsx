"use client";

import Link from "next/link";
import { useState } from "react";

import { apiFetch } from "@/lib/api/client";

type Mode = "contact" | "financing";

const TOPICS: [string, string][] = [
  ["general", "General platform and account questions"],
  ["buying", "Buying a boat and technical due diligence"],
  ["selling", "Listing and selling a boat"],
  ["brokers", "Broker network and co-brokerage"],
  ["services", "Nautical services and provider verification"],
  ["press", "Press and partnerships"],
];

const TERMS = ["36", "48", "60", "84", "120"];
const field = "w-full rounded bg-surface-container-low px-space-md py-2.5 font-body-md text-primary focus:outline-none focus:ring-2 focus:ring-secondary";

/** Public message form: stored for the team, answered by email in the chosen language. */
export default function ContactRequestForm({ mode = "contact" }: { mode?: Mode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ reference: string }>("/api/v1/contact/", {
        method: "POST",
        body: JSON.stringify({
          topic: mode === "financing" ? "financing" : get("topic"),
          name: get("name"),
          email: get("email"),
          phone: get("phone"),
          message: get("message"),
          reply_language: get("reply_language") || "EN",
          consent: form.get("consent") === "on",
          website: get("website"),
          details: mode === "financing" ? { price: get("price"), deposit: get("deposit"), term_months: get("term_months") } : {},
        }),
      });
      setReference(result.reference);
    } catch {
      setError("We could not send your message. Check the fields and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div role="status" className="rounded-lg bg-secondary-container p-space-md text-on-secondary-container">
        <p className="font-title-md">Message received.</p>
        <p className="font-body-md">Your reference is {reference}. Our team will answer by email.</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-space-md">
      <div className="grid gap-space-md sm:grid-cols-2">
        <label className="font-label-md">
          Full name *
          <input name="name" required maxLength={120} className={`${field} mt-1`} />
        </label>
        <label className="font-label-md">
          Email *
          <input name="email" type="email" required className={`${field} mt-1`} />
        </label>
      </div>
      <div className="grid gap-space-md sm:grid-cols-2">
        <label className="font-label-md">
          Telephone (optional)
          <input name="phone" type="tel" placeholder="+34 610 982 344" className={`${field} mt-1`} />
        </label>
        <label className="font-label-md">
          Reply language
          <select name="reply_language" defaultValue="EN" className={`${field} mt-1`}>
            <option value="EN">English</option>
            <option value="ES">Español</option>
            <option value="IT">Italiano</option>
          </select>
        </label>
      </div>
      {mode === "contact" ? (
        <label className="font-label-md">
          Topic *
          <select name="topic" required defaultValue="general" className={`${field} mt-1`}>
            {TOPICS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="grid gap-space-md sm:grid-cols-3">
          <label className="font-label-md">
            Boat price (EUR)
            <input name="price" inputMode="numeric" className={`${field} mt-1`} />
          </label>
          <label className="font-label-md">
            Deposit (EUR)
            <input name="deposit" inputMode="numeric" className={`${field} mt-1`} />
          </label>
          <label className="font-label-md">
            Term
            <select name="term_months" defaultValue="60" className={`${field} mt-1`}>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t} months
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <label className="font-label-md">
        {mode === "financing" ? "Boat and intended use (optional)" : "Message *"}
        <textarea name="message" rows={5} required={mode === "contact"} maxLength={4000} className={`${field} mt-1`} />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex items-start gap-space-sm font-body-sm text-on-surface-variant">
        <input name="consent" type="checkbox" required className="mt-1" />
        <span>
          I agree to the <Link href="/privacy/" className="text-secondary underline">Privacy Policy</Link> and that Nauta may contact me about this request.
        </span>
      </label>
      {error ? <p role="alert" className="font-body-sm text-error">{error}</p> : null}
      <button disabled={busy} className="justify-self-start rounded bg-primary px-space-xl py-3 font-title-md text-on-primary disabled:opacity-60">
        {busy ? "Sending..." : mode === "financing" ? "Request a financing study" : "Send message"}
      </button>
    </form>
  );
}
