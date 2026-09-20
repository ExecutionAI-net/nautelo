"use client";

import { useLocale } from "@/lib/i18n/useLocale";
import { useEffect, useState } from "react";

import ConversationFilters from "@/components/messages/ConversationFilters";
import ConversationList from "@/components/messages/ConversationList";
import ThreadScreen from "@/components/messages/ThreadScreen";
import {
  fetchConversations,
  messageErrorKey,
  type ConversationFilter,
  type ConversationRow,
} from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import { resolveLocale } from "@/lib/i18n/directory";
import { useSession } from "@/lib/auth/session";

interface Props {
  /** Present on the broker route, absent on the role-neutral one. It becomes
   * `?broker=<id>` and is the ONLY difference between the two mounts. */
  brokerId?: string;
  /** e.g. "/dashboard/private-seller/messages/" or "/dashboard/broker/messages/". Every href
   * on this screen is built from it, which is what lets one component serve
   * both routes (spec 28's "share components where practical"). */
  basePath: string;
  filter: ConversationFilter;
  /** When set, the thread opens beside the list (two-pane inbox from lg up). */
  selectedId?: string;
}

export default function MessagesScreen({ brokerId, basePath, filter, selectedId }: Props) {
  const { session, loading } = useSession();
  const [result, setResult] = useState<{
    key: string;
    rows: ConversationRow[];
    errorKey: string | null;
  } | null>(null);

  const locale = useLocale();
  const authenticated = session?.authenticated === true;
  const key = `${filter}|${brokerId ?? ""}`;
  const fetching = result?.key !== key;
  const rows = result?.rows ?? [];
  const errorKey = result?.errorKey ?? null;

  useEffect(() => {
    // Nothing is fetched while `loading` is true. SessionProvider trades the
    // HttpOnly refresh cookie for an access token BEFORE the first session
    // call, so a fetch fired earlier would carry no Authorization header and
    // 401 - and the 401 would then be reported to a person who is signed in.
    if (loading || !authenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await fetchConversations(filter, { brokerId });
        if (!cancelled) setResult({ key, rows: page.results, errorKey: null });
      } catch (caught) {
        if (!cancelled) {
          setResult({ key, rows: [], errorKey: messageErrorKey(caught) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, authenticated, filter, brokerId, key]);

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

  const list = errorKey ? (
    <p role="alert" className="mt-space-lg font-body-md text-error">
      {tConversations(locale, errorKey)}
    </p>
  ) : (
    <div className="mt-space-lg">
      <ConversationList locale={locale} rows={rows} hrefFor={(id) => `${basePath}${id}/`} />
    </div>
  );

  return (
    <section aria-labelledby="messages-title">
      <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">
        {brokerId ? "Brokerage CRM" : "Owner console"}
      </span>
      <h1 id="messages-title" className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">
        {tConversations(locale, "messages.title")}
      </h1>
      {selectedId ? null : (
        <p className="mt-space-sm font-body-md text-on-surface-variant">
          {tConversations(locale, "messages.intro")}
        </p>
      )}
      <div className={selectedId ? "mt-space-lg grid items-start gap-space-md lg:grid-cols-12" : undefined}>
        <div className={selectedId ? "hidden lg:col-span-5 lg:block" : undefined}>
          <div className="mt-space-lg">
            <ConversationFilters
              locale={locale}
              active={filter}
              hrefFor={(value) => `${basePath}?filter=${value}`}
            />
          </div>
          {list}
        </div>
        {selectedId ? (
          <div className="lg:col-span-7">
            <ThreadScreen conversationId={selectedId} basePath={basePath} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
