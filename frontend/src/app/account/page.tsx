import RequirePermission from "@/components/auth/RequirePermission";
import AccountSettings from "@/components/auth/AccountSettings";
import AreaShell from "@/components/layout/AreaShell";

export default function AccountPage() {
  return (
    <AreaShell area="seller" active="/account/">
      <RequirePermission>
        <AccountSettings />
      </RequirePermission>
    </AreaShell>
  );
}
