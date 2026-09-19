import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import SellerOverview from "@/components/seller/SellerOverview";

export const dynamic = "force-dynamic";

export default function SellerOverviewPage() {
  return (
    <AreaShell area="seller" active="/dashboard/private-seller/">
      <RequirePermission>
        <SellerOverview />
      </RequirePermission>
    </AreaShell>
  );
}
