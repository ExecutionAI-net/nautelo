import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SellerOverview from "@/components/seller/SellerOverview";

const api = vi.hoisted(() => ({
  fetchMyListings: vi.fn(),
  fetchMyListingsSummary: vi.fn(),
  fetchConversations: vi.fn(),
}));
vi.mock("@/lib/api/sellerListings", () => ({ fetchMyListings: api.fetchMyListings, fetchMyListingsSummary: api.fetchMyListingsSummary }));
vi.mock("@/lib/api/conversations", () => ({ fetchConversations: api.fetchConversations }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session: { user: { full_name: "Capt. Santiago", email: "s@x.test" } } }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

describe("SellerOverview", () => {
  it("welcomes the owner and shows the counters, fleet and latest enquiries from the API", async () => {
    api.fetchMyListingsSummary.mockResolvedValue({ published: 2, drafts: 1, in_review: 0, views: 1420 });
    api.fetchMyListings.mockResolvedValue([
      {
        id: "a", title: "Solaris 50", status: "PUBLISHED", seller_type: "PRIVATE", slug: "solaris-50", updated_at: "", expires_at: null,
        price: "685000", currency: "EUR", year: 2021, city: "Palma", country: "ES", boat_type: "Sailing yacht", condition: "used",
        loa_m: "15.4", beam_m: "4.78", engine: "Yanmar 75HP", views: 1420, image_url: null,
      },
    ]);
    api.fetchConversations.mockResolvedValue({
      count: 1,
      results: [{ id: "c1", subject: "Solaris 50", counterparty_name: "Marco Bellini", last_message_excerpt: "Request for survey", unread_count: 2 }],
    });
    render(<SellerOverview />);
    expect(await screen.findByText("Welcome back, Capt. Santiago")).toBeTruthy();
    expect(await screen.findByText("1,420", { selector: "p" })).toBeTruthy();
    expect(await screen.findByText("€685,000")).toBeTruthy();
    expect(await screen.findByText("Marco Bellini")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Marco Bellini/ }).getAttribute("href")).toBe("/dashboard/private-seller/messages/c1/");
  });
});
