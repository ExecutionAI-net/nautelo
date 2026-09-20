// Phase 23: automated accessibility sweep over the interactive components added
// in phases 16-20. axe-core runs on the rendered DOM; colour-contrast is skipped
// because jsdom has no layout or computed styles for it.
import axe from "axe-core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MediaUpgradePanel from "@/components/listings/MediaUpgradePanel";
import MyListings from "@/components/listings/MyListings";
import SellListingForm from "@/components/listings/SellListingForm";
import ShareButtons from "@/components/listings/ShareButtons";
import ModerationQueue from "@/components/staff/ModerationQueue";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/api/sellerListings", () => ({
  searchBrands: vi.fn().mockResolvedValue([{ id: "b1", name: "Bavaria", slug: "b" }]),
  listModels: vi.fn().mockResolvedValue({ models: [], other: null }),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  submitListing: vi.fn(),
  listMedia: vi.fn().mockResolvedValue([]),
  removeMedia: vi.fn(),
  uploadMedia: vi.fn(),
  applyMediaUpgrade: vi.fn(),
  startMediaUpgradeCheckout: vi.fn(),
  fetchMyListings: vi.fn().mockResolvedValue([
    { id: "a", title: "Boat", status: "DRAFT", seller_type: "PRIVATE", slug: null, updated_at: "", expires_at: null, price: null, currency: "EUR", year: null, city: "", country: "", boat_type: "", condition: "", loa_m: "", beam_m: "", engine: "", views: 0, image_url: null },
  ]),
}));
vi.mock("@/lib/api/listingForm", () => ({
  fetchFormOptions: vi.fn().mockResolvedValue({
    years: [2026, 2025],
    boat_types: ["Motor yacht"],
    hull_materials: ["Steel"],
    engine_types: ["Inboard"],
    fuel_types: ["Diesel"],
    cabins: ["1"],
    bathrooms: ["1"],
    countries: ["IT", "TR"],
    media_limits: { free_images: 1, free_videos: 0, paid_images: 20, paid_videos: 1, broker_images: 20, broker_videos: 1 },
  }),
  fetchEligibility: vi.fn().mockResolvedValue({
    can_start_listing: true,
    blocking_reason: null,
    free: { available: true, next_available_at: null, used_at: null },
    paid_listing_rights_available: 0,
    purchase_product_code: "INDIVIDUAL_LISTING_RIGHT",
  }),
}));
vi.mock("@/lib/api/translation", () => ({
  fetchTranslationEnabled: vi.fn().mockResolvedValue(false),
  translateListingText: vi.fn(),
}));
vi.mock("@/lib/api/staffModeration", () => ({
  QUEUE_TABS: ["initial", "revisions", "other_model", "suspended", "expiring"],
  fetchModerationQueue: vi.fn().mockResolvedValue({
    tab: "initial",
    counts: { initial: 0, revisions: 0, other_model: 0, suspended: 0, expiring: 0 },
    results: [],
  }),
  setSuspension: vi.fn(),
}));

async function violations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

describe("accessibility", () => {
  it("ShareButtons", async () => {
    const { container } = render(<ShareButtons url="https://x.test/boats/a/" locale="en" />);
    expect(await violations(container)).toEqual([]);
  });

  it("SellListingForm (private and broker)", async () => {
    const { container, unmount } = render(<SellListingForm />);
    fireEvent.click(await screen.findByRole("combobox", { name: /brand/i }));
    await screen.findByRole("option", { name: "Bavaria" });
    expect(await violations(container)).toEqual([]);
    unmount();
    const broker = render(<SellListingForm brokerId="b1" />);
    fireEvent.click(await screen.findByRole("combobox", { name: /brand/i }));
    await screen.findByRole("option", { name: "Bavaria" });
    expect(await violations(broker.container)).toEqual([]);
  });

  it("MediaUpgradePanel", async () => {
    const { container } = render(<MediaUpgradePanel listingId="l" onApplied={() => {}} />);
    expect(await violations(container)).toEqual([]);
  });

  it("MyListings", async () => {
    const { container } = render(<MyListings />);
    await screen.findByText("Boat");
    expect(await violations(container)).toEqual([]);
  });

  it("ModerationQueue", async () => {
    const { container } = render(<ModerationQueue />);
    await waitFor(() => expect(screen.getByText("Nothing in this queue.")).toBeTruthy());
    expect(await violations(container)).toEqual([]);
  });
});
