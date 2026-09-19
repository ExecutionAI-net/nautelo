import RequirePermission from "@/components/auth/RequirePermission";
import ThreadScreen from "@/components/messages/ThreadScreen";

// An async SERVER component, unlike its sibling inbox page: it needs no session
// and no searchParams, only the route param. Its test therefore calls it
// directly, while the inbox page's test renders it as an element inside
// Suspense. The difference is deliberate; do not unify them.
export const dynamic = "force-dynamic";

type Params = Promise<{ conversationId: string }>;

export default async function BrokerThreadPage({ params }: { params: Params }) {
  const { conversationId } = await params;
  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission>
        <ThreadScreen
          conversationId={conversationId}
          basePath="/dashboard/broker/messages/"
        />
      </RequirePermission>
    </main>
  );
}
