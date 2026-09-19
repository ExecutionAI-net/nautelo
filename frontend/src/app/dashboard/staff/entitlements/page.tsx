import RequirePermission from "@/components/auth/RequirePermission";
import EntitlementLedger from "@/components/staff/EntitlementLedger";
import AreaShell from "@/components/layout/AreaShell";

export default function StaffEntitlementsPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/entitlements/">
      <RequirePermission permission="configure_products_and_settings">
        <EntitlementLedger />
      </RequirePermission>
    </AreaShell>
  );
}
