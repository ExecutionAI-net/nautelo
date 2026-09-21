import Link from "@/components/layout/LocaleLink";

import { formatPrice, type PlanSummary } from "@/lib/api/plans";

function limitText(value: number | null, singular: string, plural: string): React.ReactNode {
  return value === null ? (
    <strong>Unlimited {plural}</strong>
  ) : (
    <>
      Up to <strong>{value} {value === 1 ? singular : plural}</strong>
    </>
  );
}

/** The membership tiers, laid out as in the approved design. `currentSlug` marks the enrolled tier. */
export default function PlanCards({
  plans,
  currentSlug,
  ctaHref = "/contact/",
  ctaLabel = "Talk to the platform team",
}: {
  plans: PlanSummary[];
  currentSlug?: string | null;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg items-stretch">
      {plans.map((plan) => {
        const current = plan.slug === currentSlug;
        const tick = current ? "text-secondary-fixed" : "text-secondary";
        return (
          <div
            key={plan.slug}
            className={`${current ? "bg-primary text-on-primary shadow-xl" : "bg-surface-container-lowest shadow-sm"} rounded-xl p-space-xl flex flex-col justify-between gap-space-xl relative overflow-hidden`}
          >
            {current ? (
              <div className="absolute top-0 right-0 bg-secondary px-space-md py-1 rounded-bl-lg font-label-sm uppercase tracking-widest text-on-secondary font-semibold">
                Active Tier
              </div>
            ) : null}
            <div className="flex flex-col gap-space-md">
              <div>
                <h3 className={`font-headline-sm text-headline-sm ${current ? "text-on-primary" : "text-primary"}`}>{plan.name}</h3>
                <p className={`font-body-sm text-body-sm ${current ? "text-on-primary-container" : "text-on-surface-variant"}`}>{plan.tagline}</p>
              </div>
              <div className="flex items-baseline gap-1 py-space-xs">
                <span className={`font-headline-lg text-headline-lg ${current ? "text-on-primary" : "text-primary"}`}>
                  {formatPrice(plan.monthly_price, plan.currency)}
                </span>
                <span className={`font-body-sm text-body-sm ${current ? "text-on-primary-container" : "text-on-surface-variant"}`}>/ month</span>
              </div>
              <ul className={`flex flex-col gap-space-sm text-body-md pt-space-sm ${current ? "text-on-primary" : "text-on-surface"}`}>
                <li className="flex items-center gap-space-sm">
                  <span className={`material-symbols-outlined ${tick} text-[18px]`} aria-hidden="true">check</span>
                  <span>{limitText(plan.listing_limit, "Active Vessel Listing", "Active Vessel Listings")}</span>
                </li>
                <li className="flex items-center gap-space-sm">
                  <span className={`material-symbols-outlined ${tick} text-[18px]`} aria-hidden="true">check</span>
                  <span>{limitText(plan.seat_limit, "Team Seat", "Team Seats")}</span>
                </li>
                <li className="flex items-center gap-space-sm">
                  <span className={`material-symbols-outlined ${tick} text-[18px]`} aria-hidden="true">check</span>
                  <span>
                    Directory profile: <strong>{plan.profile_visibility}</strong>
                  </span>
                </li>
              </ul>
            </div>
            {current ? (
              <button type="button" disabled className="w-full bg-surface-container-lowest/15 text-on-primary font-body-md py-space-sm px-space-md rounded cursor-default text-center font-medium">
                Currently Enrolled
              </button>
            ) : (
              <Link href={ctaHref} className="w-full bg-surface-container-high hover:bg-surface-container text-primary font-body-md py-space-sm px-space-md rounded transition-colors text-center">
                {ctaLabel}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
