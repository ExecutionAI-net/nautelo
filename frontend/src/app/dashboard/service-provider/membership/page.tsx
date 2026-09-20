import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import ProviderMembership from "@/components/provider/ProviderMembership";

export const dynamic = "force-dynamic";

export default function ProviderMembershipPage() {
  return (
    <AreaShell area="provider" active="/dashboard/service-provider/membership/">
      <RequirePermission>
        <ProviderMembership />
      </RequirePermission>
    </AreaShell>
  );
}
