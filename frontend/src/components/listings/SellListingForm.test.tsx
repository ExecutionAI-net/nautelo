import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SellListingForm from "@/components/listings/SellListingForm";
import { fetchWorkflowListing, listMedia, reorderMedia } from "@/lib/api/sellerListings";
import type { MediaRow, WorkflowListing } from "@/lib/api/sellerListings";

vi.mock("@/lib/api/sellerListings", () => ({
  searchBrands: vi.fn().mockResolvedValue([]),
  listModels: vi.fn().mockResolvedValue({ models: [], other: null }),
  createDraft: vi.fn(),
  fetchWorkflowListing: vi.fn(),
  updateDraft: vi.fn(),
  submitListing: vi.fn(),
  listMedia: vi.fn(),
  removeMedia: vi.fn(),
  uploadMedia: vi.fn(),
  reorderMedia: vi.fn(),
}));

const WORKFLOW_LISTING: WorkflowListing = {
  id: "L1",
  status: "DRAFT",
  seller_type: "PRIVATE",
  version: 1,
  revision: { id: "R1", version: 1, state: "DRAFT", payload: {} },
  policy: { requires_approval: true, immutable_fields: [], image_limit: 20, video_limit: 1 },
};

const photo = (id: string): MediaRow => ({
  id,
  media_type: "IMAGE",
  status: "READY",
  mime_type: "image/jpeg",
  byte_size: 1,
  sort_order: 0,
  rejection_reason: "",
  preview_url: `blob:${id}`,
});

describe("SellListingForm", () => {
  it("shows the financing fieldset to brokers only", () => {
    const { unmount } = render(<SellListingForm brokerId="b1" />);
    expect(screen.getByText("Financing estimate")).toBeTruthy();
    unmount();
    render(<SellListingForm />);
    expect(screen.queryByText("Financing estimate")).toBeNull();
  });

  it("lets photos be picked before the first save and counts them", () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<SellListingForm />);
    expect(screen.getByText("Photos 0 / 1")).toBeTruthy();
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Add media"), { target: { files: [file] } });
    expect(screen.getByText("Photos 1 / 1")).toBeTruthy();
  });

  it("reorders photos by dragging one thumbnail onto another", async () => {
    vi.mocked(listMedia).mockResolvedValue([photo("a"), photo("b"), photo("c")]);
    vi.mocked(reorderMedia).mockResolvedValue([photo("b"), photo("a"), photo("c")]);
    render(<SellListingForm initial={WORKFLOW_LISTING} />);
    await waitFor(() => expect(screen.getByTestId("media-a")).toBeTruthy());

    fireEvent.dragStart(screen.getByTestId("media-a"));
    fireEvent.drop(screen.getByTestId("media-c"));

    expect(reorderMedia).toHaveBeenCalledWith("L1", "IMAGE", ["b", "c", "a"]);
  });

  it("seeds the form from the live content when a published listing has no open revision", () => {
    render(
      <SellListingForm
        initial={{
          ...WORKFLOW_LISTING,
          status: "PUBLISHED",
          revision: null,
          published_payload: { title_en: "Live title", location_city: "Genoa", price: "189000.00" },
        }}
      />,
    );
    expect((screen.getByDisplayValue("Live title") as HTMLInputElement).value).toBe("Live title");
    expect(screen.getByDisplayValue("Genoa")).toBeTruthy();
    expect(screen.getByDisplayValue("189000.00")).toBeTruthy();
  });

  it("shows the promotion as paid only once the server confirms it, not from the return URL alone", async () => {
    vi.mocked(listMedia).mockResolvedValue([]);
    window.history.replaceState(null, "", "/sell/L1/?promotion=success");
    vi.mocked(fetchWorkflowListing).mockResolvedValue({ ...WORKFLOW_LISTING, promotion: { paid: true, active_until: null } });
    render(<SellListingForm initial={{ ...WORKFLOW_LISTING, promotion: { paid: false, active_until: null } }} />);
    expect(screen.queryByText(/Promotion paid/)).toBeNull();
    await waitFor(() => expect(screen.getByText(/Promotion paid/)).toBeTruthy());
    expect(fetchWorkflowListing).toHaveBeenCalledWith("L1");
    window.history.replaceState(null, "", "/");
  });

  it("labels a saved brand and model by name instead of a placeholder", () => {
    vi.mocked(listMedia).mockResolvedValue([]);
    render(
      <SellListingForm
        initial={{
          ...WORKFLOW_LISTING,
          brand_name: "Fairline",
          model_name: "Targa 34",
          revision: { id: "R1", version: 1, state: "DRAFT", payload: { brand_id: "b1", model_id: "m1" } },
        }}
      />,
    );
    expect(screen.getByText("Fairline")).toBeTruthy();
    expect(screen.getByText("Targa 34")).toBeTruthy();
    expect(screen.queryByText("Current brand")).toBeNull();
  });
});
