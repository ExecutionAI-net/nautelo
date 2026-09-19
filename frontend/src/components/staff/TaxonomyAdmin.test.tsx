import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TaxonomyAdmin from "@/components/staff/TaxonomyAdmin";

const api = vi.hoisted(() => ({
  fetchBrands: vi.fn().mockResolvedValue([{ id: "b1", name: "Bavaria", slug: "bavaria", is_active: true }]),
  fetchBrandModels: vi.fn().mockResolvedValue([
    { id: "m1", brand_id: "b1", name: "Dup", is_other_placeholder: false, is_active: true },
    { id: "m2", brand_id: "b1", name: "Real", is_other_placeholder: false, is_active: true },
    { id: "o", brand_id: "b1", name: "Other", is_other_placeholder: true, is_active: true },
  ]),
  createBrand: vi.fn().mockResolvedValue({}),
  createModel: vi.fn(),
  setBrandActive: vi.fn(),
  setModelActive: vi.fn(),
  mergePreview: vi.fn().mockResolvedValue({ affected_count: 3 }),
  mergeModels: vi.fn().mockResolvedValue({ merged_listings: 3 }),
}));
vi.mock("@/lib/api/staffTaxonomy", () => api);

async function selectBrand() {
  await screen.findByRole("option", { name: "Bavaria" });
  fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "b1" } });
  await screen.findByRole("button", { name: "Add model" });
}

describe("TaxonomyAdmin", () => {
  it("previews the affected count and merges after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TaxonomyAdmin />);
    await selectBrand();
    await waitFor(() => expect(screen.getAllByRole("option", { name: "Dup" }).length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Merge model"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText("into"), { target: { value: "m2" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview and merge" }));
    await waitFor(() => expect(api.mergeModels).toHaveBeenCalledWith("m1", "m2", expect.any(String)));
    expect(api.mergePreview).toHaveBeenCalledWith("m1", "m2");
  });

  it("never offers the Other placeholder for editing", async () => {
    render(<TaxonomyAdmin />);
    await selectBrand();
    await waitFor(() => expect(screen.getAllByText("Real").length).toBeGreaterThan(0));
    expect(screen.queryByText("Other")).toBeNull();
  });
});
