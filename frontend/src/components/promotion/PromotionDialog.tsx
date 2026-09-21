"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n/directory";
import { tPromo } from "@/lib/i18n/promotion";

interface Plan {
  code: string;
  name: string;
  days: number;
  price: string;
  currency: string;
  is_popular: boolean;
}

const money = (plan: Plan) => new Intl.NumberFormat("en-GB", { style: "currency", currency: plan.currency, maximumFractionDigits: plan.price.endsWith(".00") ? 0 : 2 }).format(Number(plan.price));

/**
 * "Feature your listing" pop-up. Never blocks: Skip continues without buying.
 * `returnPath` is where Stripe sends the seller back (must be an allowed path on the server).
 */
export default function PromotionDialog({
  listingId,
  title,
  imageUrl,
  locale = "en",
  returnPath,
  onSkip,
}: {
  listingId: string;
  title: string;
  imageUrl?: string | null;
  locale?: Locale;
  returnPath: string;
  onSkip: () => void;
}) {
  const t = (key: string, vars?: Record<string, string | number>) => tPromo(locale, key, vars);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipRef = useRef<HTMLButtonElement | null>(null);
  const skipNow = useRef(onSkip);
  useEffect(() => {
    skipNow.current = onSkip;
  });

  useEffect(() => {
    apiFetch<Plan[]>(`/api/v1/promotion-plans/?locale=${locale}`).then(
      (rows) => {
        setPlans(rows);
        setChosen((rows.find((p) => p.is_popular) ?? rows[0])?.code ?? "");
      },
      () => skipNow.current(),
    );
  }, [locale]);

  useEffect(() => {
    skipRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skipNow.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const { checkout_url } = await apiFetch<{ checkout_url: string }>("/api/v1/promotions/checkout/", {
        method: "POST",
        body: JSON.stringify({ listing_id: listingId, plan: chosen, return_path: returnPath }),
      });
      window.location.assign(checkout_url);
    } catch {
      setError(t("promo.error"));
      setBusy(false);
    }
  }

  const plan = plans.find((p) => p.code === chosen);
  if (plans.length === 0) return null;

  const card = (
    <div className="relative w-40 shrink-0 overflow-hidden rounded-lg bg-surface-container-lowest shadow-sm">
      <span className="absolute left-1 top-1 z-10 rounded bg-secondary px-1.5 py-0.5 font-label-sm text-on-secondary">{t("promo.badge")}</span>
      <div className="aspect-[4/3] bg-surface-container-high">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- seller's own preview
          <img alt="" src={imageUrl} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <p className="truncate px-2 py-1 font-label-md">{title}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-space-md" role="dialog" aria-modal="true" aria-labelledby="promo-title">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-surface p-space-lg shadow-xl">
        <h2 id="promo-title" className="font-headline-md text-primary">
          {t("promo.title")}
        </h2>
        <p className="mt-1 font-body-md text-on-surface-variant">{t("promo.lead")}</p>

        <p className="mt-space-md font-label-md uppercase tracking-wider text-secondary">{t("promo.preview")}</p>
        <div className="mt-space-xs flex gap-space-sm overflow-hidden rounded-xl bg-surface-container-low p-space-sm" aria-hidden="true">
          {card}
          <div className="w-40 shrink-0 rounded-lg bg-surface-container-high opacity-60" />
          <div className="hidden w-40 shrink-0 rounded-lg bg-surface-container-high opacity-40 sm:block" />
        </div>

        <ul className="mt-space-md grid gap-space-xs font-body-md">
          {["promo.point1", "promo.point2", "promo.point3"].map((key) => (
            <li key={key} className="flex gap-space-xs">
              <span aria-hidden="true" className="text-secondary">✓</span>
              {t(key)}
            </li>
          ))}
        </ul>

        <fieldset className="mt-space-md grid gap-space-sm sm:grid-cols-3">
          <legend className="sr-only">Duration</legend>
          {plans.map((p) => (
            <label
              key={p.code}
              className={`relative cursor-pointer rounded-xl p-space-md text-center ${chosen === p.code ? "bg-primary text-on-primary" : "bg-surface-container-low"}`}
            >
              {p.is_popular ? (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-2 py-0.5 font-label-sm text-on-secondary">{t("promo.popular")}</span>
              ) : null}
              <input type="radio" name="promo-plan" value={p.code} checked={chosen === p.code} onChange={() => setChosen(p.code)} className="sr-only" />
              <span className="block font-title-md">{p.name}</span>
              <span className="block font-headline-sm">{money(p)}</span>
              <span className="block font-body-sm opacity-80">{t("promo.days", { count: p.days })}</span>
            </label>
          ))}
        </fieldset>

        {error ? <p role="alert" className="mt-space-sm font-body-sm text-error">{error}</p> : null}
        <div className="mt-space-lg flex flex-col gap-space-sm sm:flex-row sm:items-center sm:justify-between">
          <button type="button" ref={skipRef} onClick={onSkip} className="rounded-lg px-space-md py-space-sm font-label-md text-on-surface-variant underline">
            {t("promo.skip")}
          </button>
          <button
            type="button"
            disabled={busy || !plan}
            onClick={() => void buy()}
            className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary disabled:opacity-60"
          >
            {plan ? t("promo.cta", { price: money(plan) }) : "..."}
          </button>
        </div>
        <p className="mt-space-sm font-body-sm text-on-surface-variant">{t("promo.secure")}</p>
      </div>
    </div>
  );
}
