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
