import RequirePermission from "@/components/auth/RequirePermission";
import ThreadScreen from "@/components/messages/ThreadScreen";
import AreaShell from "@/components/layout/AreaShell";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise.
type Params = Promise<{ conversationId: string }>;

export default async function ThreadPage({ params }: { params: Params }) {
  const { conversationId } = await params;
  return (
    <AreaShell area="seller" active="/dashboard/messages/">
      <RequirePermission>
        <ThreadScreen
          conversationId={conversationId}
          basePath="/dashboard/messages/"
        />
      </RequirePermission>
    </AreaShell>
  );
}
