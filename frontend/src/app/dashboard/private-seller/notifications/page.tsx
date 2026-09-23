import RequirePermission from "@/components/auth/RequirePermission";
import NotificationList from "@/components/notifications/NotificationList";
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
import AreaShell from "@/components/layout/AreaShell";

export default function SellerNotificationsPage() {
  return (
    <AreaShell area="seller" active="/dashboard/private-seller/notifications/">
      <RequirePermission>
        <div className="flex flex-col gap-space-xl">
          <div>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Seller area / Notifications</span>
            <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Notifications</h1>
          </div>
          <NotificationList />
          <NotificationPreferences />
        </div>
      </RequirePermission>
    </AreaShell>
  );
}
