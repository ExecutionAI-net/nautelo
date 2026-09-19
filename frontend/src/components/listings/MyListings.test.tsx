import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MyListings from "@/components/listings/MyListings";

const api = vi.hoisted(() => ({ fetchMyListings: vi.fn() }));
vi.mock("@/lib/api/sellerListings", () => api);
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

describe("MyListings", () => {
  it("links each listing to its editor and only published ones to the public page", async () => {
    api.fetchMyListings.mockResolvedValue([
      { id: "a", title: "Draft boat", status: "DRAFT", seller_type: "PRIVATE", slug: null, updated_at: "", expires_at: null },
      { id: "b", title: "Live boat", status: "PUBLISHED", seller_type: "PRIVATE", slug: "live-1", updated_at: "", expires_at: null },
    ]);
    render(<MyListings />);
    expect(await screen.findByText("Live boat")).toBeTruthy();
    const edits = screen.getAllByRole("link", { name: "Edit" });
    expect(edits.map((l) => l.getAttribute("href"))).toEqual(["/sell/a/", "/sell/b/"]);
    expect(screen.getAllByRole("link", { name: "View" })).toHaveLength(1);
  });
});
