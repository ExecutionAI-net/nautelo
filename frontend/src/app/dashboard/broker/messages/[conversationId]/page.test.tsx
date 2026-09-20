import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BrokerThreadPage from "@/app/dashboard/broker/messages/[conversationId]/page";

vi.mock("@/components/layout/DashboardSidebar", () => ({ default: () => null }));
vi.mock("@/components/messages/MessagesScreen", () => ({
  default: ({ selectedId: conversationId, basePath }: Record<string, unknown>) => (
    <div
      data-testid="thread"
      data-conversation-id={String(conversationId)}
      data-base-path={String(basePath)}
    />
  ),
}));
vi.mock("@/components/auth/RequirePermission", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard">{children}</div>
  ),
}));

describe("/dashboard/broker/messages/<id>/", () => {
  it("awaits params and sends the reader back to the broker inbox", async () => {
    // Called directly, unlike the inbox page beside it: this one is an async
    // SERVER component with no hooks. See the comment in its page.tsx.
    render(
      await BrokerThreadPage({
        params: Promise.resolve({ conversationId: "c-1" }),
      }),
    );
    const el = screen.getByTestId("thread");
    expect(el).toHaveAttribute("data-conversation-id", "c-1");
    expect(el).toHaveAttribute("data-base-path", "/dashboard/broker/messages/");
  });

  it("wraps the thread in the sign-in guard", async () => {
    render(
      await BrokerThreadPage({
        params: Promise.resolve({ conversationId: "c-1" }),
      }),
    );
    expect(screen.getByTestId("guard")).toContainElement(
      screen.getByTestId("thread"),
    );
  });
});
