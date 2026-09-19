// Staff moderation console API (spec 26.2). Browser-only, authenticated.
import { apiFetch } from "@/lib/api/client";

export const QUEUE_TABS = ["initial", "revisions", "other_model", "suspended", "expiring"] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];

export interface QueueRow {
  kind: "revision" | "listing";
  id: string;
  listing_id: string;
  title: string;
  seller: string;
  seller_type: string;
  submission_type: "initial" | "revision" | null;
  submitted_at: string | null;
  waiting_seconds: number | null;
  brand: string;
  model: string;
  is_other_model: boolean;
  custom_model_name: string;
  year: number;
  listing_status: string;
  expires_at?: string | null;
}

export interface QueueResponse {
  tab: QueueTab;
  counts: Record<QueueTab, number>;
  results: QueueRow[];
}

export interface RevisionDetail extends QueueRow {
  state: string;
  version: number;
  diff: { field: string; before: unknown; after: unknown }[];
  media_diff: { added: unknown[]; removed: unknown[]; kept: number };
  warnings: { code: string; [key: string]: unknown }[];
  audit_trail: { at: string; action: string; actor_type: string }[];
}

export type Decision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

export function fetchModerationQueue(tab: QueueTab): Promise<QueueResponse> {
  return apiFetch<QueueResponse>(`/api/v1/staff/moderation/queue/?tab=${tab}`);
}

export function fetchRevisionDetail(id: string): Promise<RevisionDetail> {
  return apiFetch<RevisionDetail>(`/api/v1/staff/revisions/${encodeURIComponent(id)}/`);
}

export function decideRevision(
  id: string,
  body: { decision: Decision; version: number; note: string },
): Promise<unknown> {
  return apiFetch(`/api/v1/staff/revisions/${encodeURIComponent(id)}/decision/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function setSuspension(
  listingId: string,
  action: "suspend" | "unsuspend",
  reason: string,
): Promise<{ listing_id: string; status: string }> {
  return apiFetch(`/api/v1/staff/listings/${encodeURIComponent(listingId)}/suspension/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reason }),
  });
}
