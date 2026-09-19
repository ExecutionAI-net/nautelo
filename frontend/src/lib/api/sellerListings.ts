// Seller-side listing workflow (spec 20, 24, 30.1). Browser-only, authenticated.
import { apiFetch } from "@/lib/api/client";
import { sha256HexSync } from "@/lib/sha256";

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

export async function listModels(brandId: string, q = ""): Promise<ModelChoices> {
  const page = await apiFetch<TaxonomyPage & { other: ModelChoices["other"] }>(
    `/api/v1/boat-models/?brand_id=${encodeURIComponent(brandId)}&q=${encodeURIComponent(q)}`,
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
  const bytes = await file.arrayBuffer();
  // crypto.subtle only exists on https/localhost; plain-http dev servers fall back.
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  return sha256HexSync(new Uint8Array(bytes));
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

export function applyMediaUpgrade(listingId: string) {
  return apiFetch<{ listing_id: string; entitlement_id: string; state: string }>(
    `/api/v1/listings/${listingId}/media-upgrade/apply/`,
    { method: "POST" },
  );
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Starts Stripe Checkout for one extra individual listing right. */
export function startListingRightCheckout(returnUrl: string) {
  return apiFetch<{ checkout_url: string }>("/api/v1/checkout-sessions/", {
    method: "POST",
    headers: { ...JSON_HEADERS, "Idempotency-Key": randomId() },
    body: JSON.stringify({ product_code: "INDIVIDUAL_LISTING_RIGHT", return_url: returnUrl }),
  });
}

/** Starts Stripe Checkout for the media upgrade; the caller redirects to
 *  `checkout_url`. Rights are only granted by the verified webhook (spec 2.2). */
export function startMediaUpgradeCheckout(listingId: string, returnUrl: string) {
  return apiFetch<{ checkout_url: string }>("/api/v1/checkout-sessions/", {
    method: "POST",
    headers: { ...JSON_HEADERS, "Idempotency-Key": randomId() },
    body: JSON.stringify({
      product_code: "LISTING_MEDIA_UPGRADE",
      listing_id: listingId,
      return_url: returnUrl,
    }),
  });
}

export interface MyListingRow {
  id: string;
  title: string;
  status: string;
  seller_type: string;
  slug: string | null;
  updated_at: string;
  expires_at: string | null;
}

export function fetchMyListings() {
  return apiFetch<MyListingRow[]>("/api/v1/listings/mine/");
}

export function fetchWorkflowListing(id: string) {
  return apiFetch<WorkflowListing>(`/api/v1/listings/${encodeURIComponent(id)}/workflow/`);
}
