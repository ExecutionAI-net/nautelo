import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import EmailTemplatesAdmin from "@/components/staff/EmailTemplatesAdmin";

export const dynamic = "force-dynamic";

export default function StaffEmailTemplatesPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/email-templates/">
      <RequirePermission permission="configure_products_and_settings">
        <EmailTemplatesAdmin />
      </RequirePermission>
    </AreaShell>
  );
}
