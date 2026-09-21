import { DIRECTORY_API_BASE_URL } from "@/lib/api/directory";
import { makeTranslate, type Messages, type Translate } from "@/i18n";
import { getRequestLocale } from "@/lib/i18n/requestLocale";

export const UI_TEXT_TAG = "ui-text";
// A minute: an edit published in Django refreshes the tag at once, and even if that call is lost the text is at most this old.
const REVALIDATE_SECONDS = 60;
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET ?? "";

/** The published text of one language. Any failure returns an empty bundle, so the English source takes over. */
export async function loadMessages(locale: string): Promise<Messages> {
  try {
    const response = await fetch(`${DIRECTORY_API_BASE_URL}/api/v1/ui-text/${locale}/`, {
      headers: { Accept: "application/json", "X-Internal-Service-Secret": INTERNAL_SERVICE_SECRET },
      next: { revalidate: REVALIDATE_SECONDS, tags: [UI_TEXT_TAG] },
    });
    if (!response.ok) return {};
    const body = (await response.json()) as { messages?: Messages };
    return body.messages ?? {};
  } catch {
    return {};
  }
}

/** `t` for the visitor's language, for server components. Keep one call per page and pass plain strings to client components. */
export async function getT(): Promise<Translate> {
  const locale = await getRequestLocale();
  return makeTranslate(await loadMessages(locale));
}
