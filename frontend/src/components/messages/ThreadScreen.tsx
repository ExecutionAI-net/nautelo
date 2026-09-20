"use client";

import { useLocale } from "@/lib/i18n/useLocale";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import ConversationThread from "@/components/messages/ConversationThread";
import {
  fetchConversation,
  fetchThread,
  markConversationRead,
  messageErrorKey,
  postReply,
  setConversationStatus,
  type ConversationRow,
  type MessageRow,
} from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import { resolveLocale } from "@/lib/i18n/directory";
import { useSession } from "@/lib/auth/session";

interface Props {
  conversationId: string;
  basePath: string;
}

export default function ThreadScreen({ conversationId, basePath }: Props) {
  const { session, loading } = useSession();
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const locale = useLocale();
  const authenticated = session?.authenticated === true;
  const fetching = loadedId !== conversationId;

  useEffect(() => {
    if (loading || !authenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        // fetchConversation, NOT a scan of fetchConversations("ALL"): the inbox
        // returns one page of 20, so scanning it would report "not available"
        // for a broker's 21st conversation (ruling 14).
        const [row, thread] = await Promise.all([
          fetchConversation(conversationId),
          fetchThread(conversationId),
        ]);
        if (cancelled) return;
        setConversation(row);
        setMessages(thread.results);
        setErrorKey(null);
        // Fire-and-forget: a failed mark-read must not stop a person reading.
        void markConversationRead(conversationId).catch(() => undefined);
      } catch (caught) {
        if (!cancelled) setErrorKey(messageErrorKey(caught));
      } finally {
        if (!cancelled) setLoadedId(conversationId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, authenticated, conversationId]);

  const onSend = useCallback(
    async (body: string) => {
      try {
        const message = await postReply(conversationId, body);
        setMessages((current) => [...current, message]);
        setErrorKey(null);
      } catch (caught) {
        setErrorKey(messageErrorKey(caught));
        // Rethrown so ReplyComposer keeps the person's text.
        throw caught;
      }
    },
    [conversationId],
  );

  const onToggleArchive = useCallback(
    async (next: "OPEN" | "ARCHIVED") => {
      try {
        setConversation(await setConversationStatus(conversationId, next));
        setErrorKey(null);
      } catch (caught) {
        setErrorKey(messageErrorKey(caught));
      }
    },
    [conversationId],
  );

  if (loading || (authenticated && fetching)) {
    return (
      <p className="font-body-md text-on-surface-variant" aria-busy="true">
        {tConversations(locale, "messages.loading")}
      </p>
    );
  }
  if (!authenticated) {
    return (
      <p className="font-body-md text-on-surface-variant">
        {tConversations(locale, "messages.error.authentication_required")}
      </p>
    );
  }

  return (
    <div>
      <Link
        href={basePath}
        className="font-label-md text-label-md text-primary underline"
      >
        {tConversations(locale, "messages.thread.back")}
      </Link>
      {errorKey ? (
        <p role="alert" className="mt-space-md font-body-md text-error">
          {tConversations(locale, errorKey)}
        </p>
      ) : null}
      {conversation ? (
        <div className="mt-space-lg">
          <ConversationThread
            locale={locale}
            conversation={conversation}
            messages={messages}
            onSend={onSend}
            onToggleArchive={onToggleArchive}
          />
        </div>
      ) : null}
    </div>
  );
}
