// Staff entitlement ledger (spec 26.3). Browser-only, staff-admin.
import { apiFetch } from "@/lib/api/client";

export interface EntitlementRow {
  id: string;
  user_id: string;
  user_email?: string;
  entitlement_type: string;
  source: string;
  state: string;
  listing_id: string | null;
  listing_label?: string;
  valid_until: string | null;
  consumed_at: string | null;
  revoked_at: string | null;
  reason: string;
  payment_order_id: string | null;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function fetchEntitlements(filters: { user?: string; email?: string; state?: string }) {
  const search = new URLSearchParams();
  if (filters.user) search.set("user", filters.user);
  if (filters.email) search.set("email", filters.email);
  if (filters.state) search.set("state", filters.state);
  const query = search.toString();
  return apiFetch<{ results: EntitlementRow[] }>(
    `/api/v1/staff/entitlements/${query ? `?${query}` : ""}`,
  );
}

export function grantEntitlement(body: {
  user_id?: string;
  user_email?: string;
  entitlement_type: string;
  reason: string;
}) {
  return apiFetch<EntitlementRow>("/api/v1/staff/entitlements/grants/", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

export function changeEntitlement(id: string, action: "revoke" | "restore", reason: string) {
  return apiFetch(`/api/v1/staff/entitlements/${encodeURIComponent(id)}/${action}/`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ reason }),
  });
}
