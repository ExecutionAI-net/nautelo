import RequirePermission from "@/components/auth/RequirePermission";
import SettingsScreen from "@/components/staff/SettingsScreen";
import AreaShell from "@/components/layout/AreaShell";

export default function SettingsPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/settings/">
      <RequirePermission permission="configure_products_and_settings">
        <SettingsScreen />
      </RequirePermission>
    </AreaShell>
  );
}
