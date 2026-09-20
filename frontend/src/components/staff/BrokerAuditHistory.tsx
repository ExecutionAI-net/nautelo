import type { BrokerAuditEntry } from "@/lib/api/staffBrokers";
import type { Locale } from "@/lib/i18n/directory";
import {
  STAFF_BROKER_MESSAGES,
  formatStaffTimestamp,
  tStaffBroker,
} from "@/lib/i18n/staff-brokers";

/**
 * Spec §21 "Staff broker UI" item 6: the audit history of this organization's
 * policy actions, straight from `audit.AuditEvent` — no derived or invented
 * rows (spec §2.1, §2.4).
 *
 * An action with no translation key renders as its raw machine code rather than
 * throwing: the audit trail is append-only and immutable, so a row written by a
 * future phase will show up here long before this dictionary learns about it,
 * and a staff screen that crashes on an unknown-but-real event is worse than
 * one that shows the code.
 */
function actionLabel(locale: Locale, action: string): string {
  const key = `staff.broker.audit.${action}`;
  return key in STAFF_BROKER_MESSAGES ? tStaffBroker(locale, key) : action;
}

export default function BrokerAuditHistory({
  locale,
  entries,
}: {
  locale: Locale;
  entries: BrokerAuditEntry[];
}) {
  return (
    <section
      aria-labelledby="broker-audit-heading"
      className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm"
    >
      <h2
        id="broker-audit-heading"
        className="font-title-lg text-title-lg text-primary"
      >
        {tStaffBroker(locale, "staff.broker.audit_history")}
      </h2>
      {entries.length === 0 ? (
        <p className="mt-space-sm font-body-md text-on-surface-variant">
          {tStaffBroker(locale, "staff.broker.audit_empty")}
        </p>
      ) : (
        <ol className="mt-space-sm flex flex-col gap-space-sm">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg bg-surface-container px-space-sm py-space-xs"
            >
              <p className="font-label-md text-label-md text-on-surface">
                {actionLabel(locale, entry.action)}
              </p>
              <p className="font-body-sm text-on-surface-variant">
                {`${entry.actor?.full_name || entry.actor?.email || ""} — ${formatStaffTimestamp(
                  locale,
                  entry.created_at,
                )}`}
              </p>
              {entry.reason ? (
                <p className="mt-space-xs font-body-sm text-on-surface">
                  {entry.reason}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
