import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ActorRef,
  BrokerAuditEntry,
  StaffBrokerDetail,
  StaffBrokerListingCounts,
} from "@/lib/api/staffBrokers";

const DETAIL_URL = "http://localhost:8020/api/v1/staff/brokers/b1/";

/**
 * The keys backend/brokers/serializers.py writes in
 * `StaffBrokerDetailSerializer.to_representation` (and `actor_ref`,
 * `audit_entry`, `brokers.selectors.broker_listing_counts`). Renaming a field
 * on the TypeScript side breaks the exhaustive `Record<keyof …, true>` literals
 * below at compile time; editing this list without editing the backend breaks
 * the assertions at run time.
 */
const BACKEND_DETAIL_KEYS = [
  "id",
  "name",
  "slug",
  "status",
  "auto_approve_listings",
  "auto_approve_changed_by",
  "auto_approve_changed_at",
  "listing_counts",
  "pending_revision_count",
  "audit_history",
];
const BACKEND_ACTOR_KEYS = ["id", "email", "full_name"];
const BACKEND_AUDIT_KEYS = [
  "id",
  "action",
  "actor",
  "created_at",
  "reason",
  "before",
  "after",
];
const BACKEND_COUNT_KEYS = ["by_status", "total"];
/** backend/listings/enums.py ListingStatus — spec §6.1's seven states. */
const BACKEND_LISTING_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "PUBLISHED",
  "REJECTED",
  "SUSPENDED",
  "EXPIRED",
  "ARCHIVED",
];

function payload() {
  return {
    id: "b1",
    name: "Blue Marine Brokers",
    slug: "blue-marine-brokers",
    status: "ACTIVE",
    auto_approve_listings: false,
    auto_approve_changed_by: null,
    auto_approve_changed_at: null,
    listing_counts: {
      by_status: {
        DRAFT: 2,
        PENDING_APPROVAL: 1,
        PUBLISHED: 7,
        REJECTED: 0,
        SUSPENDED: 0,
        EXPIRED: 3,
        ARCHIVED: 0,
      },
      total: 13,
    },
    pending_revision_count: 1,
    audit_history: [],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("fetchStaffBrokerDetail", () => {
  it("GETs the staff detail route with the access token attached", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse(payload()),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { setAccessToken } = await import("@/lib/api/client");
    const { fetchStaffBrokerDetail } = await import("@/lib/api/staffBrokers");
    setAccessToken("staff-access-token");

    const detail = await fetchStaffBrokerDetail("b1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(DETAIL_URL);
    expect(init?.method ?? "GET").toBe("GET");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer staff-access-token",
    );
    expect(init?.credentials).toBe("include");
    expect(detail.listing_counts.by_status.PUBLISHED).toBe(7);
    expect(detail.listing_counts.total).toBe(13);
    expect(detail.pending_revision_count).toBe(1);
  });

  it("raises the shared ApiError on a non-2xx response", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { error: { code: "not_found", message: "No broker matches." } },
        404,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { ApiError } = await import("@/lib/api/client");
    const { fetchStaffBrokerDetail } = await import("@/lib/api/staffBrokers");

    await expect(fetchStaffBrokerDetail("b1")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("the staff broker payload contract", () => {
  it("mirrors the backend serializer's field names exactly", () => {
    const detailKeys: Record<keyof StaffBrokerDetail, true> = {
      id: true,
      name: true,
      slug: true,
      status: true,
      auto_approve_listings: true,
      auto_approve_changed_by: true,
      auto_approve_changed_at: true,
      listing_counts: true,
      pending_revision_count: true,
      audit_history: true,
    };
    const actorKeys: Record<keyof ActorRef, true> = {
      id: true,
      email: true,
      full_name: true,
    };
    const auditKeys: Record<keyof BrokerAuditEntry, true> = {
      id: true,
      action: true,
      actor: true,
      created_at: true,
      reason: true,
      before: true,
      after: true,
    };
    const countKeys: Record<keyof StaffBrokerListingCounts, true> = {
      by_status: true,
      total: true,
    };

    expect(Object.keys(detailKeys).sort()).toEqual(
      [...BACKEND_DETAIL_KEYS].sort(),
    );
    expect(Object.keys(actorKeys).sort()).toEqual([...BACKEND_ACTOR_KEYS].sort());
    expect(Object.keys(auditKeys).sort()).toEqual([...BACKEND_AUDIT_KEYS].sort());
    expect(Object.keys(countKeys).sort()).toEqual([...BACKEND_COUNT_KEYS].sort());
    // The fixture is the real payload shape, so a renamed key fails here too.
    expect(Object.keys(payload()).sort()).toEqual(
      [...BACKEND_DETAIL_KEYS].sort(),
    );
  });

  it("lists spec §6.1's seven listing states in backend order", async () => {
    const { LISTING_STATUS_ORDER } = await import("@/lib/api/staffBrokers");
    expect([...LISTING_STATUS_ORDER]).toEqual(BACKEND_LISTING_STATUSES);
  });
});
