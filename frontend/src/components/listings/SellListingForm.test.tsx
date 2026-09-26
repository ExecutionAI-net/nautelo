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
  isMediaProcessing: (status: string) => ["UPLOADING", "SCANNING", "PROCESSING"].includes(status),
  removeMedia: vi.fn(),
  uploadMedia: vi.fn(),
  reorderMedia: vi.fn(),
  startListingRightCheckout: vi.fn(),
}));

const eligibility = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/listingForm", () => ({
  fetchFormOptions: vi.fn().mockRejectedValue(new Error("offline")),
  fetchEligibility: eligibility,
}));

vi.mock("@/lib/api/plans", () => ({
  fetchPricingClient: vi.fn().mockResolvedValue({
    listing_packages: [{ slug: "standard", name: "Standard", description: "", amount: "29.00", currency: "EUR", publication_days: 30, image_limit: 20, video_limit: 1 }],
    broker_plans: [],
    individual_products: [],
  }),
  formatPrice: (amount: string) => `€${amount}`,
}));

const ELIGIBLE = {
  can_start_listing: true,
  blocking_reason: null,
  free: { available: true, next_available_at: null, used_at: null },
  paid_listing_rights_available: 0,
  purchase_product_code: "INDIVIDUAL_LISTING_RIGHT",
};
eligibility.mockResolvedValue(ELIGIBLE);

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

  it("offers the package picked on the pricing page even when a free listing is available", async () => {
    window.history.replaceState(null, "", "/sell/create/?package=standard");
    render(<SellListingForm />);

    expect(await screen.findByRole("heading", { name: "Buy the paid listing you picked" })).toBeTruthy();
    const [picked] = await screen.findAllByRole("radio", { name: /Standard/ });
    expect(picked).toBeChecked();
    expect(screen.getByText(/skip this and continue below with your free listing/)).toBeTruthy();
    window.history.replaceState(null, "", "/sell/create/");
  });

  it("tells a seller with unused paid listings what buying more means", async () => {
    window.history.replaceState(null, "", "/sell/create/?package=standard");
    eligibility.mockResolvedValueOnce({ ...ELIGIBLE, paid_listing_rights_available: 2 });
    render(<SellListingForm />);

    expect(await screen.findByText(/You already have 2 unused paid listing/)).toBeTruthy();
    window.history.replaceState(null, "", "/sell/create/");
  });

  it("does not push a package on a seller who did not pick one", async () => {
    render(<SellListingForm />);
    await waitFor(() => expect(eligibility).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Buy the paid listing you picked" })).toBeNull();
  });

  it("lets photos be picked before the first save and counts them", async () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<SellListingForm />);
    expect(screen.getByText("Photos 0 / 1")).toBeTruthy();
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Add media"), { target: { files: [file] } });
    expect(await screen.findByText("Photos 1 / 1")).toBeTruthy();
  });

  it("states the accepted files in the upload box and stops a file that breaks them", async () => {
    render(<SellListingForm />);
    expect(screen.getByText(/JPG, PNG or WebP, up to 25 MB, at least 400×300 px/)).toBeTruthy();
    expect(screen.getByLabelText("Add media").getAttribute("accept")).toContain("video/webm");

    const gif = new File(["x"], "a.gif", { type: "image/gif" });
    fireEvent.change(screen.getByLabelText("Add media"), { target: { files: [gif] } });
    expect(await screen.findByText(/a.gif: this file type is not accepted/)).toBeTruthy();

    const huge = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(huge, "size", { value: 26 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Add media"), { target: { files: [huge] } });
    expect(await screen.findByText("big.jpg is too large. The limit is 25 MB.")).toBeTruthy();
    expect(screen.getByText("Photos 0 / 1")).toBeTruthy();
  });

  it("switches the broker's monthly payment estimate on by default", () => {
    render(<SellListingForm brokerId="b1" />);
    expect(screen.getByRole("checkbox", { name: /estimated monthly payment/i })).toBeChecked();
  });

  it("keeps the currency next to the price instead of stretching it full width", () => {
    render(<SellListingForm />);
    const currency = screen.getByRole("combobox", { name: /currency/i });
    expect(currency.className).toContain("w-24");
    expect(currency.className).not.toContain("w-full");
  });

  it("explains a photo that is still being checked and picks up the verdict by itself", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const scanning = { ...photo("s"), status: "SCANNING", preview_url: null };
      vi.mocked(listMedia).mockResolvedValueOnce([scanning]).mockResolvedValue([photo("s")]);
      render(<SellListingForm initial={WORKFLOW_LISTING} />);

      expect(await screen.findByText("Checking…")).toBeTruthy();
      expect(screen.queryByText(/IMAGE · SCANNING/)).toBeNull();
      expect(screen.getByText(/being prepared/)).toBeTruthy();

      await vi.advanceTimersByTimeAsync(15000);
      await waitFor(() => expect(screen.queryByText("Checking…")).toBeNull());
      expect(screen.queryByText(/being prepared/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
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

describe("numericOnly", () => {
  it("drops letters and keeps one decimal separator for measurements", async () => {
    const { numericOnly } = await import("@/components/listings/SellListingForm");
    expect(numericOnly("12abc,5", true)).toBe("12,5");
    expect(numericOnly("1.2.3", true)).toBe("1.23");
    expect(numericOnly("3 cabins", false)).toBe("3");
  });
});
