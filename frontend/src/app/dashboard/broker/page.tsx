"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useState } from "react";

import { ListingCard } from "@/components/listings/MyListings";
import { fetchMyListings, type MyListingRow } from "@/lib/api/sellerListings";
import { useLocale } from "@/lib/i18n/useLocale";

import RequirePermission from "@/components/auth/RequirePermission";
import { primaryBrokerMembership } from "@/components/broker/BrokerDashboardNav";
import OnboardingChecklist from "@/components/broker/OnboardingChecklist";
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
  const [listings, setListings] = useState<MyListingRow[] | null>(null);

  const locale = useLocale();
  const membership = primaryBrokerMembership(session);
  const live = membership?.broker_status === "ACTIVE";
  const brokerId = live ? (membership?.broker_id ?? null) : null;

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

  useEffect(() => {
    if (loading || brokerId === null) return;
    let cancelled = false;
    fetchMyListings().then(
      (rows) => {
        if (!cancelled) setListings(rows.filter((row) => row.seller_type === "BROKER"));
      },
      () => {},
    );
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
            <div className="flex flex-wrap items-end justify-between gap-space-md">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Brokerage / Dashboard</span>
                <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Dashboard</h1>
                <p className="mt-space-xs font-body-md text-on-surface-variant">
                  {membership.broker_name}
                  {live ? (
                    <>
                      {" · "}
                      <Link href={`/brokers/${membership.broker_slug}/`} className="text-primary underline">
                        View public page
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <Link
                href="/dashboard/broker/fleet/new/"
                className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container"
              >
                Add vessel
              </Link>
            </div>
            {membership.broker_status !== "ACTIVE" ? <OnboardingChecklist status={membership.broker_status} /> : null}
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
            {live ? (
            <section aria-labelledby="inventory-heading" className="mt-space-xl">
              <div className="flex flex-wrap items-baseline justify-between gap-space-sm">
                <h2 id="inventory-heading" className="font-headline-sm text-headline-sm text-primary">
                  Your vessels
                </h2>
                <Link href="/dashboard/broker/fleet/" className="font-label-md text-primary underline">
                  All vessels
                </Link>
              </div>
              <ul className="mt-space-md flex flex-col gap-space-md">
                {(listings ?? []).slice(0, 5).map((row) => (
                  <ListingCard key={row.id} row={row} />
                ))}
                {listings && listings.length === 0 ? (
                  <li className="rounded-xl bg-surface-container-lowest p-space-lg font-body-md text-on-surface-variant shadow-sm">
                    No vessels yet. <Link href="/dashboard/broker/fleet/new/" className="text-primary underline">Add your first vessel</Link>.
                  </li>
                ) : null}
              </ul>
            </section>
            ) : null}
          </>
        )}
      </RequirePermission>
    </AreaShell>
  );
}
