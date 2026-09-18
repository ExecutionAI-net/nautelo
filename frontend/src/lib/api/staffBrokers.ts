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

/**
 * The policy PATCH returns the whole refreshed detail plus `changed` — false
 * when the switch was already in the requested state, so the screen can say so
 * instead of implying a change happened (spec §30.2).
 */
export type PolicyUpdateResponse = StaffBrokerDetail & { changed: boolean };

export function setBrokerAutoApproval(
  brokerId: string,
  { enabled, reason }: { enabled: boolean; reason: string },
): Promise<PolicyUpdateResponse> {
  return apiFetch<PolicyUpdateResponse>(
    `/api/v1/staff/brokers/${brokerId}/approval-policy/`,
    {
      method: "PATCH",
      body: JSON.stringify({ auto_approve_listings: enabled, reason }),
    },
  );
}

export interface BulkApproveFailure {
  revision_id: string;
  listing_id: string;
  code: string;
  message: string;
}

export interface BulkApproveResponse {
  approved_count: number;
  failed_count: number;
  approved_revision_ids: string[];
  failures: BulkApproveFailure[];
  /** The refreshed detail travels with the run (spec §30.2). */
  broker: StaffBrokerDetail;
}

export function bulkApprovePendingSubmissions(
  brokerId: string,
  { reason }: { reason: string },
): Promise<BulkApproveResponse> {
  return apiFetch<BulkApproveResponse>(
    `/api/v1/staff/brokers/${brokerId}/pending-approvals/`,
    {
      method: "POST",
      // `confirm` is a server-side control (spec §21 rule 7's "explicit action
      // with confirmation"); this client only ever sends it after the dialog
      // has been confirmed with a reason.
      body: JSON.stringify({ confirm: true, reason }),
    },
  );
}
