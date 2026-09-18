"use client";

import { useId, useState } from "react";

import { requestFinanceQuote, type FinanceQuote } from "@/lib/api/listings";
import type { Locale } from "@/lib/i18n/directory";
import { formatMoney, tf } from "@/lib/i18n/finance";

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
  const panelId = useId();
  const disclaimerId = useId();
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<FinanceQuote | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    // On close, and once a quote is in hand, there is nothing to ask for. A
    // previous failure left `quote` null, so the next open retries.
    if (!next || quote || loading) {
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      setQuote(await requestFinanceQuote({ listing_id: listingId }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  // Money is formatted from the server's decimal strings; the rate is the
  // server's own string, printed verbatim so no digit is re-rounded here.
  const rows: [string, string][] = quote
    ? [
        [
          "finance.down_payment",
          formatMoney(locale, quote.down_payment_amount, quote.currency),
        ],
        ["finance.amount_financed", formatMoney(locale, quote.principal, quote.currency)],
        ["finance.term", tf(locale, "finance.months", { count: quote.term_months })],
        ["finance.annual_rate", `${quote.annual_rate_percent}%`],
        [
          "finance.total_installments",
          formatMoney(locale, quote.total_payment, quote.currency),
        ],
        ["finance.total_interest", formatMoney(locale, quote.total_interest, quote.currency)],
      ]
    : [];

  return (
    <div className="mt-space-xs">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="font-body-sm text-on-surface-variant underline"
      >
        {tf(locale, open ? "finance.details.hide" : "finance.details.show")}
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
            {loading ? <p>{tf(locale, "finance.details.loading")}</p> : null}
            {failed ? <p className="text-error">{tf(locale, "finance.details.error")}</p> : null}
            {rows.length > 0 ? (
              <>
                <dl
                  data-testid="finance-assumptions"
                  aria-describedby={disclaimerId}
                  className="grid grid-cols-2 gap-x-space-sm gap-y-space-xs"
                >
                  {rows.map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt>{tf(locale, key)}</dt>
                      <dd className="text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p id={disclaimerId} className="mt-space-xs">
                  {tf(locale, "finance.illustrative_disclaimer")}
                </p>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
