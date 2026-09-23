import RequirePermission from "@/components/auth/RequirePermission";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import AreaShell from "@/components/layout/AreaShell";

export default function ProviderNotificationsPage() {
  return (
    <AreaShell area="provider" active="/dashboard/service-provider/notifications/">
      <RequirePermission>
        <NotificationPreferences />
      </RequirePermission>
    </AreaShell>
  );
}
