import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import BulkApprovePanel from "@/components/staff/BulkApprovePanel";
import type { StaffBrokerDetail } from "@/lib/api/staffBrokers";

const { bulkApprovePendingSubmissions } = vi.hoisted(() => ({
  bulkApprovePendingSubmissions: vi.fn(),
}));

vi.mock("@/lib/api/staffBrokers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/staffBrokers")>()),
  bulkApprovePendingSubmissions,
}));

function detail(pending: number): StaffBrokerDetail {
  return {
    id: "b1",
    name: "Blue Marine Brokers",
    slug: "blue-marine-brokers",
    status: "ACTIVE",
    auto_approve_listings: true,
    auto_approve_changed_by: null,
    auto_approve_changed_at: null,
    listing_counts: {
      by_status: {
        DRAFT: 0,
        PENDING_APPROVAL: pending,
        PUBLISHED: 0,
        REJECTED: 0,
        SUSPENDED: 0,
        EXPIRED: 0,
        ARCHIVED: 0,
      },
      total: pending,
    },
    pending_revision_count: pending,
    audit_history: [],
  };
}

afterEach(() => bulkApprovePendingSubmissions.mockReset());

describe("BulkApprovePanel", () => {
  it("shows the backlog size", () => {
    render(<BulkApprovePanel locale="en" broker={detail(4)} onUpdated={vi.fn()} />);
    expect(screen.getByTestId("pending-revision-count")).toHaveTextContent("4");
  });

  it("offers no action and says so when nothing is pending", () => {
    render(<BulkApprovePanel locale="en" broker={detail(0)} onUpdated={vi.fn()} />);

    expect(
      screen.getByText("There is nothing waiting for a decision."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve all pending submissions" }),
    ).not.toBeInTheDocument();
  });

  it("requires an explicit confirmation with a reason", async () => {
    render(<BulkApprovePanel locale="en" broker={detail(2)} onUpdated={vi.fn()} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Approve all pending submissions" }),
    );

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Anything that no longer validates is left for a moderator.",
    );

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(bulkApprovePendingSubmissions).not.toHaveBeenCalled();
  });

  it("reports how many were approved and how many were left behind", async () => {
    const onUpdated = vi.fn();
    const refreshed = detail(1);
    bulkApprovePendingSubmissions.mockResolvedValue({
      approved_count: 3,
      failed_count: 1,
      approved_revision_ids: ["r1", "r2", "r3"],
      failures: [
        {
          revision_id: "r4",
          listing_id: "l4",
          code: "validation_error",
          message: "This submission no longer passes validation.",
        },
      ],
      broker: refreshed,
    });
    render(<BulkApprovePanel locale="en" broker={detail(4)} onUpdated={onUpdated} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Approve all pending submissions" }),
    );
    await userEvent.type(screen.getByLabelText(/reason/i), "Backlog sweep.");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(bulkApprovePendingSubmissions).toHaveBeenCalledWith("b1", {
        reason: "Backlog sweep.",
      }),
    );
    expect(screen.getByTestId("bulk-approved-count")).toHaveTextContent("3");
    expect(screen.getByTestId("bulk-failed-count")).toHaveTextContent("1");
    expect(screen.getByText(/l4/)).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalledWith(refreshed);
  });
});
