import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ModerationQueue, { waitLabel } from "@/components/staff/ModerationQueue";
import RevisionReview from "@/components/staff/RevisionReview";

const api = vi.hoisted(() => ({
  fetchModerationQueue: vi.fn(),
  fetchRevisionDetail: vi.fn(),
  decideRevision: vi.fn().mockResolvedValue({}),
  QUEUE_TABS: ["initial", "revisions", "other_model", "suspended", "expiring"],
}));
vi.mock("@/lib/api/staffModeration", () => api);
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const counts = { initial: 1, revisions: 0, other_model: 0, suspended: 0, expiring: 0 };
const row = {
  kind: "revision",
  id: "r1",
  listing_id: "l1",
  title: "t",
  seller: "Acme",
  seller_type: "BROKER",
  submission_type: "initial",
  submitted_at: null,
  waiting_seconds: 7200,
  brand: "Beneteau",
  model: "Oceanis",
  is_other_model: false,
  custom_model_name: "",
  year: 2020,
  listing_status: "PENDING_APPROVAL",
};

describe("ModerationQueue", () => {
  it("renders tab counts and links each revision to its review page", async () => {
    api.fetchModerationQueue.mockResolvedValue({ tab: "initial", counts, results: [row] });
    render(<ModerationQueue />);
    expect(await screen.findByText(/2020 Beneteau Oceanis/)).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Initial (1)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe(
      "/dashboard/staff/revisions/r1/",
    );
  });

  it("formats waiting time", () => {
    expect(waitLabel(7200)).toBe("2 h");
    expect(waitLabel(60 * 60 * 72)).toBe("3 d");
  });
});

describe("RevisionReview", () => {
  const detail = {
    ...row,
    state: "SUBMITTED",
    version: 3,
    diff: [{ field: "price", before: 1, after: 2 }],
    media_diff: { added: [], removed: [], kept: 1 },
    warnings: [],
    audit_trail: [],
  };

  it("requires a reason to reject and sends the revision version on approve", async () => {
    api.fetchRevisionDetail.mockResolvedValue(detail);
    render(<RevisionReview revisionId="r1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/reason is required/);
    expect(api.decideRevision).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(api.decideRevision).toHaveBeenCalledWith("r1", {
        decision: "APPROVE",
        version: 3,
        note: "",
      }),
    );
  });
});
