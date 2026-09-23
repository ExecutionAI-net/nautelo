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
  /** Small label above the heading; defaults to the seat's console name. */
  eyebrow?: string;
  /** Replaces the listing-oriented intro (the professional's requests page is about services). */
  intro?: string;
  /** Replaces the "Messages" heading (the broker's Leads page shows one slice of the inbox). */
  heading?: string;
  /** Hide the inbox filter chips (a page that IS one filter has nothing to switch). */
  filters?: boolean;
  /** Replaces the empty-state sentence. */
  empty?: string;
}

export default function MessagesScreen({ brokerId, basePath, filter, selectedId, eyebrow, intro, heading, filters = true, empty }: Props) {
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
  ) : rows.length === 0 && empty ? (
    <p className="mt-space-lg font-body-md text-on-surface-variant">{empty}</p>
  ) : (
    <div className="mt-space-lg">
      <ConversationList locale={locale} rows={rows} hrefFor={(id) => `${basePath}${id}/`} />
    </div>
  );

  return (
    <section aria-labelledby="messages-title">
      <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">
        {eyebrow ?? (brokerId ? "Brokerage / Messages" : "Seller area / Enquiries & messages")}
      </span>
      <h1 id="messages-title" className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">
        {heading ?? tConversations(locale, "messages.title")}
      </h1>
      {selectedId ? null : (
        <p className="mt-space-sm font-body-md text-on-surface-variant">
          {intro ?? tConversations(locale, "messages.intro")}
        </p>
      )}
      <div className={selectedId ? "mt-space-lg grid items-start gap-space-md lg:grid-cols-12" : undefined}>
        <div className={selectedId ? "hidden lg:col-span-5 lg:block" : undefined}>
          {filters ? (
            <div className="mt-space-lg">
              <ConversationFilters
                locale={locale}
                active={filter}
                hrefFor={(value) => `${basePath}?filter=${value}`}
              />
            </div>
          ) : null}
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
