import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import MyListings from "@/components/listings/MyListings";

export default function FleetPage() {
  return (
    <AreaShell area="broker" active="/dashboard/broker/fleet/">
      <RequirePermission permission="create_broker_listing">
        <MyListings
          fleet
          eyebrow="Brokerage / Fleet"
          heading="Fleet"
          createHref="/dashboard/broker/fleet/new/"
          createLabel="Add vessel"
        />
      </RequirePermission>
    </AreaShell>
  );
}
