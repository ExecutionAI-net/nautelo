import RequirePermission from "@/components/auth/RequirePermission";
import MessagesScreen from "@/components/messages/MessagesScreen";
import AreaShell from "@/components/layout/AreaShell";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise.
type Params = Promise<{ conversationId: string }>;

export default async function ThreadPage({ params }: { params: Params }) {
  const { conversationId } = await params;
  return (
    <AreaShell area="seller" active="/dashboard/private-seller/messages/">
      <RequirePermission>
        <MessagesScreen basePath="/dashboard/private-seller/messages/" filter="ALL" selectedId={conversationId} />
      </RequirePermission>
    </AreaShell>
  );
}
