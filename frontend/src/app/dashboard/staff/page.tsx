import RequirePermission from "@/components/auth/RequirePermission";
import ModerationQueue from "@/components/staff/ModerationQueue";
import AreaShell from "@/components/layout/AreaShell";

export default function StaffHomePage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/">
      <RequirePermission permission="approve_listings_and_revisions">
        <ModerationQueue />
      </RequirePermission>
    </AreaShell>
  );
}
