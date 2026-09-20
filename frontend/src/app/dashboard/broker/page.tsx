"use client";

import { useLocale } from "@/lib/i18n/useLocale";
import { useEffect, useState } from "react";

import RequirePermission from "@/components/auth/RequirePermission";
import { primaryBrokerMembership } from "@/components/broker/BrokerDashboardNav";
import BrokerMetrics from "@/components/broker/BrokerMetrics";
import {
  fetchBrokerDashboard,
  messageErrorKey,
  type BrokerDashboard,
} from "@/lib/api/conversations";
import { useSession } from "@/lib/auth/session";
import { tConversations } from "@/lib/i18n/conversations";
import { resolveLocale } from "@/lib/i18n/directory";
import AreaShell from "@/components/layout/AreaShell";

export default function BrokerHomePage() {
  const { session, loading } = useSession();
  const [dashboard, setDashboard] = useState<BrokerDashboard | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const locale = useLocale();
  const membership = primaryBrokerMembership(session);
  const brokerId = membership?.broker_id ?? null;

  useEffect(() => {
    // Same session-timing rule as the messages screens: nothing is fetched
    // until SessionProvider has finished trading the refresh cookie.
    if (loading || brokerId === null) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchBrokerDashboard(brokerId);
        if (cancelled) return;
        setDashboard(result);
        setErrorKey(null);
      } catch (caught) {
        if (cancelled) return;
        setDashboard(null);
        setErrorKey(messageErrorKey(caught));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, brokerId]);

  return (
    <AreaShell area="broker" active="/dashboard/broker/">
      <RequirePermission>
        {membership === null ? (
          <p className="font-body-md text-on-surface-variant">
            {tConversations(locale, "broker.dashboard.no_organization")}
          </p>
        ) : (
          <>
            <h1 className="font-headline-md text-headline-md text-primary">
              {membership.broker_name}
            </h1>
            {errorKey ? (
              <p role="alert" className="mt-space-lg font-body-md text-error">
                {tConversations(locale, errorKey)}
              </p>
            ) : null}
            {dashboard ? (
              <div className="mt-space-lg">
                <BrokerMetrics locale={locale} dashboard={dashboard} />
              </div>
            ) : null}
          </>
        )}
      </RequirePermission>
    </AreaShell>
  );
}
