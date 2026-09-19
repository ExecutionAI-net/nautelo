import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffReports from "@/components/staff/StaffReports";

export const dynamic = "force-dynamic";

export default function StaffReportsPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/reports/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffReports />
      </RequirePermission>
    </AreaShell>
  );
}
