"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { isFinanceablePrice, safeMoney } from "@/components/listings/money";
import { requestFinanceQuote, type FinanceQuote } from "@/lib/api/finance-quote";
import type { FinanceConfigurationDefaults } from "@/lib/api/listings";
import type { Locale } from "@/lib/i18n/directory";
import { tf } from "@/lib/i18n/finance";

interface Assumptions {
  annual_rate_percent: string;
  term_months: string;
  down_payment_percent: string;
  price: string;
}

const EMPTY: Assumptions = {
  annual_rate_percent: "",
  term_months: "",
  down_payment_percent: "",
  price: "",
};

// The platform's real current assumptions, or empty when the server reports no
// active configuration. Never a hard-coded 5 / 48 / 20 fallback: spec §2.1
// forbids displaying invented operational data, and an un-prefilled field is
// the honest degraded state.
function initialValues(defaults: FinanceConfigurationDefaults | null): Assumptions {
  if (defaults === null) {
    return EMPTY;
  }
  return {
    annual_rate_percent: defaults.annual_rate_percent,
    term_months: String(defaults.term_months),
    down_payment_percent: defaults.down_payment_percent,
    price: "",
  };
}

/**
 * Spec §4.1's /financing/ estimator, in both of spec §17.4's contexts.
 *
 * With a listing (spec §18.3), the listing is the authority: the request
 * carries `listing_id` and never a price, so a tampered `?price=` can only ever
 * appear as the greyed placeholder below and never reaches a calculation, and
 * the server's own effective assumptions overwrite the pre-filled defaults as
 * soon as the first quote lands. The visitor may still explore other
 * assumptions (spec §36.1) — those are sent and reported back as REQUESTED.
 *
 * Without a listing, the form opens pre-filled from `defaults`, which the page
 * fetched server-side from GET /api/v1/platform/public-settings/ (Task 2's
 * `finance_configuration`). Those are the platform's real current values, so
 * spec §2.1's ban on invented or hard-coded operational data is satisfied by
 * using the live configuration rather than by showing nothing, and spec §17.5's
 * "changes automatically affect boat cards and the finance page" holds without
 * a frontend deploy. `defaults === null` means no active configuration (or an
 * unreachable endpoint): the three fields open empty rather than guessing.
 *
 * Price is never pre-filled in manual mode — the platform has no opinion about
 * which boat a visitor with no listing has in mind.
 */
export default function FinanceCalculator({
  locale,
  listingId,
  fallbackPrice,
  currency,
  defaults,
}: {
  locale: Locale;
  listingId: string | null;
  fallbackPrice: string | null;
  currency: string;
  defaults: FinanceConfigurationDefaults | null;
}) {
  const [values, setValues] = useState<Assumptions>(() => initialValues(defaults));
  const [quote, setQuote] = useState<FinanceQuote | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [listingUsable, setListingUsable] = useState(listingId !== null);

  function applyQuote(result: FinanceQuote) {
    setQuote(result);
    setValues({
      annual_rate_percent: result.annual_rate_percent,
      term_months: String(result.term_months),
      down_payment_percent: result.down_payment_percent,
      price: result.price,
    });
  }

  function reportFailure(error: unknown) {
    const code = error instanceof ApiError ? error.code : "";
    if (code === "finance_not_available_for_listing" || code === "listing_not_found") {
      setListingUsable(false);
      setNotice(tf(locale, "finance.page.listing_unavailable"));
      return;
    }
    setNotice(tf(locale, "finance.page.generic_error"));
  }

  useEffect(() => {
    if (listingId === null) {
      return;
    }
    // The listing is the only input to the first request; explorations go
    // through the form's submit handler. State is set only from the promise
    // callbacks, and a superseded request must not overwrite a newer one.
    let cancelled = false;
    requestFinanceQuote({ listing_id: listingId }).then(
      (result) => {
        if (!cancelled) {
          applyQuote(result);
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          reportFailure(error);
        }
      },
    );
    return () => {
      cancelled = true;
    };
    // applyQuote/reportFailure only close over setters and `locale`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const complete =
    values.price !== "" &&
    values.annual_rate_percent !== "" &&
    values.term_months !== "" &&
    values.down_payment_percent !== "";
  const usingListing = listingId !== null && listingUsable;
  const canSubmit = usingListing
    ? values.annual_rate_percent !== "" &&
      values.term_months !== "" &&
      values.down_payment_percent !== ""
    : complete;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    const assumptions = {
      annual_rate_percent: values.annual_rate_percent,
      term_months: Number(values.term_months),
      down_payment_percent: values.down_payment_percent,
    };
    setNotice(null);
    requestFinanceQuote(
      usingListing
        ? { listing_id: listingId as string, ...assumptions }
        : { price: values.price, currency, ...assumptions },
    ).then(applyQuote, reportFailure);
  }

  function field(name: keyof Assumptions, labelKey: string, disabled = false) {
    return (
      <label className="flex flex-col gap-space-xs font-body-sm">
        <span>{tf(locale, labelKey)}</span>
        <input
          name={name}
          value={values[name]}
          disabled={disabled}
          inputMode="decimal"
          onChange={(event) =>
            setValues((current) => ({ ...current, [name]: event.target.value }))
          }
          className="rounded-lg border border-outline-variant px-space-sm py-space-xs"
        />
      </label>
    );
  }

  // Spec §18.3: the query price is an immediate display fallback while the
  // authoritative quote loads, and nothing more.
  // The query string is attacker-controlled, so a non-decimal value is dropped
  // rather than handed to the strict formatter (which throws).
  const displayedPrice =
    quote?.price ??
    (fallbackPrice !== null && isFinanceablePrice({ amount: fallbackPrice, currency })
      ? fallbackPrice
      : null);

  return (
    <div className="mt-space-lg grid gap-space-lg md:grid-cols-2">
      <form onSubmit={submit} className="flex flex-col gap-space-sm">
        {usingListing ? (
          <p className="font-body-sm text-on-surface-variant">
            {tf(locale, "finance.page.listing_context")}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="font-body-sm text-on-surface-variant">
            {notice}
          </p>
        ) : null}
        {field("price", "finance.page.price", usingListing)}
        {field("annual_rate_percent", "finance.annual_rate")}
        {field("term_months", "finance.term")}
        {field("down_payment_percent", "finance.down_payment")}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-space-sm rounded-lg bg-primary px-space-md py-space-sm text-on-primary disabled:opacity-50"
        >
          {tf(locale, "finance.page.recalculate")}
        </button>
      </form>

      <section aria-live="polite" className="flex flex-col gap-space-xs">
        <p data-testid="finance-price" className="font-body-md text-on-surface-variant">
          {displayedPrice ? safeMoney(locale, displayedPrice, currency) : null}
        </p>
        {quote ? (
          <>
            <p className="font-headline-sm text-headline-sm text-primary">
              {safeMoney(locale, quote.monthly_payment, quote.currency)}
            </p>
            <dl className="grid grid-cols-2 gap-x-space-sm gap-y-space-xs font-body-sm">
              <dt>{tf(locale, "finance.down_payment")}</dt>
              <dd className="text-right">
                {safeMoney(locale, quote.down_payment_amount, quote.currency)}
              </dd>
              <dt>{tf(locale, "finance.amount_financed")}</dt>
              <dd className="text-right">
                {safeMoney(locale, quote.principal, quote.currency)}
              </dd>
              <dt>{tf(locale, "finance.total_installments")}</dt>
              <dd className="text-right">
                {safeMoney(locale, quote.total_payment, quote.currency)}
              </dd>
              <dt>{tf(locale, "finance.total_interest")}</dt>
              <dd className="text-right">
                {safeMoney(locale, quote.total_interest, quote.currency)}
              </dd>
            </dl>
          </>
        ) : null}
        {/* Spec §36.1: the disclaimer stays visible while the visitor explores. */}
        <p className="mt-space-sm font-body-sm text-on-surface-variant">
          {tf(locale, "finance.illustrative_disclaimer")}
        </p>
      </section>
    </div>
  );
}
