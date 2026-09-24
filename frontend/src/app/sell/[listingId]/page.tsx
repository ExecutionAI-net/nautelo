import RequirePermission from "@/components/auth/RequirePermission";
import EditListing from "@/components/listings/EditListing";
import AreaShell from "@/components/layout/AreaShell";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  return (
    <AreaShell area="seller" active="/dashboard/private-seller/listings/" title="Edit listing">
      <RequirePermission>
        <EditListing listingId={listingId} />
      </RequirePermission>
    </AreaShell>
  );
}
