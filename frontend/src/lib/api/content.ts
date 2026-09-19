// Guides (blog) and advertisement banners: shared types and the staff editor calls (browser side).
// Server-side public reads live in contentServer.ts, which may import next/headers.
import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/directory";

export interface GuideSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  hero_image_url: string;
  author_name: string;
  published_at: string | null;
}

export interface GuideDetail extends GuideSummary {
  body: string;
}

export type AdPlacement = "HOME" | "BOAT_LIST" | "BOAT_DETAIL" | "DIRECTORY" | "GUIDES";

export interface PublicAd {
  id: string;
  placement: AdPlacement;
  sponsor: string;
  headline: string;
  body: string;
  cta_label: string;
  cta_url: string;
  image_url: string;
}

export interface StaffGuide extends GuideDetail {
  id: string;
  status: "DRAFT" | "PUBLISHED";
}

export interface StaffAd extends PublicAd {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export const staffGuides = {
  list: () => apiFetch<Paginated<StaffGuide> | StaffGuide[]>("/api/v1/staff/guides/"),
  create: (body: Partial<StaffGuide>) =>
    apiFetch<StaffGuide>("/api/v1/staff/guides/", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  update: (id: string, body: Partial<StaffGuide>) =>
    apiFetch<StaffGuide>(`/api/v1/staff/guides/${id}/`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/api/v1/staff/guides/${id}/`, { method: "DELETE" }),
};

export const staffAds = {
  list: () => apiFetch<Paginated<StaffAd> | StaffAd[]>("/api/v1/staff/ads/"),
  create: (body: Partial<StaffAd>) =>
    apiFetch<StaffAd>("/api/v1/staff/ads/", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  update: (id: string, body: Partial<StaffAd>) =>
    apiFetch<StaffAd>(`/api/v1/staff/ads/${id}/`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/api/v1/staff/ads/${id}/`, { method: "DELETE" }),
};
