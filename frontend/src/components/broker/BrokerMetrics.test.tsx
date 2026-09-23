import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BrokerMetrics from "@/components/broker/BrokerMetrics";
import type { BrokerDashboard } from "@/lib/api/conversations";

const DASHBOARD: BrokerDashboard = {
  broker: {
    id: "b-1",
    name: "Phase19 Alpha Brokers",
    slug: "phase19-alpha-brokers",
    status: "ACTIVE",
  },
  published_listings: 12,
  pending_approvals: 3,
  messages: {
    enabled: true,
    can_read: true,
    unread_conversations: 4,
    unread_messages: 7,
    new_inquiries_7d: 2,
  },
};

describe("BrokerMetrics", () => {
  it("shows exactly spec 28's four metrics and nothing else", () => {
    render(<BrokerMetrics locale="en" dashboard={DASHBOARD} />);
    const terms = screen.getAllByRole("term").map((node) => node.textContent);
    expect(terms).toEqual([
      "Published listings",
      "Awaiting review",
      "Unread messages",
      "New inquiries",
    ]);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("states the window the backend actually computed", () => {
    render(<BrokerMetrics locale="en" dashboard={DASHBOARD} />);
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
  });

  it("shows no service or surveyor widget", () => {
    // Spec 28 "Remove": "Any empty service/survey metrics left on broker home."
    const { container } = render(
      <BrokerMetrics locale="en" dashboard={DASHBOARD} />,
    );
    expect(container.textContent?.toLowerCase()).not.toMatch(/surveyor|service/);
  });

  it("hides the messaging tiles and explains why when the role cannot read them", () => {
    render(
      <BrokerMetrics
        locale="en"
        dashboard={{
          ...DASHBOARD,
          messages: {
            enabled: true,
            can_read: false,
            unread_conversations: null,
            unread_messages: null,
            new_inquiries_7d: null,
          },
        }}
      />,
    );
    expect(screen.queryByText("Unread messages")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Your team role does not include reading this organization's messages.",
      ),
    ).toBeInTheDocument();
    // The listing metrics still work.
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("explains a disabled flag differently from a missing capability", () => {
    render(
      <BrokerMetrics
        locale="en"
        dashboard={{
          ...DASHBOARD,
          messages: {
            enabled: false,
            can_read: false,
            unread_conversations: null,
            unread_messages: null,
            new_inquiries_7d: null,
          },
        }}
      />,
    );
    expect(
      screen.getByText("Messaging is not enabled yet."),
    ).toBeInTheDocument();
  });

  it("never renders a hard-coded zero in place of an unknown count", () => {
    // Spec 2.1: every visible state has a backend source. null means "not
    // computed", and printing 0 would be a fabricated number.
    render(
      <BrokerMetrics
        locale="en"
        dashboard={{
          ...DASHBOARD,
          messages: {
            enabled: true,
            can_read: false,
            unread_conversations: null,
            unread_messages: null,
            new_inquiries_7d: null,
          },
        }}
      />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
