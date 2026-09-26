import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MessagesPage from "@/app/dashboard/private-seller/messages/page";

vi.mock("@/components/layout/DashboardSidebar", () => ({ default: () => null }));
vi.mock("@/components/auth/PrivateAreaGuard", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
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

// The guard is Phase 3's and has its own tests; here it is a passthrough so
// these assertions are about this route's own wiring. Its presence IS asserted,
// once, by the first test below.
vi.mock("@/components/auth/RequirePermission", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard">{children}</div>
  ),
}));

describe("/dashboard/private-seller/messages/", () => {
  it("wraps the screen in the sign-in guard", async () => {
    // Ruling 13: a guest must land in /login?next=…, not on a dead-end
    // sentence. Without this assertion the guard could be dropped silently.
    render(await MessagesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("guard")).toContainElement(
      screen.getByTestId("screen"),
    );
  });

  it("awaits searchParams and defaults to the ALL filter", async () => {
    // Next 16: searchParams is a Promise. Verify against
    // node_modules/next/dist/docs/ before changing this signature.
    render(await MessagesPage({ searchParams: Promise.resolve({}) }));
    const screenEl = screen.getByTestId("screen");
    expect(screenEl).toHaveAttribute("data-filter", "ALL");
    expect(screenEl).toHaveAttribute("data-base-path", "/dashboard/private-seller/messages/");
    expect(screenEl).toHaveAttribute("data-broker-id", "undefined");
  });

  it("accepts a known filter from the query string", async () => {
    render(
      await MessagesPage({ searchParams: Promise.resolve({ filter: "ARCHIVED" }) }),
    );
    expect(screen.getByTestId("screen")).toHaveAttribute("data-filter", "ARCHIVED");
  });

  it("falls back to ALL for an unknown filter rather than passing it through", async () => {
    render(
      await MessagesPage({ searchParams: Promise.resolve({ filter: "NONSENSE" }) }),
    );
    expect(screen.getByTestId("screen")).toHaveAttribute("data-filter", "ALL");
  });
});
