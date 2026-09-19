import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SellListingForm from "@/components/listings/SellListingForm";

vi.mock("@/lib/api/sellerListings", () => ({
  searchBrands: vi.fn().mockResolvedValue([]),
  listModels: vi.fn().mockResolvedValue({ models: [], other: null }),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  submitListing: vi.fn(),
  listMedia: vi.fn(),
  removeMedia: vi.fn(),
  uploadMedia: vi.fn(),
}));

describe("SellListingForm", () => {
  it("shows the financing fieldset to brokers only", () => {
    const { unmount } = render(<SellListingForm brokerId="b1" />);
    expect(screen.getByText("Financing estimate")).toBeTruthy();
    unmount();
    render(<SellListingForm />);
    expect(screen.queryByText("Financing estimate")).toBeNull();
  });
});
