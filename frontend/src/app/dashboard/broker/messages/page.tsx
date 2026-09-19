"use client";

import { use } from "react";

import RequirePermission from "@/components/auth/RequirePermission";
import { primaryBrokerMembership } from "@/components/broker/BrokerDashboardNav";
import MessagesScreen from "@/components/messages/MessagesScreen";
// resolveFilter comes from lib/api/conversations, NOT from
// app/dashboard/messages/page.tsx. That module is a server route file: it also
// exports `generateMetadata` and `dynamic`, which are route configuration
// rather than values, and importing it from a "use client" module drags a
// server page into the client graph and breaks the build.
import { resolveFilter } from "@/lib/api/conversations";
import { useSession } from "@/lib/auth/session";
import { tConversations } from "@/lib/i18n/conversations";
import { resolveLocale } from "@/lib/i18n/directory";

// Next 16: searchParams is a Promise, including in a client component, where it
// is unwrapped with React's `use()`.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function BrokerMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = use(searchParams);
  const { session } = useSession();
  const locale = resolveLocale(session?.user?.locale);
  const membership = primaryBrokerMembership(session);

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission>
        {membership === null ? (
          <p className="font-body-md text-on-surface-variant">
            {tConversations(locale, "broker.dashboard.no_organization")}
          </p>
        ) : (
          <MessagesScreen
            brokerId={membership.broker_id}
            basePath="/dashboard/broker/messages/"
            filter={resolveFilter(first(params.filter))}
          />
        )}
      </RequirePermission>
    </main>
  );
}
