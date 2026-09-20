// Staff: membership plans and broker subscriptions.
import { apiFetch } from "@/lib/api/client";

export interface StaffPlan {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  monthly_price: string;
  currency: string;
  listing_limit: number | null;
  seat_limit: number | null;
  profile_visibility: number;
  display_order: number;
  is_active: boolean;
  subscriber_count: number;
}

export interface Subscriber {
  id: string;
  name: string;
  slug: string;
  status: string;
  city: string;
  country_code: string;
  plan_slug: string | null;
  plan_name: string | null;
  monthly_price: string | null;
  currency: string | null;
  plan_renews_at: string | null;
  listing_limit: number | null;
  seat_limit: number | null;
  listings_used: number;
  seats_used: number;
}

export interface SubscriptionSummary {
  monthly_recurring_revenue: string;
  annual_run_rate: string;
  subscribed_brokers: number;
  unassigned_brokers: number;
  by_plan: Record<string, number>;
}

export interface SubscriptionPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Subscriber[];
  summary: SubscriptionSummary;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export const VISIBILITY_LABELS: Record<number, string> = { 0: "Standard", 1: "Priority placement", 2: "Featured placement" };

export function fetchStaffPlans(): Promise<StaffPlan[]> {
  return apiFetch<StaffPlan[]>("/api/v1/staff/broker-plans/");
}

export function updateStaffPlan(id: string, body: Partial<Omit<StaffPlan, "id" | "subscriber_count">>): Promise<StaffPlan> {
  return apiFetch<StaffPlan>(`/api/v1/staff/broker-plans/${encodeURIComponent(id)}/`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

export function fetchSubscribers(params: { page: number; plan: string; q: string }): Promise<SubscriptionPage> {
  const search = new URLSearchParams();
  if (params.page > 1) search.set("page", String(params.page));
  if (params.plan) search.set("plan", params.plan);
  if (params.q) search.set("q", params.q);
  const query = search.toString();
  return apiFetch<SubscriptionPage>(`/api/v1/staff/broker-subscriptions/${query ? `?${query}` : ""}`);
}

export function assignPlan(brokerId: string, plan: string | null, renewsAt: string | null): Promise<unknown> {
  return apiFetch(`/api/v1/staff/brokers/${encodeURIComponent(brokerId)}/plan/`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ plan, renews_at: renewsAt }),
  });
}
