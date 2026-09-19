import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listings = vi.hoisted(() => ({ fetchPublishedListings: vi.fn() }));
vi.mock("@/lib/api/listings", () => listings);
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

  it("still renders when the catalogue is unavailable", async () => {
    listings.fetchPublishedListings.mockRejectedValue(new Error("down"));
    render(await Home());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Find the right boat. With the services you need.");
    expect(screen.queryByText("card")).toBeNull();
  });
});
