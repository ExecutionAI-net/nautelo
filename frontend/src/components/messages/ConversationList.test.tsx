import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConversationList from "@/components/messages/ConversationList";
import type { ConversationRow } from "@/lib/api/conversations";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function row(id: string, name: string): ConversationRow {
  return {
    id,
    conversation_type: "BROKER_INQUIRY",
    subject: `Subject ${id}`,
    status: "OPEN",
    last_message_at: "2026-09-18T09:30:00Z",
    created_at: "2026-09-18T09:00:00Z",
    unread_count: 0,
    context: { type: "BROKER", id: "b-1", label: "Alpha", url: null },
    counterparty_name: name,
    last_message_excerpt: "Hello there, about the boat.",
    viewer_is_initiator: false,
  };
}

describe("ConversationList", () => {
  it("renders one list item per conversation", () => {
    render(
      <ConversationList
        locale="en"
        rows={[row("c-1", "Ada"), row("c-2", "Bo")]}
        hrefFor={(id) => `/dashboard/private-seller/messages/${id}/`}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Ada/ })).toHaveAttribute(
      "href",
      "/dashboard/private-seller/messages/c-1/",
    );
  });

  it("shows a real empty state rather than an empty list", () => {
    render(
      <ConversationList locale="en" rows={[]} hrefFor={() => "/x/"} />,
    );
    expect(
      screen.getByText("No conversations match this filter."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
