import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import MessagesScreen from "@/components/messages/MessagesScreen";

export const dynamic = "force-dynamic";

// Service requests are professional-inquiry conversations; the role-neutral
// thread route serves the detail view.
export default function ProviderRequestsPage() {
  return (
    <AreaShell area="provider" active="/dashboard/service-provider/requests/">
      <RequirePermission>
        <MessagesScreen
          basePath="/dashboard/private-seller/messages/"
          filter="ALL"
          eyebrow="Service requests"
          intro="Requests from boat owners and buyers who contacted your profile. Reply here; contact details are shared only with the person who wrote to you."
        />
      </RequirePermission>
    </AreaShell>
  );
}
