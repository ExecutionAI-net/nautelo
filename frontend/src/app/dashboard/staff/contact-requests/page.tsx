import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffContactRequests from "@/components/staff/StaffContactRequests";

export const dynamic = "force-dynamic";

export default function StaffContactRequestsPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/contact-requests/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffContactRequests />
      </RequirePermission>
    </AreaShell>
  );
}
