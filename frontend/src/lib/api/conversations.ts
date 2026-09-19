// The single place a /api/v1/conversations/ or broker-dashboard URL is built.
//
// apiFetch, never directoryFetch: directoryFetch is the UNAUTHENTICATED,
// server-side directory reader (it sends X-Internal-Service-Secret and a
// forwarded visitor IP and no Authorization header). An inbox fetched through it
// would be the Next.js server's, not the signed-in broker's. Everything here
// runs in the browser.
import { ApiError, apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/directory";

export type { Paginated };

export type ConversationStatus = "OPEN" | "ARCHIVED" | "BLOCKED";

export type ConversationType =
  | "LISTING_INQUIRY"
  | "BROKER_INQUIRY"
  | "PROFESSIONAL_INQUIRY"
  | "SUPPORT";

export type ConversationContextType =
  | "LISTING"
  | "BROKER"
  | "PROFESSIONAL"
  | "SUPPORT";

export interface ConversationContextRef {
  type: ConversationContextType;
  id: string;
  label: string;
  /** Canonical public URL per spec 4.1, or null where none can be derived
   * (a listing has no slug column; a support thread has no public page). */
  url: string | null;
}

/** Spec 28's conversation row, field for field. */
export interface ConversationRow {
  id: string;
  conversation_type: ConversationType;
  subject: string;
  status: ConversationStatus;
  last_message_at: string | null;
  created_at: string;
  unread_count: number;
  context: ConversationContextRef;
  counterparty_name: string;
  last_message_excerpt: string;
  /** Whose seat this is. Only the RECIPIENT side may archive (ruling 5), and
   * spec 2.1 requires that control's visibility to have a backend source
   * rather than being inferred from display text. */
  viewer_is_initiator: boolean;
}

export interface MessageRow {
  id: string;
  body: string;
  is_system: boolean;
  created_at: string;
  read_at: string | null;
  sender: { display_name: string; is_you: boolean };
}

export interface BrokerDashboardMessages {
  enabled: boolean;
  can_read: boolean;
  unread_conversations: number | null;
  unread_messages: number | null;
  new_inquiries_7d: number | null;
}

export interface BrokerDashboard {
  broker: { id: string; name: string; slug: string; status: string };
  published_listings: number;
  pending_approvals: number;
  messages: BrokerDashboardMessages;
}

/** Spec 28's five filters. The order is the order they render in. */
export type ConversationFilter =
  | "ALL"
  | "UNREAD"
  | "LISTING"
  | "PROFILE"
  | "ARCHIVED";

export const CONVERSATION_FILTERS: readonly ConversationFilter[] = [
  "ALL",
  "UNREAD",
  "LISTING",
  "PROFILE",
  "ARCHIVED",
];

export const FILTER_MESSAGE_KEYS: Record<ConversationFilter, string> = {
  ALL: "messages.filter.all",
  UNREAD: "messages.filter.unread",
  LISTING: "messages.filter.listing_inquiries",
  PROFILE: "messages.filter.profile_inquiries",
  ARCHIVED: "messages.filter.archived",
};

/** Turn a `?filter=` query value into a filter, defaulting to ALL.
 *
 * Lives HERE, beside CONVERSATION_FILTERS, and not in a page module: both the
 * server page at /dashboard/private-seller/messages/ and the client page at
 * /dashboard/broker/messages/ need it, and a client component cannot import
 * from a server page module (that module also exports `generateMetadata` and
 * `dynamic`, which are route config, not values). */
export function resolveFilter(raw: string | undefined): ConversationFilter {
  const candidate = (raw ?? "").toUpperCase();
  return (CONVERSATION_FILTERS as readonly string[]).includes(candidate)
    ? (candidate as ConversationFilter)
    : "ALL";
}

interface ListOptions {
  brokerId?: string;
  page?: number;
}

/** Spec 28's five filters expressed in Phase 6's query parameters (its contract
 * rule 7). URLSearchParams is used with `append`, not `set`, for `type`,
 * because "Profile inquiries" is TWO conversation types and the server matches
 * each value exactly — a comma-joined value filters to nothing. */
export function conversationListQuery(
  filter: ConversationFilter,
  { brokerId, page }: ListOptions,
): string {
  const search = new URLSearchParams();
  switch (filter) {
    case "ALL":
      search.set("status", "ALL");
      break;
    case "UNREAD":
      // No status: the server's default is OPEN, which is what "Unread" means
      // on an inbox. Archived-but-unread is reachable through ARCHIVED.
      search.set("unread", "true");
      break;
    case "LISTING":
      search.append("type", "LISTING_INQUIRY");
      break;
    case "PROFILE":
      search.append("type", "BROKER_INQUIRY");
      search.append("type", "PROFESSIONAL_INQUIRY");
      break;
    case "ARCHIVED":
      search.set("status", "ARCHIVED");
      break;
  }
  if (brokerId) {
    search.set("broker", brokerId);
  }
  // Page 1 is the bare query: ?page=1 would make the first page reachable at two
  // URLs, the same reasoning the directory page already applies.
  if (page && page > 1) {
    search.set("page", String(page));
  }
  return search.toString();
}

export async function fetchConversations(
  filter: ConversationFilter,
  options: ListOptions = {},
): Promise<Paginated<ConversationRow>> {
  const query = conversationListQuery(filter, options);
  return apiFetch<Paginated<ConversationRow>>(
    query ? `/api/v1/conversations/?${query}` : "/api/v1/conversations/",
  );
}

/** One conversation's row, from the detail endpoint Task 1 adds.
 *
 * Never by scanning `fetchConversations("ALL")`: that returns one page of 20,
 * so a broker's 21st conversation would report "not available" (ruling 14). */
export async function fetchConversation(
  conversationId: string,
): Promise<ConversationRow> {
  return apiFetch<ConversationRow>(`/api/v1/conversations/${conversationId}/`);
}

export async function fetchThread(
  conversationId: string,
  page?: number,
): Promise<Paginated<MessageRow>> {
  const suffix = page && page > 1 ? `?page=${page}` : "";
  return apiFetch<Paginated<MessageRow>>(
    `/api/v1/conversations/${conversationId}/messages/${suffix}`,
  );
}

export async function postReply(
  conversationId: string,
  body: string,
): Promise<MessageRow> {
  // The server's field is `message`; ours is `body`. This is the one place the
  // two names meet, exactly as Phase 6's InquiryCreateView is on its side.
  return apiFetch<MessageRow>(
    `/api/v1/conversations/${conversationId}/messages/`,
    { method: "POST", body: JSON.stringify({ message: body }) },
  );
}

export async function markConversationRead(
  conversationId: string,
): Promise<{ marked_read: number }> {
  return apiFetch<{ marked_read: number }>(
    `/api/v1/conversations/${conversationId}/read/`,
    { method: "POST", body: "{}" },
  );
}

export async function setConversationStatus(
  conversationId: string,
  status: Extract<ConversationStatus, "OPEN" | "ARCHIVED">,
): Promise<ConversationRow> {
  return apiFetch<ConversationRow>(
    `/api/v1/conversations/${conversationId}/status/`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  );
}

export async function fetchBrokerDashboard(
  brokerId: string,
): Promise<BrokerDashboard> {
  return apiFetch<BrokerDashboard>(`/api/v1/brokers/${brokerId}/dashboard/`);
}

const KNOWN_ERROR_CODES = new Set([
  "feature_disabled",
  "authentication_required",
  "rate_limited",
  "conversation_closed",
  "conversation_superseded",
  "invalid_conversation_status",
  "conversation_filing_forbidden",
  // Ruling 15: the session payload lists memberships regardless of the
  // organization's status, so a member of a SUSPENDED brokerage reaches a screen
  // whose API then refuses them. Without this entry the screen would say
  // "Something went wrong" for a condition that has a precise explanation.
  "not_broker_member",
  "not_found",
  "validation_error",
]);

/** Map a thrown error onto a dictionary key.
 *
 * Spec 30.2 asks for a localized message, and the backend's strings are English
 * only (Phase 6 Known Limitation 13) — so the client renders its own copy keyed
 * by `error.code` and never renders `error.message`. An unrecognised code lands
 * on the generic key rather than leaking a developer string to a person. */
export function messageErrorKey(error: unknown): string {
  if (error instanceof ApiError && KNOWN_ERROR_CODES.has(error.code)) {
    return `messages.error.${error.code}`;
  }
  return "messages.error.unexpected_error";
}
