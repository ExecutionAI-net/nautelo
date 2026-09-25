import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/components/layout/LocaleContext";
import PaidListingBuy from "@/components/listings/PaidListingBuy";

const plans = vi.hoisted(() => ({ fetchPricingClient: vi.fn(), formatPrice: (amount: string) => `€${amount}` }));
vi.mock("@/lib/api/plans", () => plans);
vi.mock("@/lib/api/sellerListings", () => ({ startListingRightCheckout: vi.fn() }));

const PACKAGE = {
  slug: "standard",
  name: "Standard",
  description: "",
  amount: "29.00",
  currency: "EUR",
  publication_days: 30,
  image_limit: 20,
  video_limit: 1,
};

describe("PaidListingBuy", () => {
  it("asks the API for package names in the page language and describes the package in words", async () => {
    plans.fetchPricingClient.mockResolvedValue({ listing_packages: [PACKAGE], broker_plans: [], individual_products: [] });
    render(
      <LocaleProvider locale="it">
        <PaidListingBuy />
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByText(/30 days · 20 photos/)).toBeInTheDocument());
    expect(plans.fetchPricingClient).toHaveBeenCalledWith("it");
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy paid listings" })).toBeInTheDocument();
  });

  it("says so when nothing is on sale", async () => {
    plans.fetchPricingClient.mockResolvedValue({ listing_packages: [], broker_plans: [], individual_products: [] });
    render(<PaidListingBuy />);
    await waitFor(() => expect(screen.getByText("Paid listings are not on sale yet.")).toBeInTheDocument());
    expect(plans.fetchPricingClient).toHaveBeenLastCalledWith("en");
  });
});
