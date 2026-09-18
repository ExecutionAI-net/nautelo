import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StaffBrokerPage from "@/app/dashboard/staff/brokers/[brokerId]/page";
import type { PermissionKey, PermissionMap } from "@/lib/auth/types";

const { replace, useSessionMock } = vi.hoisted(() => ({
  replace: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/dashboard/staff/brokers/b1/",
}));
vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/staff/StaffBrokerDetailView", () => ({
  default: ({ brokerId }: { brokerId: string }) => <p>detail for {brokerId}</p>,
}));

const ALL_FALSE = {
  browse_public_content: true,
  submit_inquiry: false,
  reveal_contact_after_inquiry: false,
  reveal_any_contact: false,
  create_private_listing: false,
  create_broker_listing: false,
  create_listing_on_behalf: false,
  enable_listing_finance_flag: false,
  approve_listings_and_revisions: false,
  configure_broker_auto_approval: false,
  configure_products_and_settings: false,
  manage_taxonomy: false,
} satisfies PermissionMap;

function mockSession(permissions: PermissionMap) {
  useSessionMock.mockReturnValue({
    session: { authenticated: true, locale: "EN", permissions },
    loading: false,
    error: null,
    can: (key: PermissionKey) => permissions[key] === true,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  replace.mockClear();
  useSessionMock.mockReset();
});

describe("staff broker detail page", () => {
  it("renders the screen for a staff moderator", async () => {
    mockSession({ ...ALL_FALSE, approve_listings_and_revisions: true });

    render(await StaffBrokerPage({ params: Promise.resolve({ brokerId: "b1" }) }));

    expect(screen.getByText("detail for b1")).toBeInTheDocument();
  });

  it("renders the screen for a staff admin", async () => {
    mockSession({
      ...ALL_FALSE,
      approve_listings_and_revisions: true,
      configure_broker_auto_approval: true,
    });

    render(await StaffBrokerPage({ params: Promise.resolve({ brokerId: "b1" }) }));

    expect(screen.getByText("detail for b1")).toBeInTheDocument();
  });

  it("passes the awaited route param through, not the promise", async () => {
    mockSession({ ...ALL_FALSE, approve_listings_and_revisions: true });

    render(
      await StaffBrokerPage({
        params: Promise.resolve({ brokerId: "0b1e5f2a" }),
      }),
    );

    expect(screen.getByText("detail for 0b1e5f2a")).toBeInTheDocument();
  });

  it("shows the 403 screen to a broker user", async () => {
    // Spec §21 acceptance test 2, UI half: an ordinary broker user cannot reach
    // the auto-approval switch at all, let alone toggle it.
    mockSession({ ...ALL_FALSE, create_broker_listing: true });

    render(await StaffBrokerPage({ params: Promise.resolve({ brokerId: "b1" }) }));

    expect(
      screen.getByRole("heading", { name: /access denied/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("detail for b1")).not.toBeInTheDocument();
  });

  it("sends a guest to the login page with a safe next url", async () => {
    useSessionMock.mockReturnValue({
      session: { authenticated: false, locale: "EN", permissions: ALL_FALSE },
      loading: false,
      error: null,
      can: () => false,
      login: vi.fn(),
      logout: vi.fn(),
      reload: vi.fn(),
    });

    render(await StaffBrokerPage({ params: Promise.resolve({ brokerId: "b1" }) }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/login?next=%2Fdashboard%2Fstaff%2Fbrokers%2Fb1%2F",
      ),
    );
    expect(screen.queryByText("detail for b1")).not.toBeInTheDocument();
  });
});
