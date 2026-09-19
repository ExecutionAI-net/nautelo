import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MessagesScreen from "@/components/messages/MessagesScreen";
import { ApiError } from "@/lib/api/client";

const { useSessionMock, fetchConversationsMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  fetchConversationsMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("@/lib/api/conversations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/conversations")>();
  return {
    ...actual,
    fetchConversations: (...args: unknown[]) => fetchConversationsMock(...args),
  };
});
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function session(loading: boolean, authenticated = true) {
  useSessionMock.mockReturnValue({
    session: authenticated
      ? { authenticated: true, user: { locale: "EN" }, broker_memberships: [] }
      : { authenticated: false, user: null, broker_memberships: [] },
    loading,
    error: null,
    can: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

const ROW = {
  id: "c-1",
  conversation_type: "BROKER_INQUIRY",
  subject: "Fleet question",
  status: "OPEN",
  last_message_at: "2026-09-18T09:30:00Z",
  created_at: "2026-09-18T09:00:00Z",
  unread_count: 1,
  context: { type: "BROKER", id: "b-1", label: "Alpha", url: null },
  counterparty_name: "Ada Rossi",
  last_message_excerpt: "Hello about the boat, please.",
  viewer_is_initiator: false,
};

afterEach(() => {
  useSessionMock.mockReset();
  fetchConversationsMock.mockReset();
});

describe("MessagesScreen", () => {
  it("fetches nothing while the session is still loading", () => {
    // SessionProvider trades the refresh cookie for an access token first; a
    // fetch fired before that carries no Authorization header and 401s.
    session(true);
    render(<MessagesScreen basePath="/dashboard/private-seller/messages/" filter="ALL" />);
    expect(fetchConversationsMock).not.toHaveBeenCalled();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders the rows once the session has resolved", async () => {
    session(false);
    fetchConversationsMock.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [ROW],
    });
    render(<MessagesScreen basePath="/dashboard/private-seller/messages/" filter="ALL" />);
    await waitFor(() => expect(screen.getByText("Ada Rossi")).toBeInTheDocument());
    expect(fetchConversationsMock).toHaveBeenCalledWith("ALL", {
      brokerId: undefined,
    });
  });

  it("scopes the fetch to one organization when a brokerId is given", async () => {
    session(false);
    fetchConversationsMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    render(
      <MessagesScreen
        brokerId="b-1"
        basePath="/dashboard/broker/messages/"
        filter="UNREAD"
      />,
    );
    await waitFor(() =>
      expect(fetchConversationsMock).toHaveBeenCalledWith("UNREAD", {
        brokerId: "b-1",
      }),
    );
  });

  it("builds every href from basePath, so one component serves both routes", async () => {
    session(false);
    fetchConversationsMock.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [ROW],
    });
    render(
      <MessagesScreen basePath="/dashboard/broker/messages/" filter="ALL" />,
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Ada Rossi/ })).toHaveAttribute(
        "href",
        "/dashboard/broker/messages/c-1/",
      ),
    );
    expect(screen.getByRole("link", { name: "Archived" })).toHaveAttribute(
      "href",
      "/dashboard/broker/messages/?filter=ARCHIVED",
    );
  });

  it("shows the localized copy for a flag-off 403, never the server's string", async () => {
    session(false);
    fetchConversationsMock.mockRejectedValue(
      new ApiError(403, "feature_disabled", "This feature is not enabled yet."),
    );
    render(<MessagesScreen basePath="/dashboard/private-seller/messages/" filter="ALL" />);
    await waitFor(() =>
      expect(
        screen.getByText("Messages are not available yet."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("This feature is not enabled yet."),
    ).not.toBeInTheDocument();
  });

  it("asks a guest to sign in rather than fetching", () => {
    // The route wraps this screen in RequirePermission, which redirects a guest
    // to /login (ruling 13). This branch covers the frame before that redirect
    // lands, and the component's use in tests without the wrapper.
    session(false, false);
    render(<MessagesScreen basePath="/dashboard/private-seller/messages/" filter="ALL" />);
    expect(fetchConversationsMock).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in to see your messages.")).toBeInTheDocument();
  });

  it("explains a suspended or removed membership instead of a generic failure", async () => {
    // Ruling 15: accounts/selectors.py:63-65 lists memberships regardless of the
    // organization's status while accounts/services.py:150-159 requires ACTIVE,
    // so a member of a SUSPENDED brokerage reaches this screen and is refused.
    // "Something went wrong" would be true and useless.
    session(false);
    fetchConversationsMock.mockRejectedValue(
      new ApiError(403, "not_broker_member", "You are not a member."),
    );
    render(
      <MessagesScreen
        brokerId="b-1"
        basePath="/dashboard/broker/messages/"
        filter="ALL"
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/suspended, or your membership may have been removed/),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("You are not a member.")).not.toBeInTheDocument();
  });
});
