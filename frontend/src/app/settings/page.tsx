import RequirePermission from "@/components/auth/RequirePermission";
import ProductSettings from "@/components/staff/ProductSettings";
import AreaShell from "@/components/layout/AreaShell";

export default function SettingsPage() {
  return (
    <AreaShell area="staff" active="/settings/">
      <RequirePermission permission="configure_products_and_settings">
        <ProductSettings />
      </RequirePermission>
    </AreaShell>
  );
}
