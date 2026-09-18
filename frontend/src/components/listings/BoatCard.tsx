import FinanceDetailsDisclosure from "@/components/listings/FinanceDetailsDisclosure";
import { financingHref, type ListingFinance, type PublicListing } from "@/lib/api/listings";
import type { Locale } from "@/lib/i18n/directory";
import { formatCount, formatMoney, isDecimalString, tf } from "@/lib/i18n/finance";

type EligibleFinance = Extract<ListingFinance, { visible: true }>;

/**
 * formatMoney throws on anything that is not a plain decimal string, and Intl
 * throws on a currency code that is not three letters. That strictness is right
 * — it is what keeps "NaN" off a price — but one bad row must not take down the
 * server render of a whole 24-card page, so the card drops a value it cannot
 * format and keeps the rest of the card. Returning null (never a placeholder
 * number) also keeps spec §2.1: nothing is invented.
 */
function money(locale: Locale, amount: string, currency: string): string | null {
  if (typeof amount !== "string" || !isDecimalString(amount)) {
    return null;
  }
  try {
    return formatMoney(locale, amount, currency);
  } catch {
    return null;
  }
}

/**
 * Spec §18.5 sends `{visible: false}` or the full six-key block, and §18.2
 * forbids zeroed or disabled finance placeholders — so a listing that is not
 * eligible loses the whole finance column. The parameter admits undefined on
 * purpose: the type says the key is always there, a payload from a future
 * snapshot version may disagree, and reading `.visible` off undefined would
 * throw and blank the page. A block whose monthly_payment is unusable is
 * filtered one step later, by `money` returning null.
 */
function eligibleFinance(finance: ListingFinance | undefined | null): EligibleFinance | null {
  return finance?.visible === true ? finance : null;
}

/**
 * Spec §29.1: "Every boat card uses one component and one API representation."
 * This is that component, and `listing` is that representation — nothing here
 * is computed from anything but the API row (spec §2.1).
 *
 * Spec §18.1's layout: the view count sits in the upper metadata row next to an
 * eye icon; the price stays left in the lower pricing row; the estimated
 * payment, when eligible, sits right in the same row; the calculator CTA sits
 * below it; the disclosure sits below that. When the listing is not eligible,
 * every one of those finance elements is absent — not disabled, not zeroed
 * (spec §18.2).
 */
export default function BoatCard({
  locale,
  listing,
  disclaimerId,
}: {
  locale: Locale;
  listing: PublicListing;
  disclaimerId: string;
}) {
  const modelName = listing.custom_model_name || listing.model_name;
  const heading = `${listing.manufacture_year} ${listing.brand_name} ${modelName}`;
  const location = [listing.location.city, listing.location.region]
    .filter(Boolean)
    .join(", ");
  const primaryImage = listing.media.find((item) => item.media_type === "IMAGE");
  const views = formatCount(locale, listing.view_count);
  const price = money(locale, listing.price.amount, listing.price.currency);
  const finance = eligibleFinance(listing.finance);
  const monthly = finance
    ? money(locale, finance.monthly_payment, listing.price.currency)
    : null;

  return (
    <article className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md">
      {/* Spec §29.1: primary approved image or a defined placeholder. Turning a
          storage_key into a CDN URL is Phase 15 (spec §24), so until then the
          placeholder is the defined state — not a fixture image. */}
      <div
        aria-hidden="true"
        data-testid={primaryImage ? "boat-image-slot" : "boat-image-placeholder"}
        className="mb-space-sm aspect-[4/3] w-full rounded-lg bg-surface-container-high"
      />

      <div className="flex items-center justify-between font-body-sm text-on-surface-variant">
        <span>{location}</span>
        {/* Spec §18.1: view count in the upper metadata row next to an eye icon.
            Spec §29.6: the icon is not the only means of conveying state, so the
            number carries an accessible label and the icon is hidden from it. */}
        <span
          className="inline-flex items-center gap-space-xs"
          aria-label={tf(locale, "listing.views_label", { count: views })}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>{views}</span>
        </span>
      </div>

      <h3 className="mt-space-xs font-title-lg text-title-lg text-primary">{heading}</h3>

      {/* Spec §29.5: this row stacks cleanly below a breakpoint and neither
          value truncates ambiguously. */}
      <div className="mt-space-sm flex flex-col gap-space-xs sm:flex-row sm:items-end sm:justify-between">
        {price ? (
          <p className="font-title-md text-title-md text-on-surface">{price}</p>
        ) : null}
        {monthly ? (
          // Spec §2.5: every estimate carries the disclaimer. The asterisk is
          // the sighted reader's route to the region's one footnote (spec
          // §18.1); aria-describedby is the same route for everyone else.
          <p
            data-testid="finance-estimate"
            aria-describedby={disclaimerId}
            className="text-right font-body-sm text-on-surface-variant"
          >
            <span className="block">{tf(locale, "finance.estimated_payment")}</span>
            <span className="font-title-sm text-title-sm text-on-surface">
              {`${monthly}${tf(locale, "finance.per_month")}`}
              <sup>
                <a href={`#${disclaimerId}`}>*</a>
              </sup>
            </span>
          </p>
        ) : null}
      </div>

      {monthly ? (
        <>
          <a
            className="mt-space-sm inline-flex items-center gap-space-xs font-body-md text-primary underline"
            href={financingHref(listing)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tf(locale, "finance.calculate")}
            <span aria-hidden="true">→</span>
          </a>
          <FinanceDetailsDisclosure locale={locale} listingId={listing.id} />
        </>
      ) : null}
    </article>
  );
}
