import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import ProviderProfileForm from "@/components/provider/ProviderProfileForm";

export const dynamic = "force-dynamic";

export default function ProviderProfilePage() {
  return (
    <AreaShell area="provider" active="/dashboard/service-provider/profile/">
      <RequirePermission>
        <ProviderProfileForm />
      </RequirePermission>
    </AreaShell>
  );
}
