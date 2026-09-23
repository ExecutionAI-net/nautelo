import RequirePermission from "@/components/auth/RequirePermission";
import NotificationList from "@/components/notifications/NotificationList";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import AreaShell from "@/components/layout/AreaShell";

export default function SellerNotificationsPage() {
  return (
    <AreaShell area="seller" active="/dashboard/private-seller/notifications/">
      <RequirePermission>
        <div className="flex flex-col gap-space-xl">
          <NotificationList />
          <NotificationPreferences />
        </div>
      </RequirePermission>
    </AreaShell>
  );
}
