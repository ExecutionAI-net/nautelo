import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BrokerOverviewPanel from "@/components/staff/BrokerOverviewPanel";
import {
  LISTING_STATUS_ORDER,
  type BrokerAccountStatus,
  type StaffBrokerDetail,
} from "@/lib/api/staffBrokers";

function detail(overrides: Partial<StaffBrokerDetail> = {}): StaffBrokerDetail {
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
    ...overrides,
  };
}

describe("BrokerOverviewPanel", () => {
  it("shows the account status", () => {
    render(<BrokerOverviewPanel locale="en" broker={detail({ status: "SUSPENDED" })} />);
    expect(screen.getByTestId("broker-account-status")).toHaveTextContent("Suspended");
  });

  it("labels each of the four account statuses distinctly", () => {
    const statuses: BrokerAccountStatus[] = [
      "DRAFT",
      "PENDING",
      "ACTIVE",
      "SUSPENDED",
    ];
    const seen = new Set<string>();
    for (const status of statuses) {
      const { unmount } = render(
        <BrokerOverviewPanel locale="en" broker={detail({ status })} />,
      );
      const rendered = screen.getByTestId("broker-account-status").textContent ?? "";
      expect(rendered.trim()).not.toBe("");
      seen.add(rendered);
      unmount();
    }
    expect(seen.size).toBe(statuses.length);
  });

  it("shows every listing state, including the zeroes", () => {
    render(<BrokerOverviewPanel locale="en" broker={detail()} />);
    expect(screen.getByTestId("listing-count-PUBLISHED")).toHaveTextContent("7");
    expect(screen.getByTestId("listing-count-REJECTED")).toHaveTextContent("0");
    expect(screen.getByTestId("listing-count-ARCHIVED")).toHaveTextContent("0");
    expect(screen.getByTestId("listing-count-total")).toHaveTextContent("13");
  });

  it("renders one row per spec §6.1 state, each with its own count", () => {
    // Distinct counts, so a row wired to the wrong key fails rather than
    // coincidentally matching its neighbour.
    const by_status = {
      DRAFT: 11,
      PENDING_APPROVAL: 22,
      PUBLISHED: 33,
      REJECTED: 44,
      SUSPENDED: 55,
      EXPIRED: 66,
      ARCHIVED: 77,
    };
    render(
      <BrokerOverviewPanel
        locale="en"
        broker={detail({ listing_counts: { by_status, total: 308 } })}
      />,
    );
    for (const status of LISTING_STATUS_ORDER) {
      expect(screen.getByTestId(`listing-count-${status}`)).toHaveTextContent(
        String(by_status[status]),
      );
    }
    expect(screen.getByTestId("listing-count-total")).toHaveTextContent("308");
  });

  it("gives the panel an accessible name and a heading", () => {
    render(<BrokerOverviewPanel locale="en" broker={detail()} />);
    expect(
      screen.getByRole("heading", { name: "Account status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Listings by status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Account status" }),
    ).toBeInTheDocument();
  });

  it("states that broker organisations have no listing quota", () => {
    render(<BrokerOverviewPanel locale="en" broker={detail()} />);
    expect(
      screen.getByText("Broker organisations have no listing quota."),
    ).toBeInTheDocument();
  });

  it("translates its labels", () => {
    render(<BrokerOverviewPanel locale="it" broker={detail()} />);
    expect(screen.getByText("Stato dell'account")).toBeInTheDocument();
    expect(screen.getByText("In attesa di approvazione")).toBeInTheDocument();
  });

  it("translates its labels into Spanish too", () => {
    render(<BrokerOverviewPanel locale="es" broker={detail()} />);
    expect(screen.getByText("Estado de la cuenta")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de aprobación")).toBeInTheDocument();
    expect(screen.getByText("Anuncios por estado")).toBeInTheDocument();
  });
});
