import RequirePermission from "@/components/auth/RequirePermission";
import ThreadScreen from "@/components/messages/ThreadScreen";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise.
type Params = Promise<{ conversationId: string }>;

export default async function ThreadPage({ params }: { params: Params }) {
  const { conversationId } = await params;
  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission>
        <ThreadScreen
          conversationId={conversationId}
          basePath="/dashboard/messages/"
        />
      </RequirePermission>
    </main>
  );
}
