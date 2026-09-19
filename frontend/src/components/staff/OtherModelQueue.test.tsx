import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OtherModelQueue from "@/components/staff/OtherModelQueue";

const api = vi.hoisted(() => ({
  fetchOtherQueue: vi.fn(),
  fetchBrandModels: vi.fn(),
  mapListing: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/api/staffTaxonomy", () => api);

const row = {
  listing_id: "l1",
  brand: "Bavaria",
  brand_id: "b1",
  custom_model_name: "Cruiser 46",
  owner: "Acme",
  seller_type: "BROKER",
  status: "PUBLISHED",
  created_at: "",
};

describe("OtherModelQueue", () => {
  it("maps a listing to an existing model and reloads the queue", async () => {
    api.fetchOtherQueue.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
    api.fetchBrandModels.mockResolvedValue([
      { id: "m1", brand_id: "b1", name: "Cruiser 46", is_other_placeholder: false, is_active: true },
      { id: "o", brand_id: "b1", name: "Other", is_other_placeholder: true, is_active: true },
    ]);
    render(<OtherModelQueue />);
    await screen.findByText(/Bavaria/);
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    fireEvent.change(screen.getByLabelText("Existing model"), { target: { value: "m1" } });
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    await waitFor(() =>
      expect(api.mapListing).toHaveBeenCalledWith("l1", { model_id: "m1" }, expect.any(String)),
    );
    expect(await screen.findByText("No listings use the Other model.")).toBeTruthy();
  });
});
