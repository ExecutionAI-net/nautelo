// Staff taxonomy console API (spec 13.3). Browser-only, authenticated.
import { apiFetch } from "@/lib/api/client";

export interface OtherQueueRow {
  listing_id: string;
  brand: string;
  brand_id: string;
  custom_model_name: string;
  owner: string;
  seller_type: string;
  status: string;
  created_at: string;
}

export interface StaffModel {
  id: string;
  brand_id: string;
  name: string;
  is_other_placeholder: boolean;
  is_active: boolean;
}

export function fetchOtherQueue(): Promise<OtherQueueRow[]> {
  return apiFetch<OtherQueueRow[]>("/api/v1/staff/taxonomy/other-queue/");
}

export function fetchBrandModels(brandId: string): Promise<StaffModel[]> {
  return apiFetch<StaffModel[]>(
    `/api/v1/staff/taxonomy/models/?brand_id=${encodeURIComponent(brandId)}`,
  );
}

export function mapListing(
  listingId: string,
  target: { model_id: string } | { new_model_name: string },
  note: string,
) {
  return apiFetch(`/api/v1/staff/taxonomy/listings/${encodeURIComponent(listingId)}/map/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...target, note }),
  });
}

export interface StaffBrand {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function fetchBrands(): Promise<StaffBrand[]> {
  return apiFetch<StaffBrand[]>("/api/v1/staff/taxonomy/brands/");
}

export function createBrand(name: string) {
  return apiFetch<StaffBrand>("/api/v1/staff/taxonomy/brands/", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  });
}

export function setBrandActive(id: string, is_active: boolean) {
  return apiFetch<StaffBrand>(`/api/v1/staff/taxonomy/brands/${id}/`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ is_active }),
  });
}

export function createModel(brand_id: string, name: string) {
  return apiFetch<StaffModel>("/api/v1/staff/taxonomy/models/", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ brand_id, name }),
  });
}

export function setModelActive(id: string, is_active: boolean) {
  return apiFetch<StaffModel>(`/api/v1/staff/taxonomy/models/${id}/`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ is_active }),
  });
}

export function mergePreview(sourceId: string, intoId: string) {
  return apiFetch<{ affected_count: number }>(
    `/api/v1/staff/taxonomy/models/${sourceId}/merge/?into=${encodeURIComponent(intoId)}`,
  );
}

export function mergeModels(sourceId: string, intoId: string, note: string) {
  return apiFetch<{ merged_listings: number }>(
    `/api/v1/staff/taxonomy/models/${sourceId}/merge/`,
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ into: intoId, note }) },
  );
}
