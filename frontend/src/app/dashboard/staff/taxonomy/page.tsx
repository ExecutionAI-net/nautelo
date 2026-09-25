import RequirePermission from "@/components/auth/RequirePermission";
import TaxonomyAdmin from "@/components/staff/TaxonomyAdmin";
import OtherModelQueue from "@/components/staff/OtherModelQueue";
import AreaShell from "@/components/layout/AreaShell";

export default function StaffTaxonomyPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/taxonomy/">
      <RequirePermission permission="manage_taxonomy">
        <TaxonomyAdmin />
        <div className="mt-space-xl">
          <OtherModelQueue />
        </div>
      </RequirePermission>
    </AreaShell>
  );
}
