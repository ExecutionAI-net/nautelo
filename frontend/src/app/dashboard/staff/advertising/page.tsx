import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import ContentAdmin from "@/components/staff/ContentAdmin";

export const dynamic = "force-dynamic";

export default function StaffAdvertisingPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/advertising/">
      <RequirePermission permission="configure_products_and_settings">
        <ContentAdmin only="ads" />
      </RequirePermission>
    </AreaShell>
  );
}
