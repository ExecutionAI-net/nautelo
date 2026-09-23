import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RevisionReview, { fieldLabel } from "@/components/staff/RevisionReview";
import type { RevisionDetail } from "@/lib/api/staffModeration";

const { fetchRevisionDetail } = vi.hoisted(() => ({ fetchRevisionDetail: vi.fn() }));
vi.mock("@/lib/api/staffModeration", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/staffModeration")>()),
  fetchRevisionDetail,
}));

const DETAIL: RevisionDetail = {
  kind: "revision",
  id: "r1",
  listing_id: "l1",
  title: "2015 Fairline Targa 34",
  seller: "private@example.com",
  seller_type: "PRIVATE",
  submission_type: "revision",
  submitted_at: null,
  waiting_seconds: null,
  brand: "Fairline",
  model: "Targa 34",
  is_other_model: false,
  custom_model_name: "",
  year: 2015,
  listing_status: "PUBLISHED",
  state: "SUBMITTED",
  version: 2,
  diff: [
    { field: "price", before: "189000.00", after: "185000.00" },
    { field: "specifications.cabins", before: 2, after: 3 },
    { field: "brand_id", before: null, after: "Fairline" },
  ],
  media_diff: {
    added: [],
    removed: [],
    kept: 1,
    proposed: [
      { id: "m1", media_type: "IMAGE", status: "READY", mime_type: "image/jpeg", width: 1200, height: 800, change: "kept", url: "https://cdn/x.jpg" },
    ],
  },
  warnings: [],
  audit_trail: [],
};

describe("RevisionReview", () => {
  it("names fields and specs for the moderator and shows the proposed photos", async () => {
    fetchRevisionDetail.mockResolvedValue(DETAIL);
    render(<RevisionReview revisionId="r1" />);
    await waitFor(() => expect(screen.getByText("Changes")).toBeTruthy());
    expect(screen.getByText("Price")).toBeTruthy();
    expect(screen.getByText("Spec: Cabins")).toBeTruthy();
    expect(screen.getByText("Brand")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Photos and videos" }).querySelector("img")?.getAttribute("src")).toBe("https://cdn/x.jpg");
    expect(screen.getByText("Kept")).toBeTruthy();
  });

  it("tidies unknown keys", () => {
    expect(fieldLabel("specifications.deck_material")).toBe("Spec: Deck material");
    expect(fieldLabel("some_new_field")).toBe("Some new field");
  });
});
