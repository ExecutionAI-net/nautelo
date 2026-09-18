import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BrokerAuditHistory from "@/components/staff/BrokerAuditHistory";
import type { BrokerAuditEntry } from "@/lib/api/staffBrokers";

const entries: BrokerAuditEntry[] = [
  {
    id: "e1",
    action: "broker.auto_approval_changed",
    actor: { id: "u1", email: "admin@nauta.example", full_name: "Ada Admin" },
    created_at: "2026-09-18T10:30:00Z",
    reason: "Vetted partner, 8 years.",
    before: { auto_approve_listings: false },
    after: { auto_approve_listings: true },
  },
  {
    id: "e2",
    action: "broker.pending_revisions_bulk_approved",
    actor: { id: "u2", email: "mod@nauta.example", full_name: "" },
    created_at: "2026-09-18T11:00:00Z",
    reason: "Backlog sweep.",
    before: { pending_revision_count: 4 },
    after: { approved_count: 4, failed_count: 0 },
  },
];

describe("BrokerAuditHistory", () => {
  it("names the action, the actor and the reason for each entry", () => {
    render(<BrokerAuditHistory locale="en" entries={entries} />);

    expect(screen.getByText("Automatic approval changed")).toBeInTheDocument();
    expect(screen.getByText("Pending submissions approved in bulk")).toBeInTheDocument();
    expect(screen.getByText(/Vetted partner, 8 years\./)).toBeInTheDocument();
    expect(screen.getByText(/Ada Admin/)).toBeInTheDocument();
    // No full_name: fall back to the email rather than rendering an empty cell.
    expect(screen.getByText(/mod@nauta\.example/)).toBeInTheDocument();
  });

  it("renders an unknown action as its raw code rather than crashing", () => {
    render(
      <BrokerAuditHistory
        locale="en"
        entries={[{ ...entries[0], action: "broker.something_new" }]}
      />,
    );

    expect(screen.getByText("broker.something_new")).toBeInTheDocument();
  });

  it("shows a real empty state", () => {
    render(<BrokerAuditHistory locale="en" entries={[]} />);

    expect(
      screen.getByText("No policy changes recorded yet."),
    ).toBeInTheDocument();
  });
});
