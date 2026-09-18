import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProfessionalResultCard from "@/components/directory/ProfessionalCard";
import type { ProfessionalCard } from "@/lib/api/directory";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function professional(overrides: Partial<ProfessionalCard> = {}): ProfessionalCard {
  return {
    id: "1",
    slug: "ocean-legal",
    display_name: "Ocean Legal",
    short_description: "Maritime contracts",
    city: "Livorno",
    region: "Toscana",
    country_code: "IT",
    service_area: ["IT-52"],
    categories: [{ slug: "legal", name: "Legal" }],
    active_service_count: 2,
    url: "/services/professionals/ocean-legal/",
    ...overrides,
  };
}

describe("ProfessionalResultCard", () => {
  it("links to the canonical professional URL", () => {
    render(<ProfessionalResultCard locale="en" professional={professional()} />);

    expect(screen.getByRole("link", { name: "Ocean Legal" })).toHaveAttribute(
      "href",
      "/services/professionals/ocean-legal/",
    );
  });

  it("shows the categories the provider actually offers", () => {
    render(<ProfessionalResultCard locale="en" professional={professional()} />);

    expect(screen.getByText("Legal")).toBeInTheDocument();
  });

  it("omits the location line entirely when no location is recorded", () => {
    render(
      <ProfessionalResultCard
        locale="en"
        professional={professional({ city: "", region: "" })}
      />,
    );

    expect(screen.queryByTestId("professional-location")).not.toBeInTheDocument();
  });

  it("renders no contact details", () => {
    const { container } = render(
      <ProfessionalResultCard locale="en" professional={professional()} />,
    );

    expect(container.textContent).not.toMatch(/@/);
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });
});
