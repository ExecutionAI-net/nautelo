import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MyListings from "@/components/listings/MyListings";

const api = vi.hoisted(() => ({ fetchMyListings: vi.fn(), deleteListing: vi.fn() }));
vi.mock("@/lib/api/sellerListings", () => api);
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const base = {
  version: 1,
  seller_type: "PRIVATE",
  updated_at: "",
  expires_at: null,
  price: null,
  currency: "EUR",
  year: null,
  city: "",
  country: "",
  boat_type: "",
  condition: "",
  loa_m: "",
  beam_m: "",
  engine: "",
  views: 0,
  image_url: null,
};

describe("MyListings", () => {
  it("links each listing to its editor and only published ones to the public page", async () => {
    api.fetchMyListings.mockResolvedValue([
      { ...base, id: "a", title: "Draft boat", status: "DRAFT", slug: null },
      { ...base, id: "b", title: "Live boat", status: "PUBLISHED", slug: "live-1", price: "125000", loa_m: "12.5", views: 1420 },
    ]);
    render(<MyListings />);
    expect(await screen.findByText("Live boat")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue editing" }).getAttribute("href")).toBe("/sell/a/");
    expect(screen.getByRole("link", { name: "Edit listing" }).getAttribute("href")).toBe("/sell/b/");
    // The thumbnail is a second, image-wrapping link to the same destination
    // as the explicit button, for both the published and the draft listing.
    expect(screen.getAllByRole("link", { name: "View public page" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Preview listing" }).getAttribute("href")).toBe(
      "/dashboard/listings/a/preview/",
    );
    expect(screen.getByText("€125,000")).toBeTruthy();
    expect(screen.getByText("12.5 m")).toBeTruthy();
    expect(screen.getByText(/1,420 views/)).toBeTruthy();
  });

  it("filters by status with counts on the tabs", async () => {
    api.fetchMyListings.mockResolvedValue([
      { ...base, id: "a", title: "Draft boat", status: "DRAFT", slug: null },
      { ...base, id: "b", title: "Live boat", status: "PUBLISHED", slug: "live-1" },
    ]);
    render(<MyListings />);
    await screen.findByText("Live boat");
    expect(screen.getByRole("tab", { name: "All (2)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Drafts (1)" }));
    expect(screen.queryByText("Live boat")).toBeNull();
    expect(screen.getByText("Draft boat")).toBeTruthy();
  });

  it("deletes a listing after confirmation and removes it from the list", async () => {
    api.fetchMyListings.mockResolvedValue([{ ...base, id: "a", title: "Draft boat", status: "DRAFT", slug: null }]);
    api.deleteListing.mockResolvedValue({});
    render(<MyListings />);
    await screen.findByText("Draft boat");

    fireEvent.click(screen.getByRole("button", { name: "Delete listing" }));
    expect(screen.getByRole("dialog", { name: "Delete this listing" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(api.deleteListing).toHaveBeenCalledWith("a", 1));
    await waitFor(() => expect(screen.queryByText("Draft boat")).toBeNull());
  });

  it("cancels the delete confirmation without calling the API", async () => {
    api.fetchMyListings.mockResolvedValue([{ ...base, id: "a", title: "Draft boat", status: "DRAFT", slug: null }]);
    render(<MyListings />);
    await screen.findByText("Draft boat");

    fireEvent.click(screen.getByRole("button", { name: "Delete listing" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.deleteListing).not.toHaveBeenCalled();
    expect(screen.getByText("Draft boat")).toBeTruthy();
  });
});
