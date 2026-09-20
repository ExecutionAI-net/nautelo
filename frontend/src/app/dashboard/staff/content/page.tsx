import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import GuidesAdmin from "@/components/staff/GuidesAdmin";

export const dynamic = "force-dynamic";

export default function StaffContentPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/content/">
      <RequirePermission permission="configure_products_and_settings">
        <GuidesAdmin />
      </RequirePermission>
    </AreaShell>
  );
}
