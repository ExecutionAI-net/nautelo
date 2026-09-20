import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import ProviderTeam from "@/components/provider/ProviderTeam";

export const dynamic = "force-dynamic";

export default function ProviderTeamPage() {
  return (
    <AreaShell area="provider" active="/dashboard/service-provider/team/">
      <RequirePermission>
        <ProviderTeam />
      </RequirePermission>
    </AreaShell>
  );
}
