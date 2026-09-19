import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ThreadPage from "@/app/dashboard/private-seller/messages/[conversationId]/page";

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

describe("/dashboard/private-seller/messages/<id>/", () => {
  it("awaits params and passes the conversation id through", async () => {
    render(await ThreadPage({ params: Promise.resolve({ conversationId: "c-1" }) }));
    const el = screen.getByTestId("thread");
    expect(el).toHaveAttribute("data-conversation-id", "c-1");
    expect(el).toHaveAttribute("data-base-path", "/dashboard/private-seller/messages/");
  });

  it("wraps the thread in the sign-in guard", async () => {
    render(await ThreadPage({ params: Promise.resolve({ conversationId: "c-1" }) }));
    expect(screen.getByTestId("guard")).toContainElement(
      screen.getByTestId("thread"),
    );
  });
});
