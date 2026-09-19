import Link from "next/link";

import type { ConversationContextRef } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

/** The route prefixes this application can actually navigate to today.
 *
 * `context.url` from the API is the entity's CANONICAL public URL per spec 4.1
 * and is truthful about the product; it is not a promise that this Next.js app
 * has built the page. `src/app/` has no `/boats/` and no `/brokers/` route, and
 * spec 39 forbids shipping a control that leads nowhere. Phase 20 builds both
 * and deletes this constant along with the check below. */
export const NAVIGABLE_URL_PREFIXES: readonly string[] = [
  "/services/professionals/",
  "/boats/",
  "/brokers/",
];

function isNavigable(url: string | null): url is string {
  return url !== null && NAVIGABLE_URL_PREFIXES.some((p) => url.startsWith(p));
}

interface Props {
  locale: Locale;
  context: ConversationContextRef;
}

/** Spec 28's thread "context sidebar, listing/profile link". */
export default function ConversationContextPanel({ locale, context }: Props) {
  const typeLabel = tConversations(locale, `messages.context.${context.type}`);
  return (
    <aside
      aria-labelledby="thread-context-heading"
      className="rounded-xl border border-outline-variant p-space-md"
    >
      <h2
        id="thread-context-heading"
        className="font-label-md text-label-md text-on-surface-variant"
      >
        {tConversations(locale, "messages.thread.context_heading")}
      </h2>
      <p className="mt-space-xs font-body-sm text-on-surface-variant">{typeLabel}</p>
      {isNavigable(context.url) ? (
        <Link
          href={context.url}
          className="mt-space-xs block font-title-sm text-title-sm text-primary underline"
        >
          {context.label}
        </Link>
      ) : (
        <p className="mt-space-xs font-title-sm text-title-sm text-on-surface">
          {context.label}
        </p>
      )}
    </aside>
  );
}
