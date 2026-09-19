import RequirePermission from "@/components/auth/RequirePermission";
import { BrokerSubscription } from "@/components/broker/BrokerWorkspace";
import AreaShell from "@/components/layout/AreaShell";

export default function BrokerSubscriptionPage() {
  return (
    <AreaShell area="broker" active="/dashboard/broker/subscription/">
      <RequirePermission>
        <BrokerSubscription />
      </RequirePermission>
    </AreaShell>
  );
}
