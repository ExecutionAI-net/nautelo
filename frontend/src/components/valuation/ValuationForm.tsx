"use client";

import Link from "@/components/layout/LocaleLink";
import { useState } from "react";

import { apiFetch } from "@/lib/api/client";

const BOAT_TYPES = ["Motor yacht", "Sailing yacht", "Catamaran", "Motorboat", "RIB", "Fishing boat"];

interface Estimate {
  available: boolean;
  comparables: number;
  currency?: string;
  confidence?: "low" | "medium" | "high";
  low?: number;
  mid?: number;
  high?: number;
}

const CONFIDENCE_TEXT = {
  high: "High - many comparable boats, a solid estimate.",
  medium: "Medium - enough comparable boats for a fair estimate.",
  low: "Low - few comparable boats, treat it as a rough guide.",
};

const money = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Free market-value estimate from comparable published listings. */
export default function ValuationForm() {
  const [boatType, setBoatType] = useState(BOAT_TYPES[0]);
  const [length, setLength] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Estimate | null>(null);

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
      setError("Check the length (2-120 m) and the year, then try again.");
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-lg bg-surface-container-low px-space-sm py-space-xs";
  return (
    <div className="mx-auto max-w-xl">
      <form onSubmit={(e) => void submit(e)} className="grid gap-space-md rounded-xl bg-surface-container-lowest p-space-lg">
        <label className="font-label-md">
          Boat type
          <select className={input} value={boatType} onChange={(e) => setBoatType(e.target.value)}>
            {BOAT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-space-md">
          <label className="font-label-md">
            Length (m)
            <input className={input} inputMode="decimal" required value={length} onChange={(e) => setLength(e.target.value)} placeholder="12.5" />
          </label>
          <label className="font-label-md">
            Year built
            <input className={input} inputMode="numeric" required value={year} onChange={(e) => setYear(e.target.value)} placeholder="2018" />
          </label>
        </div>
        <button disabled={busy} className="rounded-lg bg-primary px-space-md py-space-sm font-label-md text-on-primary disabled:opacity-60">
          {busy ? "Calculating..." : "Estimate my boat's value"}
        </button>
        {error ? <p role="alert" className="font-body-sm text-error">{error}</p> : null}
      </form>

      {result ? (
        <section aria-live="polite" className="mt-space-lg rounded-xl bg-surface-container-lowest p-space-lg">
          {result.available && result.low && result.mid && result.high ? (
            <>
              <p className="font-label-md text-on-surface-variant">Estimated asking price range</p>
              <p className="mt-1 font-headline-md text-primary">
                {money(result.low)} - {money(result.high)}
              </p>
              <p className="font-body-md text-on-surface-variant">Typical: {money(result.mid)}</p>
              <p className="mt-space-sm font-body-sm">
                Based on {result.comparables} comparable listings on Nauta. {result.confidence ? CONFIDENCE_TEXT[result.confidence] : null}
              </p>
            </>
          ) : (
            <p className="font-body-md">We do not have enough comparable boats yet for a reliable number. List your boat and let buyers price it.</p>
          )}
          <p className="mt-space-sm font-body-sm text-on-surface-variant">
            Asking prices usually sit a little above the final selling price. Refits and exceptional condition can move the value by 10-20%. This is a guide, not an official appraisal.
          </p>
          <Link href="/sell/create/" className="mt-space-md inline-block rounded-lg bg-primary px-space-md py-space-sm font-label-md text-on-primary">
            List your boat
          </Link>
        </section>
      ) : null}
    </div>
  );
}
