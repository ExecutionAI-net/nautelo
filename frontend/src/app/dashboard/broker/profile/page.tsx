import RequirePermission from "@/components/auth/RequirePermission";
import { BrokerProfileForm } from "@/components/broker/BrokerWorkspace";
import AreaShell from "@/components/layout/AreaShell";

export default function BrokerProfilePage() {
  return (
    <AreaShell area="broker" active="/dashboard/broker/profile/">
      <RequirePermission>
        <BrokerProfileForm />
      </RequirePermission>
    </AreaShell>
  );
}
