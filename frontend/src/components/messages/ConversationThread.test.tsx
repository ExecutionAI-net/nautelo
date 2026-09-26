import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ConversationThread from "@/components/messages/ConversationThread";
import type { ConversationRow, MessageRow } from "@/lib/api/conversations";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const CONVERSATION: ConversationRow = {
  id: "c-1",
  conversation_type: "BROKER_INQUIRY",
  subject: "Fleet question",
  status: "OPEN",
  last_message_at: "2026-09-18T09:30:00Z",
  created_at: "2026-09-18T09:00:00Z",
  unread_count: 0,
  context: { type: "BROKER", id: "b-1", label: "Phase19 Alpha Brokers", url: null },
  counterparty_name: "Ada Rossi",
  last_message_excerpt: "Hello",
  viewer_is_initiator: false,
};

function message(id: string, overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id,
    body: `Body of ${id}`,
    is_system: false,
    created_at: "2026-09-18T09:00:00Z",
    read_at: null,
    sender: { display_name: "Ada Rossi", is_you: false },
    ...overrides,
  };
}

describe("ConversationThread", () => {
  it("renders the subject and every message", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[message("m-1"), message("m-2")]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Fleet question" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Body of m-1")).toBeInTheDocument();
    expect(screen.getByText("Body of m-2")).toBeInTheDocument();
  });

  it("labels the viewer's own messages without naming them", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[
          message("m-1", { sender: { display_name: "Bo Reader", is_you: true } }),
        ]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("falls back to a localized placeholder for a blank sender name", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[message("m-1", { sender: { display_name: "", is_you: false } })]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.getByText("A Nautelo user")).toBeInTheDocument();
  });

  it("marks a system note as one", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[message("m-1", { is_system: true })]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.getByText("System note")).toBeInTheDocument();
  });

  it("offers no archive control to the sender of the inquiry", async () => {
    // Ruling 5: Conversation has ONE status column, so only the recipient side
    // may file. The server refuses with `conversation_filing_forbidden`; this is
    // the UI half, driven by the backend's own `viewer_is_initiator` rather than
    // by the client guessing from display text (spec 2.1).
    render(
      <ConversationThread
        locale="en"
        conversation={{ ...CONVERSATION, viewer_is_initiator: true }}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move to inbox" }),
    ).not.toBeInTheDocument();
    // …but they can still reply. Filing is not participation.
    expect(screen.getByLabelText("Reply")).toBeEnabled();
  });

  it("offers Archive on an open thread and Move to inbox on an archived one", async () => {
    const onToggleArchive = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={onToggleArchive}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onToggleArchive).toHaveBeenCalledWith("ARCHIVED");

    rerender(
      <ConversationThread
        locale="en"
        conversation={{ ...CONVERSATION, status: "ARCHIVED" }}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={onToggleArchive}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Move to inbox" }));
    expect(onToggleArchive).toHaveBeenCalledWith("OPEN");
  });

  it("disables the composer on a blocked thread and labels it Blocked", () => {
    // Spec 2.1: the badge must say what the status IS. A `!== "OPEN"` condition
    // would render "Archived" here, which is a different state with a different
    // meaning and a different way out of it.
    render(
      <ConversationThread
        locale="en"
        conversation={{ ...CONVERSATION, status: "BLOCKED" }}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Reply")).toBeDisabled();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    // …and no filing control, because BLOCKED is not a state this phase's
    // endpoint can leave (ruling 4).
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Move to inbox" }),
    ).not.toBeInTheDocument();
  });

  it("disables the composer on a thread closed by an account change and says so", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={{ ...CONVERSATION, status: "CLOSED" }}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Reply")).toBeDisabled();
    expect(screen.getByText("Closed – account changed")).toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("shows a real empty state for a thread with no messages", () => {
    render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(
      screen.getByText("This conversation has no messages yet."),
    ).toBeInTheDocument();
  });

  it("renders no email address or phone number anywhere in the thread", () => {
    // Phase 6's MessageSerializer returns neither sender_email_snapshot nor
    // sender_phone_snapshot; this is the DOM-side half of that guarantee.
    const { container } = render(
      <ConversationThread
        locale="en"
        conversation={CONVERSATION}
        messages={[message("m-1"), message("m-2")]}
        onSend={vi.fn()}
        onToggleArchive={vi.fn()}
      />,
    );
    expect(container.textContent).not.toMatch(/@/);
    expect(container.textContent).not.toMatch(/\+\d{6,}/);
  });
});
