import RequirePermission from "@/components/auth/RequirePermission";
import AccountSettings from "@/components/auth/AccountSettings";
import AreaShell from "@/components/layout/AreaShell";

// The professional's own login account, kept inside the service provider
// area: a professional account has nothing to do with the private seller area.
export default function ProviderAccountPage() {
  return (
    <AreaShell area="provider" active="/dashboard/service-provider/account/">
      <RequirePermission>
        <AccountSettings area="provider" />
      </RequirePermission>
    </AreaShell>
  );
}
