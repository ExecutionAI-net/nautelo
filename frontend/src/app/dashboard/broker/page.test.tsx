import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BrokerHomePage from "@/app/dashboard/broker/page";
import { ApiError } from "@/lib/api/client";

const { useSessionMock, fetchDashboardMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  fetchDashboardMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("@/lib/api/conversations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/conversations")>();
  return {
    ...actual,
    fetchBrokerDashboard: (...a: unknown[]) => fetchDashboardMock(...a),
  };
});
vi.mock("@/components/auth/RequirePermission", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard">{children}</div>
  ),
}));

const MEMBERSHIP = {
  broker_id: "b-1",
  broker_name: "Phase19 Alpha Brokers",
  broker_slug: "phase19-alpha-brokers",
  broker_status: "ACTIVE",
  broker_auto_approve_listings: false,
  role: "MANAGER",
  can_edit_listings: false,
  can_manage_team: false,
  can_read_messages: true,
};

function mockSession(memberships: unknown[], loading = false) {
  useSessionMock.mockReturnValue({
    session: {
      authenticated: true,
      user: { locale: "EN" },
      broker_memberships: memberships,
    },
    loading,
    error: null,
    can: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  useSessionMock.mockReset();
  fetchDashboardMock.mockReset();
});

describe("/dashboard/broker/", () => {
  it("fetches nothing while the session is loading", () => {
    mockSession([MEMBERSHIP], true);
    render(<BrokerHomePage />);
    expect(fetchDashboardMock).not.toHaveBeenCalled();
  });

  it("loads the metrics for the caller's organization", async () => {
    mockSession([MEMBERSHIP]);
    fetchDashboardMock.mockResolvedValue({
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
    });
    render(<BrokerHomePage />);
    await waitFor(() => expect(screen.getByText("12")).toBeInTheDocument());
    expect(fetchDashboardMock).toHaveBeenCalledWith("b-1");
    expect(
      screen.getByRole("heading", { name: "Phase19 Alpha Brokers" }),
    ).toBeInTheDocument();
  });

  it("explains itself to an account with no broker organization", () => {
    mockSession([]);
    render(<BrokerHomePage />);
    expect(fetchDashboardMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Your account is not a member of a broker organization."),
    ).toBeInTheDocument();
  });

  it("names the real cause of a 403, never the server's English string", async () => {
    // Ruling 15. The session lists memberships regardless of the organization's
    // status (accounts/selectors.py:63-65) while the API requires ACTIVE
    // (accounts/services.py:150-159), so a member of a SUSPENDED brokerage
    // reaches this screen and is refused. "Something went wrong" would be true
    // and useless.
    mockSession([MEMBERSHIP]);
    fetchDashboardMock.mockRejectedValue(
      new ApiError(403, "not_broker_member", "You are not a member."),
    );
    render(<BrokerHomePage />);
    await waitFor(() =>
      expect(
        screen.getByText(/suspended, or your membership may have been removed/),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("You are not a member.")).not.toBeInTheDocument();
  });

  it("falls back to the generic message for a code it does not know", async () => {
    mockSession([MEMBERSHIP]);
    fetchDashboardMock.mockRejectedValue(new ApiError(500, "teapot", "boom"));
    render(<BrokerHomePage />);
    await waitFor(() =>
      expect(
        screen.getByText("Something went wrong. Try again."),
      ).toBeInTheDocument(),
    );
  });

  it("wraps its content in the sign-in guard", () => {
    mockSession([MEMBERSHIP]);
    fetchDashboardMock.mockResolvedValue({
      broker: {
        id: "b-1",
        name: "Phase19 Alpha Brokers",
        slug: "phase19-alpha-brokers",
        status: "ACTIVE",
      },
      published_listings: 0,
      pending_approvals: 0,
      messages: {
        enabled: false,
        can_read: false,
        unread_conversations: null,
        unread_messages: null,
        new_inquiries_7d: null,
      },
    });
    render(<BrokerHomePage />);
    expect(screen.getByTestId("guard")).toBeInTheDocument();
  });
});
