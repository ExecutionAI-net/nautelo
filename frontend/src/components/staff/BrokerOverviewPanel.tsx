import {
  LISTING_STATUS_ORDER,
  type StaffBrokerDetail,
} from "@/lib/api/staffBrokers";
import type { Locale } from "@/lib/i18n/directory";
import { tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * Spec §21 "Staff broker UI" items 1 and 2: account status and listing counts
 * by status.
 *
 * Every one of spec §6.1's seven states is rendered even at zero, because the
 * backend always sends all seven (spec §26 definition of done: "All visible
 * counters equal query results") and a row that disappears at zero reads as
 * missing data rather than as an answer.
 */
export default function BrokerOverviewPanel({
  locale,
  broker,
}: {
  locale: Locale;
  broker: StaffBrokerDetail;
}) {
  return (
    <section
      aria-labelledby="broker-overview-heading"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md"
    >
      <h2
        id="broker-overview-heading"
        className="font-title-lg text-title-lg text-primary"
      >
        {tStaffBroker(locale, "staff.broker.account_status")}
      </h2>
      <p
        data-testid="broker-account-status"
        className="mt-space-xs font-body-md text-on-surface"
      >
        {tStaffBroker(locale, `staff.broker.status.${broker.status}`)}
      </p>

      <h3 className="mt-space-md font-title-md text-title-md text-on-surface">
        {tStaffBroker(locale, "staff.broker.listing_counts")}
      </h3>
      <dl className="mt-space-sm grid grid-cols-2 gap-space-sm sm:grid-cols-4">
        {LISTING_STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="rounded-lg bg-surface-container px-space-sm py-space-xs"
          >
            <dt className="font-body-sm text-on-surface-variant">
              {tStaffBroker(locale, `staff.broker.listing_status.${status}`)}
            </dt>
            <dd
              data-testid={`listing-count-${status}`}
              className="font-title-md text-title-md text-on-surface"
            >
              {broker.listing_counts.by_status[status]}
            </dd>
          </div>
        ))}
        <div className="rounded-lg bg-secondary-container px-space-sm py-space-xs">
          <dt className="font-body-sm text-on-secondary-container">
            {tStaffBroker(locale, "staff.broker.listing_counts.total")}
          </dt>
          <dd
            data-testid="listing-count-total"
            className="font-title-md text-title-md text-on-secondary-container"
          >
            {broker.listing_counts.total}
          </dd>
        </div>
      </dl>
      <p className="mt-space-sm font-body-sm text-on-surface-variant">
        {tStaffBroker(locale, "staff.broker.no_quota")}
      </p>
    </section>
  );
}
