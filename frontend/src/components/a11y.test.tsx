// Phase 23: automated accessibility sweep over the interactive components added
// in phases 16-20. axe-core runs on the rendered DOM; colour-contrast is skipped
// because jsdom has no layout or computed styles for it.
import axe from "axe-core";
import { render, screen, waitFor } from "@testing-library/react";
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
    { id: "a", title: "Boat", status: "DRAFT", seller_type: "PRIVATE", slug: null, updated_at: "", expires_at: null },
  ]),
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
    await screen.findByRole("option", { name: "Bavaria" });
    expect(await violations(container)).toEqual([]);
    unmount();
    const broker = render(<SellListingForm brokerId="b1" />);
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
