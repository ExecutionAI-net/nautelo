import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import ContentAdmin from "@/components/staff/ContentAdmin";

export const dynamic = "force-dynamic";

export default function StaffContentPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/content/">
      <RequirePermission permission="configure_products_and_settings">
        <ContentAdmin only="guides" />
      </RequirePermission>
    </AreaShell>
  );
}
