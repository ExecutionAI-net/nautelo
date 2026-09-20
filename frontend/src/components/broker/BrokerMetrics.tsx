import type { BrokerDashboard } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface Props {
  locale: Locale;
  dashboard: BrokerDashboard;
}

const TILE = "rounded-xl bg-surface-container-lowest p-space-lg shadow-sm";

/** Spec 28 "Dashboard metrics": "only backend-derived useful metrics such as
 * published listings, pending approvals, unread messages and new inquiries.
 * Remove surveyor/service widgets completely."
 *
 * There are exactly four tiles and each one prints a number the server
 * computed. A null count is never rendered as 0 — null means "not computed"
 * (the flag is off, or this role may not read messages), and printing a zero
 * would be the fabricated state spec 2.1 forbids. */
export default function BrokerMetrics({ locale, dashboard }: Props) {
  const { messages } = dashboard;
  const showMessageTiles = messages.enabled && messages.can_read;

  return (
    <section aria-labelledby="broker-metrics-heading">
      <h2 id="broker-metrics-heading" className="sr-only">
        {tConversations(locale, "broker.dashboard.title")}
      </h2>
      <dl className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        <div className={TILE}>
          <dt className="font-label-md text-label-md text-on-surface-variant">
            {tConversations(locale, "broker.dashboard.metric.published_listings")}
          </dt>
          <dd className="font-headline-md text-headline-md text-primary">
            {dashboard.published_listings}
          </dd>
        </div>
        <div className={TILE}>
          <dt className="font-label-md text-label-md text-on-surface-variant">
            {tConversations(locale, "broker.dashboard.metric.pending_approvals")}
          </dt>
          <dd className="font-headline-md text-headline-md text-primary">
            {dashboard.pending_approvals}
          </dd>
        </div>
        {showMessageTiles ? (
          <>
            <div className={TILE}>
              <dt className="font-label-md text-label-md text-on-surface-variant">
                {tConversations(
                  locale,
                  "broker.dashboard.metric.unread_messages",
                )}
              </dt>
              <dd className="font-headline-md text-headline-md text-primary">
                {messages.unread_messages}
              </dd>
            </div>
            <div className={TILE}>
              <dt className="font-label-md text-label-md text-on-surface-variant">
                {tConversations(locale, "broker.dashboard.metric.new_inquiries")}
              </dt>
              <dd className="font-headline-md text-headline-md text-primary">
                {messages.new_inquiries_7d}
              </dd>
              <p className="font-body-sm text-on-surface-variant">
                {tConversations(
                  locale,
                  "broker.dashboard.metric.new_inquiries_help",
                )}
              </p>
            </div>
          </>
        ) : null}
      </dl>
      {showMessageTiles ? null : (
        <p className="mt-space-md font-body-md text-on-surface-variant">
          {tConversations(
            locale,
            messages.enabled
              ? "broker.dashboard.messages_locked"
              : "broker.dashboard.messages_unavailable",
          )}
        </p>
      )}
    </section>
  );
}
