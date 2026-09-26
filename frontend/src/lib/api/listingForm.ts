import { apiFetch } from "@/lib/api/client";

export interface FormOptions {
  years: number[];
  boat_types: string[];
  hull_materials: string[];
  engine_types: string[];
  fuel_types: string[];
  engines: string[];
  cabins: string[];
  bathrooms: string[];
  countries: string[];
  currencies: string[];
  media_limits: {
    free_images: number;
    free_videos: number;
    paid_images: number;
    paid_videos: number;
    broker_images: number;
    broker_videos: number;
  };
}

export interface Eligibility {
  can_start_listing: boolean;
  blocking_reason: string | null;
  free: { available: boolean; next_available_at: string | null; used_at: string | null };
  paid_listing_rights_available: number;
  purchase_product_code: string;
}

export const fetchFormOptions = () => apiFetch<FormOptions>("/api/v1/listing-form/options/");
export const fetchEligibility = () => apiFetch<Eligibility>("/api/v1/listing-eligibility/");
