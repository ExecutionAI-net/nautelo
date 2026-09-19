import RequirePermission from "@/components/auth/RequirePermission";
import { BrokerTeam } from "@/components/broker/BrokerWorkspace";
import AreaShell from "@/components/layout/AreaShell";

export default function BrokerTeamPage() {
  return (
    <AreaShell area="broker" active="/dashboard/broker/team/">
      <RequirePermission>
        <BrokerTeam />
      </RequirePermission>
    </AreaShell>
  );
}
