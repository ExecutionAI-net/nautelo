// The shared inquiry API (spec 15.5, 30.1). One module for all three contexts,
// because there is one endpoint and one form (spec 15.1, spec 39).
import { apiFetch } from "@/lib/api/client";
import { directoryFetch } from "@/lib/api/directory";

export const INQUIRY_CONTEXT_TYPES = ["LISTING", "BROKER", "PROFESSIONAL"] as const;
export type InquiryContextType = (typeof INQUIRY_CONTEXT_TYPES)[number];

/** What the form is attached to. `label` is only for display and the subject
 *  default; the server re-derives the recipient from `type` + `id` and never
 *  trusts anything else (spec 11.8, 33.1). */
export interface InquiryContextRef {
  type: InquiryContextType;
  id: string;
  label: string;
}

export interface InquiryConfig {
  enabled: boolean;
  privacy_policy_version: string;
  honeypot_field: string;
  limits: {
    full_name: { min: number; max: number };
    subject: { min: number; max: number };
    message: { min: number; max: number };
    phone_max: number;
  };
}

export interface InquirySubmission {
  context_type: InquiryContextType;
  context_id: string;
  full_name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  privacy_policy_version: string;
  privacy_consent: boolean;
  marketing_consent: boolean;
  /** The honeypot. Always sent, always empty for a real person (spec 15.1). */
  company_website: string;
}

export interface InquiryResult {
  conversation_id: string;
  message_id: string;
  contact_access: "GRANTED" | "NOT_APPLICABLE";
  next_url: string;
}

export interface InquiryDraftFields {
  context_type: string;
  context_id: string;
  full_name: string;
  phone: string;
  subject: string;
  message: string;
}

/**
 * Public, unauthenticated read, executed during SSR.
 *
 * It delegates to `directoryFetch` rather than calling `fetch` itself, and that
 * is the whole point: `directoryFetch` (merged with PR #103) attaches
 * `X-Internal-Service-Secret` and the visitor's `X-Internal-Client-IP`, which
 * `backend/common/ip.py` verifies with `hmac.compare_digest` before believing
 * the forwarded address. Without it every server-rendered visitor shares one
 * throttle bucket, and the `messaging_read` limit (120/min) would be consumed
 * platform-wide by ordinary traffic - at which point this call 429s, returns
 * null, and the professional page silently renders with NO inquiry form. It
 * also supplies the right base URL (127.0.0.1, not localhost, because this
 * machine resolves localhost to IPv6 ::1 - Phase 0/1 retrospective) and
 * `cache: "no-store"`.
 *
 * `directoryFetch` returns null on 404 and throws on any other non-2xx; both
 * become null here, because a page that cannot reach the API must render
 * without the form rather than 500. The config endpoint never 404s in practice
 * (it is AllowAny and reports the flag state in its body), so a null answer
 * means "API unreachable" and the page fails closed.
 */
export async function fetchInquiryConfig(): Promise<InquiryConfig | null> {
  try {
    return await directoryFetch<InquiryConfig>("/api/v1/inquiries/config/");
  } catch {
    return null;
  }
}

/** Throws ApiError on any non-2xx; the form reads `.code` to choose its copy. */
export async function submitInquiry(
  payload: InquirySubmission,
): Promise<InquiryResult> {
  return apiFetch<InquiryResult>("/api/v1/inquiries/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Spec 15.2: preserve a guest's work before sending them to sign in. */
export async function createInquiryDraft(
  fields: InquiryDraftFields,
): Promise<{ draft_token: string; expires_in: number }> {
  return apiFetch("/api/v1/inquiry-drafts/", {
    method: "POST",
    body: JSON.stringify(fields),
  });
}

/** Spec 15.2's return half. Restores the fields; never sends anything. */
export async function resolveInquiryDraft(
  draftToken: string,
): Promise<InquiryDraftFields> {
  return apiFetch<InquiryDraftFields>("/api/v1/inquiry-drafts/resolve/", {
    method: "POST",
    body: JSON.stringify({ draft_token: draftToken }),
  });
}
