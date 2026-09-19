import RequirePermission from "@/components/auth/RequirePermission";
import MyListings from "@/components/listings/MyListings";
import AreaShell from "@/components/layout/AreaShell";

export default function MyListingsPage() {
  return (
    <AreaShell area="seller" active="/dashboard/private-seller/listings/">
      <RequirePermission>
        <MyListings />
      </RequirePermission>
    </AreaShell>
  );
}
