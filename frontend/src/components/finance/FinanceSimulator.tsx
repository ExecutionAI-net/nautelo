"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import {
  allowedTerms,
  maxPriceForBudget,
  pickRule,
  simulate,
  type Condition,
  type FinanceRule,
  type Product,
  type Use,
} from "@/lib/finance/simulator";
import type { Locale } from "@/lib/i18n/directory";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/lib/i18n/useLocale";

const THIS_YEAR = new Date().getFullYear();
const LOCALE_TAG: Record<Locale, string> = { en: "en-GB", it: "it-IT", es: "es-ES" };
const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md text-on-surface focus:outline-none";
const LABEL = "font-label-sm uppercase tracking-wider text-on-surface-variant";

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <div role="group" aria-label={label} className="inline-flex rounded-lg bg-surface-container-low p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-md px-space-sm py-1.5 font-label-md ${value === option.value ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Simple financing simulator. The rulebook (rates, limits, VAT, notes) comes from /api/v1/finance/simulator-config/ once;
 * every slider then answers in the browser. "I have a monthly budget" turns the payment around into the price it carries.
 */
export default function FinanceSimulator({ compact = false, initialPrice }: { compact?: boolean; initialPrice?: number }) {
  const locale = useLocale();
  const t = useT();
  const money = useMemo(() => new Intl.NumberFormat(LOCALE_TAG[locale], { style: "currency", currency: "EUR", maximumFractionDigits: 0 }), [locale]);

  const [rules, setRules] = useState<FinanceRule[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<"price" | "budget">("price");
  const [priceRaw, setPriceRaw] = useState(initialPrice && initialPrice > 0 ? initialPrice : 180000);
  const [budgetRaw, setBudgetRaw] = useState(1500);
  const [downRaw, setDownRaw] = useState<number | null>(null);
  const [termRaw, setTermRaw] = useState(10);
  const [product, setProduct] = useState<Product>("LOAN");
  const [country, setCountry] = useState("ES");
  const [condition, setCondition] = useState<Condition>("NEW");
  const [use, setUse] = useState<Use>("PRIVATE");
  const [boatYear, setBoatYear] = useState(THIS_YEAR - 8);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ rules: FinanceRule[] }>("/api/v1/finance/simulator-config/").then(
      (config) => setRules(config.rules),
      () => setFailed(true),
    );
  }, []);

  const countries = useMemo(() => [...new Set((rules ?? []).map((rule) => rule.country_code))], [rules]);
  const rule = useMemo(() => (rules ? pickRule(rules, { country, product, condition, use }) : null), [rules, country, product, condition, use]);
  const age = condition === "USED" ? Math.max(0, THIS_YEAR - boatYear) : 0;
  const terms = rule ? allowedTerms(rule, age) : [];
  const term = terms.includes(termRaw) ? termRaw : ([...terms].reverse().find((option) => option <= termRaw) ?? terms[0]);
  const down = rule ? clamp(downRaw ?? rule.default_down_percent, rule.min_down_percent, rule.max_down_percent) : 0;

  const budgetPrice =
    rule && term && mode === "budget" ? Math.floor(maxPriceForBudget(rule, budgetRaw, down, term) / 1000) * 1000 : 0;
  const price = rule ? (mode === "budget" ? clamp(budgetPrice, rule.min_price, rule.max_price) : clamp(priceRaw, rule.min_price, rule.max_price)) : 0;
  const result = rule && term ? simulate(rule, { price, down_percent: down, term_years: term }) : null;
  const budgetTooLow = mode === "budget" && rule != null && budgetPrice < rule.min_price;

  useEffect(() => {
    if (mode !== "budget" || budgetPrice <= 0) return;
    const timer = window.setTimeout(() => {
      apiFetch<{ count: number }>(`/api/v1/listings/?price_max=${budgetPrice}&page_size=1`).then(
        (page) => setCount(page.count),
        () => setCount(null),
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [mode, budgetPrice]);

  const studyHref = `/financing/?${new URLSearchParams({
    price: String(price),
    down: String(down),
    term: String(term ?? ""),
    product,
    country,
    condition,
    use,
    ...(condition === "USED" ? { year: String(boatYear) } : {}),
  }).toString()}#study`;

  if (failed) return <p className="font-body-md text-on-surface-variant">{t("sim.unavailable")}</p>;
  if (rules === null) return <div className="min-h-64 rounded-2xl bg-surface-container-low" aria-busy="true" />;

  return (
    <div className={`rounded-2xl bg-surface-container-lowest shadow-md ${compact ? "p-space-md" : "p-space-lg"}`}>
      <div className="grid gap-space-md">
        <Segmented
          label={t("sim.mode.price")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "price", label: t("sim.mode.price") },
            { value: "budget", label: t("sim.mode.budget") },
          ]}
        />

        {mode === "price" ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <label className={LABEL} htmlFor="sim-price">{t("sim.price")}</label>
              <span className="font-title-md text-primary">{money.format(price)}</span>
            </div>
            <input
              id="sim-price"
              aria-label={t("sim.price")}
              type="range"
              min={rule?.min_price ?? 15000}
              max={rule?.max_price ?? 2000000}
              step={5000}
              value={price}
              onChange={(event) => setPriceRaw(Number(event.target.value))}
              className="w-full accent-secondary"
            />
            <input
              aria-label={t("sim.price")}
              type="number"
              min={rule?.min_price}
              max={rule?.max_price}
              value={priceRaw}
              onChange={(event) => setPriceRaw(Number(event.target.value) || 0)}
              className={FIELD}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <label className={LABEL} htmlFor="sim-budget">{t("sim.budget")}</label>
              <span className="font-title-md text-primary">{money.format(budgetRaw)}{t("sim.result.month")}</span>
            </div>
            <input id="sim-budget" type="range" min={200} max={15000} step={50} value={budgetRaw} onChange={(event) => setBudgetRaw(Number(event.target.value))} className="w-full accent-secondary" />
          </div>
        )}

        {rule ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <label className={LABEL} htmlFor="sim-down">{t("sim.down")}</label>
              <span className="font-title-md text-primary">
                {down}% · {money.format((price * down) / 100)}
              </span>
            </div>
            <input
              id="sim-down"
              type="range"
              min={rule.min_down_percent}
              max={rule.max_down_percent}
              step={1}
              value={down}
              onChange={(event) => setDownRaw(Number(event.target.value))}
              className="w-full accent-secondary"
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <span className={LABEL}>{t("sim.term")}</span>
          <div role="group" aria-label={t("sim.term")} className="flex flex-wrap gap-space-xs">
            {(rule?.terms_years ?? []).map((option) => {
              const enabled = terms.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!enabled}
                  aria-pressed={term === option}
                  onClick={() => setTermRaw(option)}
                  className={`rounded-lg px-space-md py-1.5 font-label-md ${term === option ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"} ${enabled ? "hover:text-on-surface" : "opacity-40"}`}
                >
                  {t("sim.years", { count: option })}
                </button>
              );
            })}
          </div>
          {rule && terms.length > 0 && terms.length < rule.terms_years.length ? (
            <p className="font-body-sm text-on-surface-variant">{t("sim.age.note", { age, limit: rule.age_plus_term_limit ?? rule.max_age_at_end_years ?? "" })}</p>
          ) : null}
          {rule && terms.length === 0 ? <p role="alert" className="font-body-sm text-error">{t("sim.age.none")}</p> : null}
        </div>

        <Segmented
          label={t("sim.product")}
          value={product}
          onChange={setProduct}
          options={[
            { value: "LOAN", label: t("sim.loan") },
            { value: "LEASING", label: t("sim.leasing") },
          ]}
        />

        <details className="rounded-lg bg-surface-container-low p-space-sm">
          <summary className="cursor-pointer font-label-md text-secondary">{t("sim.more")}</summary>
          <div className="mt-space-sm grid gap-space-sm sm:grid-cols-2">
            {countries.length > 1 ? (
              <Segmented label={t("sim.country")} value={country} onChange={setCountry} options={countries.map((code) => ({ value: code, label: t(`sim.${code.toLowerCase()}` as MessageKey) }))} />
            ) : null}
            <Segmented
              label={t("sim.condition")}
              value={condition}
              onChange={setCondition}
              options={[
                { value: "NEW", label: t("sim.new") },
                { value: "USED", label: t("sim.used") },
              ]}
            />
            {condition === "USED" ? (
              <div className="flex flex-col gap-1">
                <label className={LABEL} htmlFor="sim-year">{t("sim.year")}</label>
                <input id="sim-year" type="number" min={1970} max={THIS_YEAR} value={boatYear} onChange={(event) => setBoatYear(clamp(Number(event.target.value) || THIS_YEAR, 1970, THIS_YEAR))} className={FIELD} />
              </div>
            ) : null}
            <Segmented
              label={t("sim.use")}
              value={use}
              onChange={setUse}
              options={[
                { value: "PRIVATE", label: t("sim.private") },
                { value: "COMPANY", label: t("sim.company") },
              ]}
            />
          </div>
        </details>

        {rule === null ? (
          <p role="status" className="rounded-lg bg-surface-container-low p-space-md font-body-md text-on-surface-variant">{t("sim.no_rule")}</p>
        ) : result ? (
          <div className="rounded-xl bg-primary p-space-md text-on-primary" aria-live="polite">
            {mode === "budget" ? (
              <div className="mb-space-sm border-b border-on-primary/20 pb-space-sm">
                <p className="font-label-md opacity-80">{t("sim.reverse.title")}</p>
                <p className="font-headline-md">{budgetTooLow ? "—" : money.format(budgetPrice)}</p>
                {!budgetTooLow ? (
                  <p className="mt-1 font-body-sm opacity-80">
                    <Link href={`/boats/?price_max=${budgetPrice}`} className="underline">{t("sim.reverse.cta")}</Link>
                    {count !== null ? ` · ${t("sim.reverse.count", { count })}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
            <p className="text-center font-label-md uppercase tracking-wider opacity-80">{t("sim.result.monthly")}</p>
            <p className="text-center font-headline-lg">
              {money.format(rule.vat_recoverable ? result.monthly : result.monthly_with_vat)}
              <span className="font-body-md opacity-80">{t("sim.result.month")}</span>
            </p>
            {rule.vat_on_installment ? (
              <p className="text-center font-body-sm opacity-80">
                {rule.vat_recoverable
                  ? t("sim.result.without_vat", { amount: money.format(result.monthly) })
                  : t("sim.result.with_vat")}
                {rule.vat_percent != null ? ` (${rule.vat_percent}%)` : ""}
              </p>
            ) : null}
            <dl className="mt-space-sm grid grid-cols-3 gap-space-xs border-t border-on-primary/20 pt-space-sm text-center">
              <div>
                <dt className="font-label-sm opacity-70">{t("sim.result.financed")}</dt>
                <dd className="font-title-md">{money.format(result.financed)}</dd>
              </div>
              <div>
                <dt className="font-label-sm opacity-70">{t("sim.result.total")}</dt>
                <dd className="font-title-md">{money.format(result.total_repaid)}</dd>
              </div>
              <div>
                <dt className="font-label-sm opacity-70">{t("sim.result.cost")}</dt>
                <dd className="font-title-md">{money.format(result.cost_of_financing)}</dd>
              </div>
            </dl>
            {result.residual > 0 ? <p className="mt-space-xs text-center font-body-sm opacity-80">{t("sim.result.residual")}: {money.format(result.residual)}</p> : null}
          </div>
        ) : null}

        {rule ? (
          <div className="grid gap-space-xs font-body-sm text-on-surface-variant">
            {rule.note[locale] || rule.note.en ? <p>{rule.note[locale] || rule.note.en}</p> : null}
            <p>
              {t("sim.example", {
                months: rule.representative_months,
                tin: rule.tin_percent,
                tae: rule.tae_percent != null ? t("sim.example.tae", { tae: rule.tae_percent }) : "",
              })}
            </p>
            <p>{t("sim.disclaimer")}</p>
          </div>
        ) : null}

        {rule && result ? (
          <Link href={studyHref} className="rounded-lg bg-secondary px-space-lg py-space-sm text-center font-body-md text-on-secondary hover:opacity-90">
            {t("sim.cta")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
