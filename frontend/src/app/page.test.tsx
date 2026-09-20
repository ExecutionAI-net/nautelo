import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listings = vi.hoisted(() => ({
  fetchPublishedListings: vi.fn(),
  fetchListingFacets: vi.fn().mockResolvedValue({ brands: [], countries: [], regions: ["Balearic Islands"], boat_types: ["Motor yacht"] }),
}));
const ads = vi.hoisted(() => ({ fetchAds: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/api/listings", () => listings);
vi.mock("@/lib/api/contentServer", () => ads);
vi.mock("@/components/listings/BoatCard", () => ({ default: () => <div>card</div> }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import Home from "@/app/page";

describe("Home", () => {
  it("links to the main journeys and renders latest boats", async () => {
    listings.fetchPublishedListings.mockResolvedValue({ results: [{ id: "1" }] });
    render(await Home());
    expect(screen.getByRole("link", { name: /View all boats/ }).getAttribute("href")).toBe("/boats/");
    expect(screen.getByText("card")).toBeTruthy();
  });

  it("sends the search selections to /boats/ under the filter names it reads", async () => {
    listings.fetchPublishedListings.mockResolvedValue({ results: [] });
    const { container } = render(await Home());
    const form = container.querySelector("form#search-standard") as HTMLFormElement;
    const names = Array.from(form.elements).map((el) => (el as HTMLInputElement).name).filter(Boolean);
    expect(names).toEqual(["boat_type", "region", "price_min", "price_max", "year_min", "year_max"]);
    expect(screen.getByRole("option", { name: "Balearic Islands" })).toBeTruthy();
  });

  it("points the ad at the sponsor's own page", async () => {
    listings.fetchPublishedListings.mockResolvedValue({ results: [] });
    ads.fetchAds.mockResolvedValueOnce([
      { id: "a", placement: "HOME", sponsor: "Acme", headline: "Insure", body: "", cta_label: "Request quote", cta_url: "/brokers/acme/", image_url: "" },
    ]);
    render(await Home());
    expect(screen.getByRole("link", { name: /Request quote/ }).getAttribute("href")).toBe("/brokers/acme/");
  });

  it("still renders when the catalogue is unavailable", async () => {
    listings.fetchPublishedListings.mockRejectedValue(new Error("down"));
    render(await Home());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Find the right boat. With the services you need.");
    expect(screen.queryByText("card")).toBeNull();
  });
});
