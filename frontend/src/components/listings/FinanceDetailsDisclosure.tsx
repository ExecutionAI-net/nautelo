"use client";

import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n";
import { useEffect, useId, useRef, useState } from "react";

import { safeMoney } from "@/components/listings/money";
import { requestFinanceQuote, type FinanceQuote } from "@/lib/api/finance-quote";
import type { Locale } from "@/lib/i18n/directory";

/**
 * Spec §18.1's optional details disclosure. "It must use live calculation
 * results, never fixed sample copy" — so the figures come from the server's own
 * quote (spec §17.4 context 1), not from arithmetic in the browser. The request
 * is made on first open and kept: this is the "explicit calculator interaction"
 * spec §11.6 says is the only card event worth logging, which is why it is a
 * real request rather than five more fields on every card of a 24-card page.
 *
 * Spec §2.5: the mandated disclaimer accompanies these figures and is tied to
 * them with aria-describedby, so a screen reader reaches it from the numbers
 * themselves. The card's own estimate points at the region's one footnote
 * instead (spec §18.1); this panel appears on demand, below that footnote's
 * asterisk, so it carries its own copy of the sentence.
 */
export default function FinanceDetailsDisclosure({
  locale,
  listingId,
}: {
  locale: Locale;
  listingId: string;
}) {
  const t = useT();
  const panelId = useId();
  const disclaimerId = useId();
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<FinanceQuote | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  // A card can be scrolled out of a virtualised list, or the whole page
  // navigated away from, while the POST is in flight; the answer must not then
  // be written into a component that no longer exists.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    // On close, and once a quote is in hand, there is nothing to ask for; while
    // one request is in flight a second open must not start another. A previous
    // failure left `quote` null, so the next open retries.
    if (!next || quote || loading) {
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      const answer = await requestFinanceQuote({ listing_id: listingId });
      if (alive.current) {
        setQuote(answer);
      }
    } catch {
      if (alive.current) {
        setFailed(true);
      }
    } finally {
      if (alive.current) {
        setLoading(false);
      }
    }
  }

  // Every money value goes through the shared guard: formatMoney throws a
  // RangeError on a malformed amount or currency, and a RangeError raised
  // during render unmounts this subtree — the panel and its own button would
  // disappear and the error would reach the page's error boundary. A row that
  // cannot be rendered is dropped instead; the rate is the server's own string,
  // printed verbatim so no digit is re-rounded here.
  const money = (amount: string) => (quote ? safeMoney(locale, amount, quote.currency) : null);
  // The monthly payment is the figure this panel exists to explain. If it
  // cannot be rendered, the quote as a whole is unusable (a bad currency takes
  // every money row with it), and the reader gets the translated unavailable
  // state rather than a panel with two lonely rows in it.
  const headline = quote ? money(quote.monthly_payment) : null;
  const rows: [string, string][] =
    quote && headline
      ? (
          [
            ["finance.down_payment", money(quote.down_payment_amount)],
            ["finance.amount_financed", money(quote.principal)],
            ["finance.term", t("finance.months", { count: quote.term_months })],
            ["finance.annual_rate", `${quote.annual_rate_percent}%`],
            ["finance.total_installments", money(quote.total_payment)],
            ["finance.total_interest", money(quote.total_interest)],
          ] as [string, string | null][]
        ).filter((row): row is [string, string] => row[1] !== null)
      : [];
  const unavailable = failed || (quote !== null && headline === null);

  return (
    <div className="mt-space-xs">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="font-body-sm text-on-surface-variant underline"
      >
        {t(open ? "finance.details.hide" : "finance.details.show")}
      </button>
      {/* The panel element exists whether or not it is open, so aria-controls
          always resolves, and it is the one polite live region: the result, the
          progress message and the failure message all land inside it. */}
      <div
        id={panelId}
        role="status"
        aria-live="polite"
        className="mt-space-xs font-body-sm text-on-surface-variant"
      >
        {open ? (
          <>
            {loading ? <p>{t("finance.details.loading")}</p> : null}
            {unavailable ? (
              <p className="text-error">{t("finance.details.error")}</p>
            ) : null}
            {rows.length > 0 ? (
              <>
                <dl
                  data-testid="finance-assumptions"
                  aria-describedby={disclaimerId}
                  className="grid grid-cols-2 gap-x-space-sm gap-y-space-xs"
                >
                  {rows.map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt>{t(key as MessageKey)}</dt>
                      <dd className="text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p id={disclaimerId} className="mt-space-xs">
                  {t("finance.illustrative_disclaimer")}
                </p>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
