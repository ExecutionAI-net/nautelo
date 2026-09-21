import Link from "@/components/layout/LocaleLink";

import {
  CONVERSATION_FILTERS,
  FILTER_MESSAGE_KEYS,
  type ConversationFilter,
} from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface Props {
  locale: Locale;
  active: ConversationFilter;
  /** The parent owns the URL shape, so this identical component serves both
   * /dashboard/private-seller/messages/ and /dashboard/broker/messages/. */
  hrefFor: (filter: ConversationFilter) => string;
}

const BASE =
  "rounded-full px-3 py-1.5 font-label-md text-label-md whitespace-nowrap transition-colors";

/** Spec 28's five inbox filters.
 *
 * Links rather than buttons, because the active filter lives in the URL: a
 * filtered inbox is then shareable and the back button works, which is the
 * property spec 29.4 requires of filter state elsewhere in the product. */
export default function ConversationFilters({ locale, active, hrefFor }: Props) {
  return (
    <nav aria-label={tConversations(locale, "messages.filter.label")}>
      <ul className="flex flex-wrap gap-space-sm">
        {CONVERSATION_FILTERS.map((filter) => {
          const isActive = filter === active;
          return (
            <li key={filter}>
              <Link
                href={hrefFor(filter)}
                aria-current={isActive ? "true" : undefined}
                className={`${BASE} ${
                  isActive
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {tConversations(locale, FILTER_MESSAGE_KEYS[filter])}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
