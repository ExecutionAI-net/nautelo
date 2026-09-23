import RequirePermission from "@/components/auth/RequirePermission";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import AreaShell from "@/components/layout/AreaShell";

export default function SellerNotificationsPage() {
  return (
    <AreaShell area="seller" active="/dashboard/private-seller/notifications/">
      <RequirePermission>
        <NotificationPreferences />
      </RequirePermission>
    </AreaShell>
  );
}
