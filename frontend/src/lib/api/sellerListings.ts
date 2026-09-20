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
  preview_url?: string | null;
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

export function reorderMedia(id: string, mediaType: "IMAGE" | "VIDEO", ids: string[]) {
  return apiFetch<MediaRow[]>(`/api/v1/listings/${id}/media/reorder/`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ media_type: mediaType, ids }),
  });
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
  const completed = await apiFetch<MediaRow>(
    `/api/v1/listings/${listingId}/media/${intent.media.id}/complete/`,
    { method: "POST" },
  );
  return waitForMedia(listingId, completed);
}

const PROCESSING = new Set(["UPLOADING", "SCANNING", "PROCESSING"]);

/** Server-side checks (scan, size, format) run asynchronously; wait for the verdict. */
async function waitForMedia(listingId: string, row: MediaRow): Promise<MediaRow> {
  let current = row;
  for (let attempt = 0; attempt < 30 && PROCESSING.has(current.status); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    current = await apiFetch<MediaRow>(`/api/v1/listings/${listingId}/media/${row.id}/`);
  }
  return current;
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

/** Starts Stripe Checkout for `quantity` paid listings (one-off, no expiry). */
export function startListingRightCheckout(returnUrl = "/dashboard/private-seller/listings/", quantity = 1, pkg = "") {
  return apiFetch<{ checkout_url: string }>("/api/v1/checkout-sessions/", {
    method: "POST",
    headers: { ...JSON_HEADERS, "Idempotency-Key": randomId() },
    body: JSON.stringify({ product_code: "INDIVIDUAL_LISTING_RIGHT", return_url: returnUrl, quantity, package: pkg }),
  });
}

/** Spends one paid listing to extend or re-activate a private listing. */
export interface OwnedPackage {
  package: string;
  publication_days: number | null;
  image_limit: number | null;
  video_limit: number | null;
  count: number;
}

export function fetchMyPaidListings() {
  return apiFetch<{ results: OwnedPackage[] }>("/api/v1/paid-listings/");
}

export function renewListing(listingId: string, pkg = "") {
  return apiFetch<{ listing_id: string; status: string; expires_at: string }>(
    `/api/v1/listings/${encodeURIComponent(listingId)}/renew/`,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ package: pkg }) },
  );
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
  price: string | null;
  currency: string;
  year: number | null;
  city: string;
  country: string;
  boat_type: string;
  condition: string;
  loa_m: string;
  beam_m: string;
  engine: string;
  views: number;
  image_url: string | null;
}

export function fetchMyListings() {
  return apiFetch<MyListingRow[]>("/api/v1/listings/mine/");
}

export interface MyListingsSummary {
  published: number;
  drafts: number;
  in_review: number;
  views: number;
}

export function fetchMyListingsSummary() {
  return apiFetch<MyListingsSummary>("/api/v1/listings/mine/summary/");
}

export function fetchWorkflowListing(id: string) {
  return apiFetch<WorkflowListing>(`/api/v1/listings/${encodeURIComponent(id)}/workflow/`);
}
