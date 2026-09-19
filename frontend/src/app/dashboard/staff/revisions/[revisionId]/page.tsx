import RequirePermission from "@/components/auth/RequirePermission";
import RevisionReview from "@/components/staff/RevisionReview";

export default async function StaffRevisionPage({
  params,
}: {
  params: Promise<{ revisionId: string }>;
}) {
  const { revisionId } = await params;
  return (
    <main className="mx-auto w-full max-w-4xl p-space-lg">
      <RequirePermission permission="approve_listings_and_revisions">
        <RevisionReview revisionId={revisionId} />
      </RequirePermission>
    </main>
  );
}
