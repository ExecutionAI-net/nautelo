import ConversationRowCard from "@/components/messages/ConversationRow";
import type { ConversationRow } from "@/lib/api/conversations";
import { tConversations } from "@/lib/i18n/conversations";
import type { Locale } from "@/lib/i18n/directory";

interface Props {
  locale: Locale;
  rows: ConversationRow[];
  hrefFor: (conversationId: string) => string;
}

export default function ConversationList({ locale, rows, hrefFor }: Props) {
  if (rows.length === 0) {
    return (
      <p className="font-body-md text-on-surface-variant">
        {tConversations(locale, "messages.empty")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-surface-container overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
      {rows.map((row) => (
        <li key={row.id}>
          <ConversationRowCard locale={locale} row={row} href={hrefFor(row.id)} />
        </li>
      ))}
    </ul>
  );
}
