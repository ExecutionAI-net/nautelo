import Link from "next/link";

import type { ConversationRow } from "@/lib/api/conversations";
import {
  formatConversationMessage,
  tConversations,
} from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";
import { tInquiry } from "@/lib/i18n/inquiry";

interface Props {
  locale: Locale;
  row: ConversationRow;
  href: string;
}

/** Spec 28's conversation row: "sender display name, context/listing, last
 * message excerpt, timestamp and unread count."
 *
 * Carries no contact value of any kind. Phase 6's serializers return none, and
 * ConversationRow has no field that could hold one — contact reveal is Phase 7's
 * own endpoint, after a grant. */
export default function ConversationRowCard({ locale, row, href }: Props) {
  const senderName =
    row.counterparty_name.trim() ||
    tInquiry(locale, "inquiry.sender_unnamed");

  return (
    <Link
      href={href}
      className={`relative flex gap-space-sm bg-surface-container-lowest p-space-md transition-colors hover:bg-surface-container-low/60 ${row.unread_count > 0 ? "bg-surface-container-low" : ""}`}
    >
      {row.unread_count > 0 ? <span aria-hidden="true" className="absolute bottom-0 left-0 top-0 w-1.5 bg-secondary" /> : null}
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-label-md text-on-primary">
        {senderName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-space-sm">
        <span className="font-title-sm text-title-sm text-on-surface">
          {senderName}
        </span>
        {/* The context type and the context label are SEPARATE elements, not
            one span holding `type + " · " + label`. Testing Library matches an
            element on the concatenation of its direct text-node children, so a
            single span would have the accessible text "Broker · Phase19 Alpha
            Brokers" and no exact query could ever address the label on its own.
            Splitting them makes each independently assertable and costs one
            element; the flex `gap-space-sm` on the parent already spaces them,
            and the separator is decorative so it is aria-hidden. */}
        <span className="font-body-sm text-on-surface-variant">
          {tConversations(locale, `messages.context.${row.context.type}`)}
        </span>
        {row.context.label ? (
          <>
            <span aria-hidden="true" className="font-body-sm text-on-surface-variant">
              ·
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {row.context.label}
            </span>
          </>
        ) : null}
        {row.status === "ARCHIVED" ? (
          // Spec 29.6: never convey state by colour alone. Gated on ARCHIVED
          // exactly, never on `!== "OPEN"` — a BLOCKED thread is not archived,
          // and labelling it "Archived" would be a false visible state (spec 2.1).
          <span className="rounded border border-outline-variant px-space-xs font-label-sm text-label-sm text-on-surface-variant">
            {tConversations(locale, "messages.archived_badge")}
          </span>
        ) : null}
        {row.status === "BLOCKED" ? (
          <span className="rounded border border-outline-variant px-space-xs font-label-sm text-label-sm text-on-surface-variant">
            {tConversations(locale, "messages.blocked_badge")}
          </span>
        ) : null}
        {row.unread_count > 0 ? (
          <span className="rounded-full bg-primary px-space-sm font-label-sm text-label-sm text-on-primary">
            {formatConversationMessage(
              tConversations(locale, "messages.unread_count"),
              { count: row.unread_count },
            )}
          </span>
        ) : null}
        {row.last_message_at ? (
          // No `role` attribute: `time` is not an ARIA role, and jsx-a11y
          // rejects inventing one. The test addresses this with
          // container.querySelector("time").
          <time
            dateTime={row.last_message_at}
            className="ml-auto font-body-sm text-on-surface-variant"
          >
            {new Date(row.last_message_at).toLocaleString(locale)}
          </time>
        ) : null}
      </div>
      <p className="mt-space-xs truncate font-body-md text-on-surface-variant">
        {row.last_message_excerpt}
      </p>
      </div>
    </Link>
  );
}
