// Server-only: directoryFetch reads next/headers, so this must never be imported by a client component.
import { directoryFetch } from "@/lib/api/directory";
import type { InquiryConfig } from "@/lib/api/inquiries";

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
