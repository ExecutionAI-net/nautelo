import RequirePermission from "@/components/auth/RequirePermission";
import MyListings from "@/components/listings/MyListings";
import AreaShell from "@/components/layout/AreaShell";

export default function MyListingsPage() {
  return (
    <AreaShell area="seller" active="/dashboard/listings/">
      <RequirePermission>
        <MyListings />
      </RequirePermission>
    </AreaShell>
  );
}
