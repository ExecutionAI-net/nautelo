import type { Metadata } from "next";

import RequirePermission from "@/components/auth/RequirePermission";
import MessagesScreen from "@/components/messages/MessagesScreen";
import { resolveFilter } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";
import AreaShell from "@/components/layout/AreaShell";

// The inbox is per-person and authenticated; there is nothing to cache or
// prerender.
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return { title: tConversations(DEFAULT_LOCALE, "messages.title") };
}

// Next 16: searchParams is a Promise. Verify against
// node_modules/next/dist/docs/ before changing this signature.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <AreaShell area="seller" active="/dashboard/messages/">
      {/* Ruling 13: no permission argument. There is no PermissionKey for
          "has conversations", and the real authorization is server-side. This
          is the sign-in redirect every other private route in this project
          uses. */}
      <RequirePermission>
        <MessagesScreen
          basePath="/dashboard/messages/"
          filter={resolveFilter(first(params.filter))}
        />
      </RequirePermission>
    </AreaShell>
  );
}
