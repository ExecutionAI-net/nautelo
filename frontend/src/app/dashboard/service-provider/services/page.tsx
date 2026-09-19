import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import ProviderServicesManager from "@/components/provider/ProviderServicesManager";

export const dynamic = "force-dynamic";

export default function ProviderServicesPage() {
  return (
    <AreaShell area="provider" active="/dashboard/service-provider/services/">
      <RequirePermission>
        <ProviderServicesManager />
      </RequirePermission>
    </AreaShell>
  );
}
