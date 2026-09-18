import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StaffBrokerDetailView from "@/components/staff/StaffBrokerDetailView";
import { ApiError } from "@/lib/api/client";
import type { StaffBrokerDetail } from "@/lib/api/staffBrokers";

const { fetchStaffBrokerDetail, useSessionMock } = vi.hoisted(() => ({
  fetchStaffBrokerDetail: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock("@/lib/api/staffBrokers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/staffBrokers")>()),
  fetchStaffBrokerDetail,
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));

function detail(): StaffBrokerDetail {
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
        PUBLISHED: 4,
        REJECTED: 0,
        SUSPENDED: 0,
        EXPIRED: 0,
        ARCHIVED: 0,
      },
      total: 4,
    },
    pending_revision_count: 0,
    audit_history: [],
  };
}

function sessionValue({
  locale = "EN",
  canConfigure = false,
  loading = false,
  userId = "u1",
}: {
  locale?: string;
  canConfigure?: boolean;
  loading?: boolean;
  userId?: string | null;
} = {}) {
  return {
    session: loading
      ? null
      : {
          authenticated: true,
          locale,
          user: userId === null ? null : { id: userId },
        },
    loading,
    error: null,
    can: (key: string) => key === "configure_broker_auto_approval" && canConfigure,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  };
}

function mockSession(locale = "EN", canConfigure = false) {
  useSessionMock.mockReturnValue(sessionValue({ locale, canConfigure }));
}

afterEach(() => {
  fetchStaffBrokerDetail.mockReset();
  useSessionMock.mockReset();
});

describe("StaffBrokerDetailView", () => {
  it("shows a loading state, then the broker", async () => {
    mockSession();
    fetchStaffBrokerDetail.mockResolvedValue(detail());

    render(<StaffBrokerDetailView brokerId="b1" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(
      await screen.findByRole("heading", { name: "Blue Marine Brokers" }),
    ).toBeInTheDocument();
    expect(fetchStaffBrokerDetail).toHaveBeenCalledWith("b1");
    expect(screen.getByTestId("listing-count-total")).toHaveTextContent("4");
    expect(screen.getByTestId("auto-approval-state")).toHaveTextContent("Off");
  });

  it("waits for the session before fetching, then fetches exactly once", async () => {
    // The access token arrives asynchronously (lib/api/client keeps it in
    // memory); a fetch fired while the session is still loading goes out
    // unauthenticated and comes back 401.
    useSessionMock.mockReturnValue(sessionValue({ loading: true }));
    fetchStaffBrokerDetail.mockResolvedValue(detail());

    const { rerender } = render(<StaffBrokerDetailView brokerId="b1" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(fetchStaffBrokerDetail).not.toHaveBeenCalled();

    useSessionMock.mockReturnValue(sessionValue());
    rerender(<StaffBrokerDetailView brokerId="b1" />);

    expect(
      await screen.findByRole("heading", { name: "Blue Marine Brokers" }),
    ).toBeInTheDocument();
    expect(fetchStaffBrokerDetail).toHaveBeenCalledTimes(1);

    // A re-render that changes nothing about the identity must not refetch.
    useSessionMock.mockReturnValue(sessionValue());
    rerender(<StaffBrokerDetailView brokerId="b1" />);
    await waitFor(() =>
      expect(fetchStaffBrokerDetail).toHaveBeenCalledTimes(1),
    );
  });

  it("refetches when the signed-in identity changes", async () => {
    useSessionMock.mockReturnValue(sessionValue({ userId: "u1" }));
    fetchStaffBrokerDetail.mockResolvedValue(detail());

    const { rerender } = render(<StaffBrokerDetailView brokerId="b1" />);
    await screen.findByRole("heading", { name: "Blue Marine Brokers" });
    expect(fetchStaffBrokerDetail).toHaveBeenCalledTimes(1);

    useSessionMock.mockReturnValue(sessionValue({ userId: "u2" }));
    rerender(<StaffBrokerDetailView brokerId="b1" />);

    await waitFor(() =>
      expect(fetchStaffBrokerDetail).toHaveBeenCalledTimes(2),
    );
  });

  it("returns to the loading state while a changed identity is refetched", async () => {
    // The broker on screen was read with the previous user's token; showing it
    // to the new one until the refetch lands would be a stale read.
    useSessionMock.mockReturnValue(sessionValue({ userId: "u1" }));
    let resolveSecond: (value: StaffBrokerDetail) => void = () => {};
    fetchStaffBrokerDetail
      .mockResolvedValueOnce(detail())
      .mockImplementationOnce(
        () =>
          new Promise<StaffBrokerDetail>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { rerender } = render(<StaffBrokerDetailView brokerId="b1" />);
    await screen.findByRole("heading", { name: "Blue Marine Brokers" });

    useSessionMock.mockReturnValue(sessionValue({ userId: "u2" }));
    rerender(<StaffBrokerDetailView brokerId="b1" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(
      screen.queryByRole("heading", { name: "Blue Marine Brokers" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveSecond(detail());
    });
    expect(
      await screen.findByRole("heading", { name: "Blue Marine Brokers" }),
    ).toBeInTheDocument();
  });

  it("shows a real failure state rather than an empty screen", async () => {
    mockSession();
    fetchStaffBrokerDetail.mockRejectedValue(
      new ApiError(404, "not_found", "No broker matches the given query."),
    );

    render(<StaffBrokerDetailView brokerId="missing" />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This broker could not be loaded.",
      ),
    );
  });

  it.each([
    [
      new ApiError(401, "not_authenticated", "Authentication credentials were not provided."),
      "Your session has expired",
    ],
    [
      new ApiError(403, "permission_denied", "You do not have permission."),
      "does not have staff access",
    ],
    [
      new ApiError(404, "not_found", "No broker matches the given query."),
      "No broker matches this address",
    ],
    [
      new ApiError(429, "throttled", "Request was throttled."),
      "Too many requests",
    ],
    [
      new ApiError(500, "unexpected_error", "Request failed with status 500."),
      "The server is unavailable",
    ],
    [new TypeError("Failed to fetch"), "Check your connection"],
  ])("explains failure %#", async (thrown, expected) => {
    mockSession();
    fetchStaffBrokerDetail.mockRejectedValue(thrown);

    render(<StaffBrokerDetailView brokerId="b1" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(expected);
  });

  it("never leaks the backend's own error message onto the screen", async () => {
    mockSession();
    fetchStaffBrokerDetail.mockRejectedValue(
      new ApiError(403, "permission_denied", "user sam@example.com is not staff"),
    );

    render(<StaffBrokerDetailView brokerId="b1" />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("sam@example.com");
  });

  it("renders in the signed-in user's locale", async () => {
    mockSession("ES");
    fetchStaffBrokerDetail.mockResolvedValue(detail());

    render(<StaffBrokerDetailView brokerId="b1" />);

    expect(await screen.findByText("Estado de la cuenta")).toBeInTheDocument();
  });

  it("renders the failure state in the signed-in user's locale", async () => {
    mockSession("IT");
    fetchStaffBrokerDetail.mockRejectedValue(
      new ApiError(404, "not_found", "No broker matches the given query."),
    );

    render(<StaffBrokerDetailView brokerId="b1" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Impossibile caricare questo broker.");
  });
});
