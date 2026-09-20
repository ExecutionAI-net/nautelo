import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

import PlanCards from "@/components/pricing/PlanCards";

const PLANS = [
  { slug: "boutique-broker", name: "Boutique Broker", tagline: "Independent brokers", monthly_price: "290.00", currency: "EUR", listing_limit: 5, seat_limit: 2, profile_visibility: "Standard" },
  { slug: "sovereign-agency", name: "Sovereign Agency", tagline: "Superyacht fleets", monthly_price: "1850.00", currency: "EUR", listing_limit: null, seat_limit: null, profile_visibility: "Featured placement" },
];

describe("PlanCards", () => {
  it("shows price, limits and unlimited tiers", () => {
    render(<PlanCards plans={PLANS} />);
    expect(screen.getByText("€290")).toBeTruthy();
    expect(screen.getByText("5 Active Vessel Listings")).toBeTruthy();
    expect(screen.getByText("Unlimited Active Vessel Listings")).toBeTruthy();
    expect(screen.getByText("Featured placement")).toBeTruthy();
  });

  it("marks the enrolled tier and offers the others", () => {
    render(<PlanCards plans={PLANS} currentSlug="boutique-broker" ctaLabel="Request this tier" />);
    expect(screen.getByRole("button", { name: "Currently Enrolled" })).toBeDisabled();
    expect(screen.getAllByRole("link", { name: "Request this tier" })).toHaveLength(1);
  });
});
