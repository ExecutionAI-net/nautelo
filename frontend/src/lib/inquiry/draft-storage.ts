// Spec 15.2's browser half. The TOKEN is signed by the server and expires in 30
// minutes; this module only decides where the browser keeps it.
//
// sessionStorage, not localStorage: a draft is meant to survive one sign-in
// round trip in one tab, not to sit on the device indefinitely. Every access is
// wrapped, because sessionStorage throws in private mode and with site data
// blocked, and a saved draft is a convenience - never a reason to break a page.
import type { InquiryContextRef } from "@/lib/api/inquiries";

const KEY_PREFIX = "nauta.inquiry-draft";

function storageKey(context: InquiryContextRef): string {
  return `${KEY_PREFIX}:${context.type}:${context.id}`;
}

export function storeDraftToken(context: InquiryContextRef, token: string): void {
  try {
    window.sessionStorage.setItem(storageKey(context), token);
  } catch {
    // Storage unavailable: the guest simply retypes after signing in.
  }
}

export function readDraftToken(context: InquiryContextRef): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(context));
  } catch {
    return null;
  }
}

export function clearDraftToken(context: InquiryContextRef): void {
  try {
    window.sessionStorage.removeItem(storageKey(context));
  } catch {
    // Nothing to clean up if storage never accepted it.
  }
}
