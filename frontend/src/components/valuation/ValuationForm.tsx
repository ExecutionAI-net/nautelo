"use client";

import Link from "@/components/layout/LocaleLink";
import { useState } from "react";

import { useLocaleOrDefault } from "@/components/layout/LocaleContext";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import { apiFetch } from "@/lib/api/client";
import { INTL_LOCALES } from "@/lib/i18n/finance";

// The API takes the stored English value (backend/listings/form_options.py); the label is translated.
const BOAT_TYPES: [string, MessageKey][] = [
  ["Motor yacht", "sell.valuation.type.motor_yacht"],
  ["Sailing yacht", "sell.valuation.type.sailing_yacht"],
  ["Catamaran", "sell.valuation.type.catamaran"],
  ["Motorboat", "sell.valuation.type.motorboat"],
  ["RIB", "sell.valuation.type.rib"],
  ["Fishing boat", "sell.valuation.type.fishing_boat"],
];

interface Estimate {
  available: boolean;
  comparables: number;
  currency?: string;
  confidence?: "low" | "medium" | "high";
  low?: number;
  mid?: number;
  high?: number;
}

const CONFIDENCE_KEY: Record<NonNullable<Estimate["confidence"]>, MessageKey> = {
  high: "sell.valuation.confidence_high",
  medium: "sell.valuation.confidence_medium",
  low: "sell.valuation.confidence_low",
};

/** Free market-value estimate from comparable published listings. */
export default function ValuationForm() {
  const t = useT();
  const locale = useLocaleOrDefault();
  const [boatType, setBoatType] = useState(BOAT_TYPES[0][0]);
  const [length, setLength] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Estimate | null>(null);

  const money = (n: number) =>
    new Intl.NumberFormat(INTL_LOCALES[locale], { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await apiFetch<Estimate>("/api/v1/valuation/", {
          method: "POST",
          body: JSON.stringify({ boat_type: boatType, length_m: length, year: Number(year) }),
        }),
      );
    } catch {
      setError(t("sell.valuation.error"));
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-lg bg-surface-container-low px-space-sm py-space-xs";
  return (
    <div className="mx-auto max-w-xl">
      <form onSubmit={(e) => void submit(e)} className="grid gap-space-md rounded-xl bg-surface-container-lowest p-space-lg">
        <label className="font-label-md">
          {t("sell.valuation.boat_type")}
          <select className={input} value={boatType} onChange={(e) => setBoatType(e.target.value)}>
            {BOAT_TYPES.map(([value, key]) => (
              <option key={value} value={value}>
                {t(key)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-space-md">
          <label className="font-label-md">
            {t("sell.valuation.length_m")}
            <input className={input} inputMode="decimal" required value={length} onChange={(e) => setLength(e.target.value)} placeholder="12.5" />
          </label>
          <label className="font-label-md">
            {t("sell.valuation.year_built")}
            <input className={input} inputMode="numeric" required value={year} onChange={(e) => setYear(e.target.value)} placeholder="2018" />
          </label>
        </div>
        <button disabled={busy} className="rounded-lg bg-primary px-space-md py-space-sm font-label-md text-on-primary disabled:opacity-60">
          {busy ? t("sell.valuation.calculating") : t("sell.valuation.submit")}
        </button>
        {error ? <p role="alert" className="font-body-sm text-error">{error}</p> : null}
      </form>

      {result ? (
        <section aria-live="polite" className="mt-space-lg rounded-xl bg-surface-container-lowest p-space-lg">
          {result.available && result.low && result.mid && result.high ? (
            <>
              <p className="font-label-md text-on-surface-variant">{t("sell.valuation.range_title")}</p>
              <p className="mt-1 font-headline-md text-primary">
                {money(result.low)} - {money(result.high)}
              </p>
              <p className="font-body-md text-on-surface-variant">{t("sell.valuation.typical", { amount: money(result.mid) })}</p>
              <p className="mt-space-sm font-body-sm">
                {t("sell.valuation.based_on", { count: result.comparables })} {result.confidence ? t(CONFIDENCE_KEY[result.confidence]) : null}
              </p>
            </>
          ) : (
            <p className="font-body-md">{t("sell.valuation.not_enough")}</p>
          )}
          <p className="mt-space-sm font-body-sm text-on-surface-variant">{t("sell.valuation.disclaimer")}</p>
          <Link href="/sell/create/" className="mt-space-md inline-block rounded-lg bg-primary px-space-md py-space-sm font-label-md text-on-primary">
            {t("sell.valuation.list_your_boat")}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
