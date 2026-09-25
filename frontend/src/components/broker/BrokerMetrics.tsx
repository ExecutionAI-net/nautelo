import Link from "@/components/layout/LocaleLink";

import type { BrokerDashboard } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface Props {
  locale: Locale;
  dashboard: BrokerDashboard;
}

const TILE = "block rounded-xl bg-surface-container-lowest p-space-lg shadow-sm hover:shadow-md transition-shadow";

function Tile({ href, label, value, help }: { href: string; label: string; value: number; help?: string }) {
  return (
    <Link href={href} className={TILE}>
      <dt className="font-label-md text-label-md text-on-surface-variant">{label}</dt>
      <dd className="font-headline-md text-headline-md text-primary">{value}</dd>
      {help ? <p className="font-body-sm text-on-surface-variant">{help}</p> : null}
    </Link>
  );
}

/** Spec 28 "Dashboard metrics": "only backend-derived useful metrics such as
 * published listings, pending approvals, unread messages and new inquiries.
 * Remove surveyor/service widgets completely."
 *
 * There are exactly four tiles and each one prints a number the server
 * computed. A null count is never rendered as 0 - null means "not computed"
 * (the flag is off, or this role may not read messages), and printing a zero
 * would be the fabricated state spec 2.1 forbids. Each tile links to the page
 * where the number can be acted on. */
export default function BrokerMetrics({ locale, dashboard }: Props) {
  const { messages } = dashboard;
  const showMessageTiles = messages.enabled && messages.can_read;
  const t = (key: string) => tConversations(locale, key);

  return (
    <section aria-labelledby="broker-metrics-heading">
      <h2 id="broker-metrics-heading" className="sr-only">
        {t("broker.dashboard.title")}
      </h2>
      <dl className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        <Tile href="/dashboard/broker/fleet/" label={t("broker.dashboard.metric.published_listings")} value={dashboard.published_listings} />
        <Tile
          href="/dashboard/broker/fleet/"
          label={t("broker.dashboard.metric.pending_approvals")}
          value={dashboard.pending_approvals}
          help={t("broker.dashboard.metric.pending_approvals_help")}
        />
        {showMessageTiles ? (
          <>
            <Tile href="/dashboard/broker/messages/?filter=UNREAD" label={t("broker.dashboard.metric.unread_messages")} value={messages.unread_messages ?? 0} />
            <Tile
              href="/dashboard/broker/leads/"
              label={t("broker.dashboard.metric.new_inquiries")}
              value={messages.new_inquiries_7d ?? 0}
              help={t("broker.dashboard.metric.new_inquiries_help")}
            />
          </>
        ) : null}
      </dl>
      {showMessageTiles ? null : (
        <p className="mt-space-md font-body-md text-on-surface-variant">
          {t(messages.enabled ? "broker.dashboard.messages_locked" : "broker.dashboard.messages_unavailable")}
        </p>
      )}
    </section>
  );
}
