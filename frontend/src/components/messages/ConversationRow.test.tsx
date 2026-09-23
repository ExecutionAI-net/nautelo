import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConversationRowCard from "@/components/messages/ConversationRow";
import type { ConversationRow } from "@/lib/api/conversations";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const ROW: ConversationRow = {
  id: "c-1",
  conversation_type: "BROKER_INQUIRY",
  subject: "Fleet question",
  status: "OPEN",
  last_message_at: "2026-09-18T09:30:00Z",
  created_at: "2026-09-18T09:00:00Z",
  unread_count: 2,
  context: {
    type: "BROKER",
    id: "b-1",
    label: "Phase19 Alpha Brokers",
    url: "/brokers/phase19-alpha-brokers/",
  },
  counterparty_name: "Ada Rossi",
  last_message_excerpt: "I would like to arrange a viewing next week.",
  viewer_is_initiator: false,
};

describe("ConversationRowCard", () => {
  it("shows every field spec 28's row names", () => {
    const { container } = render(
      <ConversationRowCard locale="en" row={ROW} href="/dashboard/private-seller/messages/c-1/" />,
    );
    expect(screen.getByText("Ada Rossi")).toBeInTheDocument();
    // The context type and the label are separate elements on purpose (see the
    // component), so each is addressable by its exact text. If this ever has to
    // become a regex, the component has regressed to one span.
    expect(screen.getByText("Broker")).toBeInTheDocument();
    expect(screen.getByText("Phase19 Alpha Brokers")).toBeInTheDocument();
    expect(
      screen.getByText("I would like to arrange a viewing next week."),
    ).toBeInTheDocument();
    expect(screen.getByText("2 unread")).toBeInTheDocument();
    // querySelector, not getByRole("time"): `time` is not an ARIA role (it is
    // not in the ARIA role vocabulary, and jsx-a11y's no-noninteractive-element-
    // to-interactive-role / aria-role rules reject `role="time"` on the
    // element), so there is no role to query and none to add.
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-09-18T09:30:00Z",
    );
  });

  it("falls back to a localized placeholder for a blank sender name", () => {
    // Phase 6 refuses to put an email address into sender_name_snapshot, so a
    // blank name is the common case and must never render as empty space.
    render(
      <ConversationRowCard
        locale="en"
        row={{ ...ROW, counterparty_name: "" }}
        href="/x/"
      />,
    );
    expect(screen.getByText("A Nautelo user")).toBeInTheDocument();
  });

  it("hides the unread badge at zero rather than showing '0 unread'", () => {
    render(
      <ConversationRowCard locale="en" row={{ ...ROW, unread_count: 0 }} href="/x/" />,
    );
    expect(screen.queryByText(/unread/)).not.toBeInTheDocument();
  });

  it("marks an archived row with a visible badge, not only a colour", () => {
    // Spec 29.6: state is never conveyed by colour alone.
    render(
      <ConversationRowCard
        locale="en"
        row={{ ...ROW, status: "ARCHIVED" }}
        href="/x/"
      />,
    );
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("labels a blocked row Blocked, not Archived", () => {
    // Spec 2.1: a visible state must be the state the data says. A `!== "OPEN"`
    // badge condition would call every blocked thread archived.
    render(
      <ConversationRowCard
        locale="en"
        row={{ ...ROW, status: "BLOCKED" }}
        href="/x/"
      />,
    );
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("shows no status badge at all on an open row", () => {
    render(<ConversationRowCard locale="en" row={ROW} href="/x/" />);
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("renders no timestamp at all when there is no last message", () => {
    const { container } = render(
      <ConversationRowCard
        locale="en"
        row={{ ...ROW, last_message_at: null }}
        href="/x/"
      />,
    );
    expect(container.querySelector("time")).toBeNull();
  });

  it("never renders an email address or a phone number", () => {
    const { container } = render(
      <ConversationRowCard locale="en" row={ROW} href="/x/" />,
    );
    expect(container.textContent).not.toMatch(/@/);
    expect(container.textContent).not.toMatch(/\+\d{6,}/);
  });
});
