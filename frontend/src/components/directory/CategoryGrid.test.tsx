import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CategoryGrid from "@/components/directory/CategoryGrid";
import type { ServiceCategory } from "@/lib/api/directory";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function category(overrides: Partial<ServiceCategory> = {}): ServiceCategory {
  return {
    id: "1",
    slug: "legal",
    name: "Legal",
    description: "",
    icon_key: "gavel",
    display_order: 20,
    has_seo_page: true,
    url: "/services/legal/",
    ...overrides,
  };
}

describe("CategoryGrid", () => {
  it("links each tile to the filtered directory", () => {
    render(<CategoryGrid locale="en" categories={[category()]} />);

    expect(screen.getByRole("link", { name: /legal/i })).toHaveAttribute(
      "href",
      "/services/professionals/?category=legal",
    );
  });

  it("renders a description only when the record has one", () => {
    const { rerender } = render(<CategoryGrid locale="en" categories={[category()]} />);
    expect(screen.queryByText("Contract work.")).not.toBeInTheDocument();

    rerender(
      <CategoryGrid
        locale="en"
        categories={[category({ description: "Contract work." })]}
      />,
    );
    expect(screen.getByText("Contract work.")).toBeInTheDocument();
  });

  it("shows a true empty message rather than placeholder tiles", () => {
    render(<CategoryGrid locale="en" categories={[]} />);

    expect(
      screen.getByText("No service categories are published yet."),
    ).toBeInTheDocument();
  });
});
