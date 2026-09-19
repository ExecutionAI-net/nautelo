// Spec 16's contact payload, as a DISCRIMINATED UNION. This is a privacy
// control, not a style choice: TypeScript will not let a component read
// `access.email` without first narrowing `access.state === "GRANTED"`, so the
// locked branch cannot even be written to display a raw value.
import { apiFetch } from "@/lib/api/client";

export type ContactTargetType = "broker" | "professional";

export interface LockedContact {
  state: "LOCKED";
  email_mask: string;
  phone_mask: string;
  unlock_rule: "SEND_INQUIRY";
}

export interface GrantedContact {
  state: "GRANTED";
  email: string;
  phone: string;
  website_url: string | null;
  /** null on the staff-bypass path: spec §5 gives a staff moderator or admin a
   *  reveal without a grant, and there is no grant timestamp to report. Every
   *  consumer must handle it — `granted_at.slice(...)` on a staff reveal is a
   *  TypeError that takes the whole panel down. */
  granted_at: string | null;
}

export interface UnavailableContact {
  state: "UNAVAILABLE";
}

export type ContactAccess = LockedContact | GrantedContact | UnavailableContact;

export function contactAccessPath(
  targetType: ContactTargetType,
  targetId: string,
): string {
  return `/api/v1/contacts/${targetType}/${encodeURIComponent(targetId)}/`;
}

/** Authorization is decided server-side; this only asks. Errors propagate:
 * a failed request must not be rendered as "locked", which would tell the
 * reader a false reason.
 *
 * `cache: "no-store"` matches the server's `Cache-Control: private, no-store`
 * and belongs on BOTH sides: the same URL answers LOCKED to a guest and GRANTED
 * to a grant holder, so a cached response replayed after a login — or after a
 * logout on a shared machine — is a cross-viewer disclosure. */
export async function fetchContactAccess(
  targetType: ContactTargetType,
  targetId: string,
): Promise<ContactAccess> {
  const payload = await apiFetch<{ contact: ContactAccess }>(
    contactAccessPath(targetType, targetId),
    { cache: "no-store" },
  );
  return payload.contact;
}

/** The seam spec 16's "After successful send, refetch contact authorization"
 * needs. Phase 6's InquiryForm calls this after a 201; the panel re-asks the
 * server. A browser event rather than a shared store, so the form and the panel
 * stay independent components with no common ancestor requirement. */
export const CONTACT_ACCESS_REFRESH_EVENT = "nauta:contact-access-refresh";

export interface ContactAccessRefreshDetail {
  targetType: ContactTargetType;
  targetId: string;
}

export function requestContactAccessRefresh(
  targetType: ContactTargetType,
  targetId: string,
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<ContactAccessRefreshDetail>(CONTACT_ACCESS_REFRESH_EVENT, {
      detail: { targetType, targetId },
    }),
  );
}
