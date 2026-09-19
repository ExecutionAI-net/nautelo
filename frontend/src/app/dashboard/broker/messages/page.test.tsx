import { Suspense } from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BrokerMessagesPage from "@/app/dashboard/broker/messages/page";

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("@/components/messages/MessagesScreen", () => ({
  default: ({ basePath, filter, brokerId }: Record<string, unknown>) => (
    <div
      data-testid="screen"
      data-base-path={String(basePath)}
      data-filter={String(filter)}
      data-broker-id={String(brokerId)}
    />
  ),
}));
vi.mock("@/components/auth/RequirePermission", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard">{children}</div>
  ),
}));

/** Render the page as an ELEMENT, not by calling it.
 *
 * This page is a `"use client"` component: it calls `use(searchParams)` and
 * `useSession()`. `render(await BrokerMessagesPage({...}))` invokes it as a
 * plain function outside React's render phase, which throws "Invalid hook
 * call" — and `use()` on a pending promise must suspend, so it needs a
 * Suspense boundary above it. The server pages under /dashboard/messages/ are
 * async server components and ARE called directly in their own tests; the two
 * shapes are different on purpose and must not be copied across.
 */
async function renderPage(
  params: Record<string, string | string[] | undefined> = {},
) {
  // Awaited act: `use()` suspends on the promise, and React 19 only flushes the
  // resolved value inside an awaited act scope.
  await act(async () => {
    render(
      <Suspense fallback={<p>loading</p>}>
        <BrokerMessagesPage searchParams={Promise.resolve(params)} />
      </Suspense>,
    );
  });
}

function mockSession(memberships: unknown[]) {
  useSessionMock.mockReturnValue({
    session: {
      authenticated: true,
      user: { locale: "EN" },
      broker_memberships: memberships,
    },
    loading: false,
    error: null,
    can: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

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

afterEach(() => useSessionMock.mockReset());

describe("/dashboard/broker/messages/", () => {
  it("scopes the inbox to the caller's organization", async () => {
    mockSession([MEMBERSHIP]);
    await renderPage();
    const el = await screen.findByTestId("screen");
    expect(el).toHaveAttribute("data-broker-id", "b-1");
    expect(el).toHaveAttribute("data-base-path", "/dashboard/broker/messages/");
    expect(el).toHaveAttribute("data-filter", "ALL");
  });

  it("passes a known filter through", async () => {
    mockSession([MEMBERSHIP]);
    await renderPage({ filter: "UNREAD" });
    expect(await screen.findByTestId("screen")).toHaveAttribute(
      "data-filter",
      "UNREAD",
    );
  });

  it("falls back to ALL for an unknown filter", async () => {
    mockSession([MEMBERSHIP]);
    await renderPage({ filter: "NONSENSE" });
    expect(await screen.findByTestId("screen")).toHaveAttribute(
      "data-filter",
      "ALL",
    );
  });

  it("wraps the screen in the sign-in guard", async () => {
    mockSession([MEMBERSHIP]);
    await renderPage();
    await screen.findByTestId("screen");
    expect(screen.getByTestId("guard")).toContainElement(
      screen.getByTestId("screen"),
    );
  });

  it("explains itself instead of rendering an inbox for a non-member", async () => {
    mockSession([]);
    await renderPage();
    await waitFor(() =>
      expect(
        screen.getByText("Your account is not a member of a broker organization."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("screen")).not.toBeInTheDocument();
  });
});
