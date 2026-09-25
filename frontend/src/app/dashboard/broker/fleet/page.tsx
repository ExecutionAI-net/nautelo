import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import MyListings from "@/components/listings/MyListings";
import { getT } from "@/i18n/server";

export default async function FleetPage() {
  const t = await getT();
  return (
    <AreaShell area="broker" active="/dashboard/broker/fleet/">
      <RequirePermission permission="create_broker_listing">
        <MyListings
          fleet
          eyebrow={t("sell.my_listings.fleet_eyebrow")}
          heading={t("sell.my_listings.fleet_heading")}
          createHref="/dashboard/broker/fleet/new/"
          createLabel={t("sell.my_listings.fleet_add_vessel")}
        />
      </RequirePermission>
    </AreaShell>
  );
}
