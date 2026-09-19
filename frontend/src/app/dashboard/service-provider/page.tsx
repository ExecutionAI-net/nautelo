import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import ProviderOverview from "@/components/provider/ProviderOverview";

export const dynamic = "force-dynamic";

export default function ProviderPage() {
  return (
    <AreaShell area="provider" active="/dashboard/service-provider/">
      <RequirePermission>
        <ProviderOverview />
      </RequirePermission>
    </AreaShell>
  );
}
