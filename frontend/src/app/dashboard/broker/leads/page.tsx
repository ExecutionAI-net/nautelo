"use client";

import RequirePermission from "@/components/auth/RequirePermission";
import { primaryBrokerMembership } from "@/components/broker/BrokerDashboardNav";
import AreaShell from "@/components/layout/AreaShell";
import MessagesScreen from "@/components/messages/MessagesScreen";
import { useSession } from "@/lib/auth/session";

// Leads are the listing inquiries that reach the brokerage; the thread route is
// the broker messages one.
export default function BrokerLeadsPage() {
  const { session } = useSession();
  const membership = primaryBrokerMembership(session);
  return (
    <AreaShell area="broker" active="/dashboard/broker/leads/">
      <RequirePermission>
        {membership === null ? (
          <p className="font-body-md text-on-surface-variant">No brokerage is linked to this account.</p>
        ) : (
          <MessagesScreen brokerId={membership.broker_id} basePath="/dashboard/broker/messages/" filter="LISTING" />
        )}
      </RequirePermission>
    </AreaShell>
  );
}
