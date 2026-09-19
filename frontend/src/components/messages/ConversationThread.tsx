"use client";

import ConversationContextPanel from "@/components/messages/ConversationContextPanel";
import ReplyComposer from "@/components/messages/ReplyComposer";
import type { ConversationRow, MessageRow } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";
import { tInquiry } from "@/lib/i18n/inquiry";

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
    <div className="grid gap-space-lg lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="thread-subject">
        <div className="flex flex-wrap items-center gap-space-sm">
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
          <ol className="mt-space-lg flex flex-col gap-space-md">
            {messages.map((message) => (
              <li
                key={message.id}
                className="rounded-xl border border-outline-variant p-space-md"
              >
                {/* The attribution is its OWN span, for the same reason the
                    inbox row splits its context label: Testing Library matches
                    an element on the concatenation of its direct text-node
                    children, so leaving the name and the " · " separator as
                    siblings of <time> inside this <p> would give it the text
                    "You ·" and no exact query could address "You". */}
                <p className="font-label-md text-label-md text-on-surface-variant">
                  <span>
                    {message.is_system
                      ? tConversations(locale, "messages.thread.system_note")
                      : message.sender.is_you
                        ? tConversations(locale, "messages.thread.you")
                        : message.sender.display_name.trim() ||
                          tInquiry(locale, "inquiry.sender_unnamed")}
                  </span>
                  <span aria-hidden="true">{" · "}</span>
                  <time dateTime={message.created_at}>
                    {new Date(message.created_at).toLocaleString(locale)}
                  </time>
                </p>
                <p className="mt-space-xs whitespace-pre-wrap font-body-md text-on-surface">
                  {message.body}
                </p>
              </li>
            ))}
          </ol>
        )}

        <ReplyComposer locale={locale} disabled={!isOpen} onSend={onSend} />
      </section>

      <ConversationContextPanel locale={locale} context={conversation.context} />
    </div>
  );
}
