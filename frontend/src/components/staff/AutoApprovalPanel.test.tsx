import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import AutoApprovalPanel from "@/components/staff/AutoApprovalPanel";
import { ApiError } from "@/lib/api/client";
import type { StaffBrokerDetail } from "@/lib/api/staffBrokers";

const { setBrokerAutoApproval } = vi.hoisted(() => ({
  setBrokerAutoApproval: vi.fn(),
}));

vi.mock("@/lib/api/staffBrokers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/staffBrokers")>()),
  setBrokerAutoApproval,
}));

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
        DRAFT: 0,
        PENDING_APPROVAL: 0,
        PUBLISHED: 0,
        REJECTED: 0,
        SUSPENDED: 0,
        EXPIRED: 0,
        ARCHIVED: 0,
      },
      total: 0,
    },
    pending_revision_count: 0,
    audit_history: [],
    ...overrides,
  };
}

afterEach(() => setBrokerAutoApproval.mockReset());

describe("AutoApprovalPanel", () => {
  it("shows the current state and that it has never been changed", () => {
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail()}
        canConfigure
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("auto-approval-state")).toHaveTextContent("Off");
    expect(screen.getByText("Never changed.")).toBeInTheDocument();
  });

  it("shows who last changed it and when", () => {
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail({
          auto_approve_listings: true,
          auto_approve_changed_by: {
            id: "u1",
            email: "admin@nauta.example",
            full_name: "Ada Admin",
          },
          auto_approve_changed_at: "2026-09-18T10:30:00Z",
        })}
        canConfigure
        onUpdated={vi.fn()}
      />,
    );

    expect(screen.getByTestId("auto-approval-state")).toHaveTextContent("On");
    expect(screen.getByTestId("auto-approval-last-changed")).toHaveTextContent(
      "Ada Admin",
    );
    expect(screen.getByTestId("auto-approval-last-changed")).toHaveTextContent(
      "2026",
    );
  });

  it("disables the switch for a user without the staff-admin permission", () => {
    // Spec §21 acceptance test 2 and spec §5: only staff admin may configure
    // the policy. A moderator sees it and cannot move it.
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail()}
        canConfigure={false}
        onUpdated={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Turn on automatic approval" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Only a staff administrator can change this policy."),
    ).toBeInTheDocument();
  });

  it("explains the future-only effect of turning the policy on", async () => {
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail()}
        canConfigure
        onUpdated={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Turn on automatic approval" }),
    );

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "affects future submissions only",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "stay in the queue until somebody decides them",
    );
  });

  it("explains the future-only effect of turning the policy off", async () => {
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail({ auto_approve_listings: true })}
        canConfigure
        onUpdated={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Turn off automatic approval" }),
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("stay live");
  });

  it("sends the toggle with its reason and hands the refreshed broker up", async () => {
    const onUpdated = vi.fn();
    const refreshed = { ...detail({ auto_approve_listings: true }), changed: true };
    setBrokerAutoApproval.mockResolvedValue(refreshed);
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail()}
        canConfigure
        onUpdated={onUpdated}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Turn on automatic approval" }),
    );
    await userEvent.type(screen.getByLabelText(/reason/i), "Vetted partner.");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(setBrokerAutoApproval).toHaveBeenCalledWith("b1", {
        enabled: true,
        reason: "Vetted partner.",
      }),
    );
    expect(onUpdated).toHaveBeenCalledWith(refreshed);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open and shows the server message when the save fails", async () => {
    const onUpdated = vi.fn();
    setBrokerAutoApproval.mockRejectedValue(
      new ApiError(403, "staff_admin_required", "Staff administrator access is required."),
    );
    render(
      <AutoApprovalPanel
        locale="en"
        broker={detail()}
        canConfigure
        onUpdated={onUpdated}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Turn on automatic approval" }),
    );
    await userEvent.type(screen.getByLabelText(/reason/i), "Trying it on.");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Staff administrator access is required.",
      ),
    );
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
