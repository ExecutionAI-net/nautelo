import RequirePermission from "@/components/auth/RequirePermission";
import EditListing from "@/components/listings/EditListing";
import AreaShell from "@/components/layout/AreaShell";

/** Editing a fleet vessel stays inside the brokerage area (the shared /sell/<id>/ route is the seller area). */
export default async function EditFleetVesselPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  return (
    <AreaShell area="broker" active="/dashboard/broker/fleet/">
      <RequirePermission permission="create_broker_listing">
        <EditListing listingId={listingId} />
      </RequirePermission>
    </AreaShell>
  );
}
