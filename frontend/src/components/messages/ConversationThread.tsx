"use client";

import { useT } from "@/i18n/client";
import ReplyComposer from "@/components/messages/ReplyComposer";
import type { ConversationRow, MessageRow } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import { formatDateTime } from "@/lib/i18n/datetime";
import type { Locale } from "@/lib/i18n/directory";

interface Props {
  locale: Locale;
  conversation: ConversationRow;
  messages: MessageRow[];
  onSend: (body: string) => Promise<void>;
  onToggleArchive: (next: "OPEN" | "ARCHIVED") => Promise<void>;
}

/** Spec 28's thread: "messages, context sidebar, listing/profile link and reply
 * composer". Presentational — every network call belongs to the parent screen,
 * which is what lets this identical component serve both the role-neutral and
 * the broker-scoped route. */
export default function ConversationThread({
  locale,
  conversation,
  messages,
  onSend,
  onToggleArchive,
}: Props) {
  const t = useT();
  const isOpen = conversation.status === "OPEN";
  const archived = conversation.status === "ARCHIVED";
  // Ruling 5: only the recipient side may file, because spec 11.8 gives
  // Conversation one shared `status` column and a sender who archived would be
  // pulling a live lead out of the brokerage's default inbox. `viewer_is_initiator`
  // comes from the server (spec 2.1); this is the control's visibility, and
  // messaging.services.set_conversation_status is the rule.
  const canFile =
    conversation.status !== "BLOCKED" && !conversation.viewer_is_initiator;

  return (
    <div>
      <section aria-labelledby="thread-subject">
        <div className="flex flex-wrap items-center gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
          <h1
            id="thread-subject"
            className="font-headline-sm text-headline-sm text-primary"
          >
            {conversation.subject}
          </h1>
          {/* Gated on the exact status, never on `!== "OPEN"`. A BLOCKED thread
              is not an archived one, and spec 2.1 forbids showing a state the
              data does not support — the earlier `!== "OPEN"` form labelled
              every blocked conversation "Archived". */}
          {conversation.context.type === "BROKER" || conversation.context.type === "LISTING" ? (
            <p className="w-full font-body-sm text-on-surface-variant">
              {conversation.context.type === "BROKER"
                ? tConversations(locale, "messages.thread.about_profile")
                : `${tConversations(locale, "messages.thread.about")}: ${conversation.context.label}`}
            </p>
          ) : null}
          {conversation.status === "ARCHIVED" ? (
            <span className="rounded border border-outline-variant px-space-xs font-label-sm text-label-sm text-on-surface-variant">
              {tConversations(locale, "messages.archived_badge")}
            </span>
          ) : null}
          {conversation.status === "BLOCKED" ? (
            <span className="rounded border border-outline-variant px-space-xs font-label-sm text-label-sm text-on-surface-variant">
              {tConversations(locale, "messages.blocked_badge")}
            </span>
          ) : null}
          {canFile ? (
            <button
              type="button"
              onClick={() => void onToggleArchive(archived ? "OPEN" : "ARCHIVED")}
              className="ml-auto rounded-full border border-outline-variant px-space-md py-space-xs font-label-md text-label-md text-primary"
            >
              {tConversations(
                locale,
                archived ? "messages.unarchive" : "messages.archive",
              )}
            </button>
          ) : null}
        </div>

        {messages.length === 0 ? (
          <p className="mt-space-lg font-body-md text-on-surface-variant">
            {tConversations(locale, "messages.thread.empty")}
          </p>
        ) : (
          <ol className="mt-space-lg flex flex-col gap-space-lg">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`max-w-[85%] rounded-xl p-space-md shadow-sm ${
                  message.sender.is_you && !message.is_system
                    ? "ml-auto bg-primary text-on-primary"
                    : "bg-surface-container-lowest"
                }`}
              >
                {/* The attribution is its OWN span, for the same reason the
                    inbox row splits its context label: Testing Library matches
                    an element on the concatenation of its direct text-node
                    children, so leaving the name and the " · " separator as
                    siblings of <time> inside this <p> would give it the text
                    "You ·" and no exact query could address "You". */}
                <p className="font-label-md text-label-md opacity-70">
                  <span>
                    {message.is_system
                      ? tConversations(locale, "messages.thread.system_note")
                      : message.sender.is_you
                        ? tConversations(locale, "messages.thread.you")
                        : message.sender.display_name.trim() ||
                          t("inquiry.sender_unnamed")}
                  </span>
                  <span aria-hidden="true">{" · "}</span>
                  <time dateTime={message.created_at}>
                    {formatDateTime(locale, message.created_at)}
                  </time>
                </p>
                <p className="mt-space-xs whitespace-pre-wrap font-body-md">
                  {message.body}
                </p>
              </li>
            ))}
          </ol>
        )}

        <ReplyComposer locale={locale} disabled={!isOpen} onSend={onSend} />
      </section>

    </div>
  );
}
