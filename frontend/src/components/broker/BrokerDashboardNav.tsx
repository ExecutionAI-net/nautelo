import type { BrokerMembershipSummary, SessionPayload } from "@/lib/auth/types";

/** The organization this dashboard is about.
 *
 * `broker_memberships` already contains only `is_active=True` rows
 * (accounts.selectors.get_broker_memberships), so the first entry is a live
 * membership. A person in two brokerages sees the first; an organization
 * switcher is not in scope and is recorded in the plan's Known Limitations. */
export function primaryBrokerMembership(session: SessionPayload | null): BrokerMembershipSummary | null {
  return session?.broker_memberships?.[0] ?? null;
}
