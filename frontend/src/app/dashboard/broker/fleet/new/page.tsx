import RequirePermission from "@/components/auth/RequirePermission";
import FleetListingPage from "@/components/listings/FleetListingPage";
import AreaShell from "@/components/layout/AreaShell";

export default function NewFleetVesselPage() {
  return (
    <AreaShell area="broker" active="/dashboard/broker/fleet/" title="Add a vessel">
      <RequirePermission permission="create_broker_listing">
        <FleetListingPage />
      </RequirePermission>
    </AreaShell>
  );
}
