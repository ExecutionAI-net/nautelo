// Authenticated staff reads and writes for the broker policy screen
// (spec §21). Uses lib/api/client's browser client — access token, credentials,
// silent refresh on 401, ApiError on every non-2xx — because every route here
// is behind a staff group and there is no unauthenticated variant.
import { apiFetch } from "@/lib/api/client";

export type BrokerAccountStatus = "DRAFT" | "PENDING" | "ACTIVE" | "SUSPENDED";

/** Spec §6.1's listing states, in the order the screen lists them. */
export const LISTING_STATUS_ORDER = [
  "DRAFT",
  "PENDING_APPROVAL",
  "PUBLISHED",
  "REJECTED",
  "SUSPENDED",
  "EXPIRED",
  "ARCHIVED",
] as const;

export type ListingStatusKey = (typeof LISTING_STATUS_ORDER)[number];

export interface ActorRef {
  id: string;
  email: string;
  full_name: string;
}

export interface BrokerAuditEntry {
  id: string;
  action: string;
  actor: ActorRef | null;
  created_at: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface StaffBrokerListingCounts {
  by_status: Record<ListingStatusKey, number>;
  total: number;
}

export interface StaffBrokerDetail {
  id: string;
  name: string;
  slug: string;
  status: BrokerAccountStatus;
  auto_approve_listings: boolean;
  auto_approve_changed_by: ActorRef | null;
  auto_approve_changed_at: string | null;
  listing_counts: StaffBrokerListingCounts;
  pending_revision_count: number;
  audit_history: BrokerAuditEntry[];
}

export function fetchStaffBrokerDetail(
  brokerId: string,
): Promise<StaffBrokerDetail> {
  return apiFetch<StaffBrokerDetail>(
    `/api/v1/staff/brokers/${encodeURIComponent(brokerId)}/`,
  );
}
