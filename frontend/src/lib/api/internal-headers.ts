import { headers } from "next/headers";

/**
 * The real visitor's IP for the current SSR request, read from the incoming
 * request's `x-forwarded-for` header — or undefined when unavailable.
 *
 * `headers()` throws outside a request-scoped render (a route that has not
 * opted into dynamic rendering); a page render must never fail over this
 * best-effort value, so failure here just means "no IP to forward" and
 * directoryFetch() falls back to Django's REMOTE_ADDR-based throttling.
 */
export async function forwardedClientIp(): Promise<string | undefined> {
  try {
    const store = await headers();
    const xff = store.get("x-forwarded-for");
    return xff?.split(",")[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}
