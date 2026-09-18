"use client";

import { useEffect, useState } from "react";

import AutoApprovalPanel from "@/components/staff/AutoApprovalPanel";
import BrokerAuditHistory from "@/components/staff/BrokerAuditHistory";
import BrokerOverviewPanel from "@/components/staff/BrokerOverviewPanel";
import BulkApprovePanel from "@/components/staff/BulkApprovePanel";
import { ApiError } from "@/lib/api/client";
import {
  fetchStaffBrokerDetail,
  type StaffBrokerDetail,
} from "@/lib/api/staffBrokers";
import { useSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/directory";
import { tStaffBroker } from "@/lib/i18n/staff-brokers";

/**
 * Map a failed load onto one of this screen's own messages.
 *
 * The backend's `message` is deliberately never rendered: it can name a user or
 * carry a request id, and spec §21 enumerates exactly what this screen shows.
 * Each status still gets its own sentence, because "expired session", "not your
 * broker", "wrong address" and "server down" call for four different actions.
 */
export function loadFailureKey(caught: unknown): string {
  if (caught instanceof ApiError) {
    if (caught.status === 401) return "staff.broker.error.unauthenticated";
    if (caught.status === 403) return "staff.broker.error.forbidden";
    if (caught.status === 404) return "staff.broker.error.not_found";
    if (caught.status === 429) return "staff.broker.error.rate_limited";
    if (caught.status >= 500) return "staff.broker.error.server";
  }
  // A network failure, an aborted request or anything unrecognised.
  return "staff.broker.load_failed";
}

interface LoadResult {
  /** Which request produced this result — see `requestKey` below. */
  key: string;
  broker: StaffBrokerDetail | null;
  failureKey: string | null;
}

/**
 * The staff broker screen's data owner. Tasks 8 and 9 mount their panels here
 * and hand back a refreshed `StaffBrokerDetail`, so the whole screen stays
 * consistent after a mutation without a second GET — every mutation endpoint
 * returns the same detail payload (spec §30.2).
 *
 * The permission gate is the *page*, not this component: it renders whatever
 * the API returned, and the API is the authority (spec §2.2).
 */
export default function StaffBrokerDetailView({
  brokerId,
}: {
  brokerId: string;
}) {
  const { session, loading: sessionLoading, can } = useSession();
  const locale = resolveLocale(session?.locale);
  // The access token lives in memory in lib/api/client and is only populated
  // once SessionProvider has finished bootstrapping. Fetching before then sends
  // an unauthenticated request that comes straight back as a 401, so the load
  // waits for the session and re-runs if the signed-in identity changes.
  const identity = session?.user?.id ?? null;

  // A result is only shown while it still belongs to the broker and identity
  // currently on screen. Comparing keys at render time is what resets the panel
  // to "Loading…" when either changes — clearing the state from inside the
  // effect would be a synchronous setState in an effect body, which cascades an
  // extra render and is what react-hooks/set-state-in-effect forbids.
  const requestKey = JSON.stringify([brokerId, identity]);
  const [result, setResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    if (sessionLoading) return;

    let cancelled = false;

    void (async () => {
      try {
        const loaded = await fetchStaffBrokerDetail(brokerId);
        if (cancelled) return;
        setResult({ key: requestKey, broker: loaded, failureKey: null });
      } catch (caught) {
        if (cancelled) return;
        // Spec §2.1: render a real state, never an empty screen.
        setResult({
          key: requestKey,
          broker: null,
          failureKey: loadFailureKey(caught),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brokerId, sessionLoading, requestKey]);

  const current = result !== null && result.key === requestKey ? result : null;
  const broker = current?.broker ?? null;
  const failureKey = current?.failureKey ?? null;

  function setBroker(updated: StaffBrokerDetail) {
    setResult({ key: requestKey, broker: updated, failureKey: null });
  }

  if (failureKey !== null) {
    return (
      <p role="alert" className="font-body-md text-error">
        {tStaffBroker(locale, failureKey)}
      </p>
    );
  }

  if (broker === null) {
    return (
      <p
        role="status"
        aria-busy="true"
        className="font-body-md text-on-surface-variant"
      >
        {tStaffBroker(locale, "staff.broker.loading")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <h1 className="font-headline-md text-headline-md text-primary">
          {broker.name}
        </h1>
        <p className="font-body-sm text-on-surface-variant">{broker.slug}</p>
      </header>
      <BrokerOverviewPanel locale={locale} broker={broker} />
      <AutoApprovalPanel
        locale={locale}
        broker={broker}
        canConfigure={can("configure_broker_auto_approval")}
        // Every mutation endpoint returns the same detail payload, so the whole
        // screen refreshes from the response with no second GET (spec §30.2).
        onUpdated={setBroker}
      />
      <BulkApprovePanel locale={locale} broker={broker} onUpdated={setBroker} />
      <BrokerAuditHistory locale={locale} entries={broker.audit_history} />
    </div>
  );
}
