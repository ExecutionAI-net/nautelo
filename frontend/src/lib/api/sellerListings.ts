// Seller-side listing workflow (spec 20, 24, 30.1). Browser-only, authenticated.
import { apiFetch } from "@/lib/api/client";

export interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
}

interface TaxonomyPage {
  results: TaxonomyItem[];
}

export interface WorkflowListing {
  id: string;
  status: string;
  seller_type: string;
  version: number;
  revision: { id: string; version: number; state: string; payload: Record<string, unknown> } | null;
  policy: {
    requires_approval: boolean;
    immutable_fields: string[];
    image_limit: number;
    video_limit: number;
  };
}

export interface MediaRow {
  id: string;
  media_type: "IMAGE" | "VIDEO";
  status: string;
  mime_type: string;
  byte_size: number;
  sort_order: number;
  rejection_reason: string;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function searchBrands(q: string): Promise<TaxonomyItem[]> {
  const page = await apiFetch<TaxonomyPage>(`/api/v1/boat-brands/?q=${encodeURIComponent(q)}`);
  return page.results;
}

export interface ModelChoices {
  models: TaxonomyItem[];
  /** The brand's Other placeholder; last choice in the list (spec 13.1). */
  other: { id: string; label: string } | null;
}

export async function listModels(brandId: string): Promise<ModelChoices> {
  const page = await apiFetch<TaxonomyPage & { other: ModelChoices["other"] }>(
    `/api/v1/boat-models/?brand_id=${encodeURIComponent(brandId)}`,
  );
  return { models: page.results, other: page.other ?? null };
}

export function createDraft(payload: Record<string, unknown>, brokerId?: string) {
  return apiFetch<WorkflowListing>("/api/v1/listings/drafts/", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(brokerId ? { ...payload, broker_id: brokerId } : payload),
  });
}

export function updateDraft(id: string, version: number, payload: Record<string, unknown>) {
  return apiFetch<WorkflowListing>(`/api/v1/listings/${id}/draft/`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ ...payload, version }),
  });
}

export function submitListing(id: string, version: number) {
  return apiFetch<WorkflowListing>(`/api/v1/listings/${id}/submit/`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ version }),
  });
}

export function listMedia(id: string) {
  return apiFetch<MediaRow[]>(`/api/v1/listings/${id}/media/`);
}

export function removeMedia(id: string, mediaId: string) {
  return apiFetch<void>(`/api/v1/listings/${id}/media/${mediaId}/`, { method: "DELETE" });
}

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** intent -> direct upload to storage -> complete (spec 24.2). */
export async function uploadMedia(listingId: string, file: File): Promise<MediaRow> {
  const media_type = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
  const intent = await apiFetch<{
    media: MediaRow;
    upload: { url: string; method: string; headers: Record<string, string> };
  }>(`/api/v1/listings/${listingId}/media/intents/`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      media_type,
      filename: file.name,
      mime_type: file.type,
      size: file.size,
      checksum_sha256: await sha256Hex(file),
    }),
  });
  const put = await fetch(intent.upload.url, {
    method: intent.upload.method,
    headers: intent.upload.headers,
    body: file,
  });
  if (!put.ok) {
    throw new Error("upload_failed");
  }
  return apiFetch<MediaRow>(
    `/api/v1/listings/${listingId}/media/${intent.media.id}/complete/`,
    { method: "POST" },
  );
}
