import RequirePermission from "@/components/auth/RequirePermission";
import RevisionReview from "@/components/staff/RevisionReview";
import AreaShell from "@/components/layout/AreaShell";

export default async function StaffRevisionPage({
  params,
}: {
  params: Promise<{ revisionId: string }>;
}) {
  const { revisionId } = await params;
  return (
    <AreaShell area="staff" active="/dashboard/staff/">
      <RequirePermission permission="approve_listings_and_revisions">
        <RevisionReview revisionId={revisionId} />
      </RequirePermission>
    </AreaShell>
  );
}
