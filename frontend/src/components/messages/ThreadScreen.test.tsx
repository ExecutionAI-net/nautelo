import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ThreadScreen from "@/components/messages/ThreadScreen";
import { ApiError } from "@/lib/api/client";

const {
  useSessionMock,
  fetchConversationMock,
  fetchThreadMock,
  markReadMock,
  postReplyMock,
  setStatusMock,
} = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  fetchConversationMock: vi.fn(),
  fetchThreadMock: vi.fn(),
  markReadMock: vi.fn(),
  postReplyMock: vi.fn(),
  setStatusMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ useSession: () => useSessionMock() }));
vi.mock("@/lib/api/conversations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/conversations")>();
  return {
    ...actual,
    fetchConversation: (...a: unknown[]) => fetchConversationMock(...a),
    fetchThread: (...a: unknown[]) => fetchThreadMock(...a),
    markConversationRead: (...a: unknown[]) => markReadMock(...a),
    postReply: (...a: unknown[]) => postReplyMock(...a),
    setConversationStatus: (...a: unknown[]) => setStatusMock(...a),
  };
});
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const CONVERSATION = {
  id: "c-1",
  conversation_type: "BROKER_INQUIRY",
  subject: "Fleet question",
  status: "OPEN",
  last_message_at: "2026-09-18T09:30:00Z",
  created_at: "2026-09-18T09:00:00Z",
  unread_count: 1,
  context: { type: "BROKER", id: "b-1", label: "Alpha", url: null },
  counterparty_name: "Ada Rossi",
  last_message_excerpt: "Hello",
  viewer_is_initiator: false,
};

function readySession() {
  useSessionMock.mockReturnValue({
    session: { authenticated: true, user: { locale: "EN" }, broker_memberships: [] },
    loading: false,
    error: null,
    can: () => false,
    login: vi.fn(),
    logout: vi.fn(),
    reload: vi.fn(),
  });
}

afterEach(() => {
  [
    useSessionMock,
    fetchConversationMock,
    fetchThreadMock,
    markReadMock,
    postReplyMock,
    setStatusMock,
  ].forEach((mock) => mock.mockReset());
});

describe("ThreadScreen", () => {
  it("loads the thread and marks it read once", async () => {
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: "m-1",
          body: "Hello about the boat, please.",
          is_system: false,
          created_at: "2026-09-18T09:00:00Z",
          read_at: null,
          sender: { display_name: "Ada Rossi", is_you: false },
        },
      ],
    });
    markReadMock.mockResolvedValue({ marked_read: 1 });

    render(<ThreadScreen conversationId="c-1" basePath="/dashboard/messages/" />);
    await waitFor(() =>
      expect(screen.getByText("Hello about the boat, please.")).toBeInTheDocument(),
    );
    await waitFor(() => expect(markReadMock).toHaveBeenCalledTimes(1));
    expect(markReadMock).toHaveBeenCalledWith("c-1");
  });

  it("reads the conversation from the detail endpoint, never by scanning the inbox", async () => {
    // Ruling 14. The inbox returns one page of 20, so a scan silently fails for
    // a broker's 21st conversation — a bug no fixture-sized test would catch,
    // which is why the assertion is about WHICH call is made.
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    markReadMock.mockResolvedValue({ marked_read: 0 });

    render(<ThreadScreen conversationId="c-1" basePath="/dashboard/messages/" />);
    await waitFor(() => expect(fetchConversationMock).toHaveBeenCalledWith("c-1"));
  });

  it("shows the not-found copy for a conversation the caller may not see", async () => {
    // Spec 33.1: the server answers 404 rather than 403 so an id cannot be
    // probed. The screen must not invent a different story.
    readySession();
    fetchConversationMock.mockRejectedValue(new ApiError(404, "not_found", "x"));
    fetchThreadMock.mockRejectedValue(new ApiError(404, "not_found", "x"));
    render(<ThreadScreen conversationId="c-9" basePath="/dashboard/messages/" />);
    await waitFor(() =>
      expect(
        screen.getByText("This conversation is not available."),
      ).toBeInTheDocument(),
    );
  });

  it("posts a reply and appends it without a full reload", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    markReadMock.mockResolvedValue({ marked_read: 0 });
    postReplyMock.mockResolvedValue({
      id: "m-2",
      body: "Thank you, next Tuesday morning works well.",
      is_system: false,
      created_at: "2026-09-18T10:00:00Z",
      read_at: null,
      sender: { display_name: "Bo Reader", is_you: true },
    });

    render(<ThreadScreen conversationId="c-1" basePath="/dashboard/messages/" />);
    await waitFor(() => expect(screen.getByLabelText("Reply")).toBeEnabled());
    await userEvent.type(
      screen.getByLabelText("Reply"),
      "Thank you, next Tuesday morning works well.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(
        screen.getByText("Thank you, next Tuesday morning works well."),
      ).toBeInTheDocument(),
    );
  });

  it("surfaces a 409 conversation_closed in the reader's language", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    markReadMock.mockResolvedValue({ marked_read: 0 });
    postReplyMock.mockRejectedValue(
      new ApiError(409, "conversation_closed", "Closed."),
    );

    render(<ThreadScreen conversationId="c-1" basePath="/dashboard/messages/" />);
    await waitFor(() => expect(screen.getByLabelText("Reply")).toBeEnabled());
    await userEvent.type(
      screen.getByLabelText("Reply"),
      "Thank you, next Tuesday morning works well.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(screen.getByText("This conversation is closed.")).toBeInTheDocument(),
    );
  });

  it("archives through the status endpoint and re-renders the new state", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    markReadMock.mockResolvedValue({ marked_read: 0 });
    setStatusMock.mockResolvedValue({ ...CONVERSATION, status: "ARCHIVED" });

    render(<ThreadScreen conversationId="c-1" basePath="/dashboard/messages/" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(setStatusMock).toHaveBeenCalledWith("c-1", "ARCHIVED"),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Move to inbox" }),
      ).toBeInTheDocument(),
    );
  });

  it("links back to the inbox it was opened from", async () => {
    readySession();
    fetchConversationMock.mockResolvedValue(CONVERSATION);
    fetchThreadMock.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    markReadMock.mockResolvedValue({ marked_read: 0 });
    render(
      <ThreadScreen conversationId="c-1" basePath="/dashboard/broker/messages/" />,
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Back to messages" })).toHaveAttribute(
        "href",
        "/dashboard/broker/messages/",
      ),
    );
  });
});
