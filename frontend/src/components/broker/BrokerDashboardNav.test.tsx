import { describe, expect, it } from "vitest";

import { primaryBrokerMembership } from "@/components/broker/BrokerDashboardNav";
import type { SessionPayload } from "@/lib/auth/types";

describe("primaryBrokerMembership", () => {
  const membership = {
    broker_id: "b-1",
    broker_name: "Phase19 Alpha Brokers",
    broker_slug: "phase19-alpha-brokers",
    broker_status: "ACTIVE" as const,
    broker_auto_approve_listings: false,
    role: "MANAGER" as const,
    can_edit_listings: false,
    can_manage_team: false,
    can_read_messages: true,
  };

  it("returns the first membership", () => {
    const session = { broker_memberships: [membership] } as unknown as SessionPayload;
    expect(primaryBrokerMembership(session)?.broker_id).toBe("b-1");
  });

  it("returns null when there is none", () => {
    expect(primaryBrokerMembership({ broker_memberships: [] } as unknown as SessionPayload)).toBeNull();
  });

  it("returns null for a null session", () => {
    expect(primaryBrokerMembership(null)).toBeNull();
  });
});
