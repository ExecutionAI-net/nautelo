import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import MessagesScreen from "@/components/messages/MessagesScreen";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise.
type Params = Promise<{ conversationId: string }>;

/** One service request, opened inside the service provider area. */
export default async function ProviderRequestThreadPage({ params }: { params: Params }) {
  const { conversationId } = await params;
  return (
    <AreaShell area="provider" active="/dashboard/service-provider/requests/">
      <RequirePermission>
        <MessagesScreen
          basePath="/dashboard/service-provider/requests/"
          filter="ALL"
          selectedId={conversationId}
          eyebrow="Service provider / Requests"
          heading="Requests"
        />
      </RequirePermission>
    </AreaShell>
  );
}
