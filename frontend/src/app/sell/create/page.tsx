import RequirePermission from "@/components/auth/RequirePermission";
import SellListing from "@/components/listings/SellListing";
import AreaShell from "@/components/layout/AreaShell";

export default function SellPage() {
  return (
    <AreaShell area="seller" active="/dashboard/private-seller/listings/">
      <RequirePermission permission="create_private_listing">
        <SellListing />
      </RequirePermission>
    </AreaShell>
  );
}
