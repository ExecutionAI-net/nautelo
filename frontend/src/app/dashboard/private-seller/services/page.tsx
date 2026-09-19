import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import SellerServices from "@/components/seller/SellerServices";

export const dynamic = "force-dynamic";

export default function SellerServicesPage() {
  return (
    <AreaShell area="seller" active="/dashboard/private-seller/services/">
      <RequirePermission>
        <SellerServices />
      </RequirePermission>
    </AreaShell>
  );
}
