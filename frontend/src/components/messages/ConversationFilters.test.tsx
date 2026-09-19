import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConversationFilters from "@/components/messages/ConversationFilters";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const hrefFor = (filter: string) => `/dashboard/private-seller/messages/?filter=${filter}`;

describe("ConversationFilters", () => {
  it("renders exactly spec 28's five filters, in order", () => {
    render(<ConversationFilters locale="en" active="ALL" hrefFor={hrefFor} />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "All",
      "Unread",
      "Listing inquiries",
      "Profile inquiries",
      "Archived",
    ]);
  });

  it("marks the active filter with aria-current", () => {
    render(<ConversationFilters locale="en" active="ARCHIVED" hrefFor={hrefFor} />);
    expect(screen.getByRole("link", { name: "Archived" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders Italian copy for the it locale", () => {
    render(<ConversationFilters locale="it" active="ALL" hrefFor={hrefFor} />);
    expect(screen.getByRole("link", { name: "Non letti" })).toBeInTheDocument();
  });

  it("builds every href through the caller's hrefFor", () => {
    render(
      <ConversationFilters
        locale="en"
        active="ALL"
        hrefFor={(filter) => `/dashboard/broker/messages/?filter=${filter}`}
      />,
    );
    expect(screen.getByRole("link", { name: "Unread" })).toHaveAttribute(
      "href",
      "/dashboard/broker/messages/?filter=UNREAD",
    );
  });
});
