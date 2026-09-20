import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffSubscriptions from "@/components/staff/StaffSubscriptions";

export const dynamic = "force-dynamic";

export default function StaffSubscriptionsPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/subscriptions/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffSubscriptions />
      </RequirePermission>
    </AreaShell>
  );
}
