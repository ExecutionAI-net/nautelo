import RequirePermission from "@/components/auth/RequirePermission";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import AreaShell from "@/components/layout/AreaShell";

export default function BrokerNotificationsPage() {
  return (
    <AreaShell area="broker" active="/dashboard/broker/notifications/">
      <RequirePermission>
        <NotificationPreferences />
      </RequirePermission>
    </AreaShell>
  );
}
