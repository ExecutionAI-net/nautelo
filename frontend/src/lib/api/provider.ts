// Service-provider self service (browser side): own profile and own services.
import { apiFetch, ApiError } from "@/lib/api/client";

export interface ProviderProfile {
  id: string;
  display_name: string;
  slug: string;
  short_description: string;
  description: string;
  public_email: string;
  public_phone: string;
  website_url: string | null;
  city: string;
  postal_code: string;
  region: string;
  country_code: string;
  service_area: string[];
  status: "DRAFT" | "PENDING" | "ACTIVE" | "SUSPENDED";
  completeness?: { percent: number; missing: string[] };
}

export type ProviderProfileInput = Partial<Omit<ProviderProfile, "id" | "slug" | "status">> & { submit?: boolean };

export interface ProviderService {
  id: string;
  category: string;
  category_slug: string;
  title_en: string;
  description_en: string;
  service_area: string[];
  is_active: boolean;
}

export async function fetchProviderProfile(): Promise<ProviderProfile | null> {
  try {
    return await apiFetch<ProviderProfile>("/api/v1/provider/profile/");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function createProviderProfile(input: ProviderProfileInput): Promise<ProviderProfile> {
  return apiFetch<ProviderProfile>("/api/v1/provider/profile/", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input) });
}

export function updateProviderProfile(input: ProviderProfileInput): Promise<ProviderProfile> {
  return apiFetch<ProviderProfile>("/api/v1/provider/profile/", { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(input) });
}

export function fetchProviderServices(): Promise<ProviderService[]> {
  return apiFetch<ProviderService[]>("/api/v1/provider/services/");
}

export function createProviderService(input: { category: string; title_en: string; description_en?: string }): Promise<ProviderService> {
  return apiFetch<ProviderService>("/api/v1/provider/services/", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input) });
}

export function updateProviderService(id: string, input: Partial<ProviderService>): Promise<ProviderService> {
  return apiFetch<ProviderService>(`/api/v1/provider/services/${id}/`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(input) });
}

export function deleteProviderService(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/provider/services/${id}/`, { method: "DELETE" });
}
