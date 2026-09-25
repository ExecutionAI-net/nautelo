import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listings = vi.hoisted(() => ({
  fetchPublishedListings: vi.fn(),
  fetchListingFacets: vi.fn().mockResolvedValue({ brands: [], countries: ["ES", "IT"], regions: ["Balearic Islands"], locations: [{ country: "ES", region: "Balearic Islands", place_id: 6, city: "Palma", count: 3 }, { country: "IT", region: "Liguria", place_id: 7, city: "Genoa", count: 2 }], boat_types: ["Motor yacht"] }),
}));
const ads = vi.hoisted(() => ({ fetchAds: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/api/listings", () => listings);
vi.mock("@/lib/api/contentServer", () => ads);
vi.mock("@/i18n/server", async () => {
  const { makeTranslate } = await import("@/i18n");
  return { getT: async () => makeTranslate({}) };
});
vi.mock("@/lib/i18n/useLocale", () => ({ useLocale: () => "en" }));
vi.mock("@/lib/api/client", () => ({ apiFetch: () => new Promise(() => {}) }));
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
    expect(names).toEqual(["boat_type", "country", "place", "price_min", "price_max", "length_min", "length_max"]);
    const country = screen.getByLabelText("Country") as HTMLInputElement;
    const city = screen.getByLabelText("City") as HTMLInputElement;
    const countryCode = form.elements.namedItem("country") as HTMLInputElement;
    const place = form.elements.namedItem("place") as HTMLInputElement;
    expect(city.disabled).toBe(true);
    fireEvent.focus(country);
    expect(screen.getByText("Spain (3)")).toBeTruthy();
    expect(screen.getByText("Italy (2)")).toBeTruthy();
    fireEvent.click(screen.getByText("Spain (3)"));
    expect(countryCode.value).toBe("ES");
    expect(country.value).toBe("Spain");
    expect(city.disabled).toBe(false);
    fireEvent.focus(city);
    expect(screen.getByText("Palma (3)")).toBeTruthy();
    fireEvent.click(screen.getByText("Palma (3)"));
    expect(place.value).toBe("6");
    expect(city.value).toBe("Palma");
    fireEvent.change(country, { target: { value: "" } });
    expect(screen.getByText("Italy (2)")).toBeTruthy();
    fireEvent.click(screen.getByText("Italy (2)"));
    expect(countryCode.value).toBe("IT");
    expect(place.value).toBe("");
    expect(city.value).toBe("");
    fireEvent.focus(city);
    expect(screen.getByText("Genoa (2)")).toBeTruthy();
  });

  it("offers a semantic tab that sends the description as mode=semantic", async () => {
    listings.fetchPublishedListings.mockResolvedValue({ results: [] });
    const { container } = render(await Home());
    fireEvent.click(screen.getByRole("tab", { name: "Describe your boat" }));
    const form = container.querySelector("form#search-semantic") as HTMLFormElement;
    expect(form.getAttribute("action")).toBe("/boats/");
    expect(Array.from(form.elements).map((el) => (el as HTMLInputElement).name).filter(Boolean)).toEqual(["mode", "query"]);
  });

  it("points the ad at the sponsor's own page", async () => {
    listings.fetchPublishedListings.mockResolvedValue({ results: [] });
    ads.fetchAds.mockResolvedValueOnce([
      { id: "a", placement: "HOME", sponsor: "Acme", headline: "Insure", body: "", cta_label: "Request quote", cta_url: "/brokers/acme/", image_url: "" },
    ]);
    render(await Home());
    expect(screen.getByRole("link", { name: /Request quote/ }).getAttribute("href")).toBe("/brokers/acme/");
  });

  it("feeds the lower banner from the second HOME ad, not from fixed copy", async () => {
    listings.fetchPublishedListings.mockResolvedValue({ results: [] });
    const make = (id: string, sponsor: string, url: string) => ({ id, placement: "HOME", sponsor, headline: `${sponsor} headline`, body: "", cta_label: `Go ${sponsor}`, cta_url: url, image_url: "" });
    ads.fetchAds.mockResolvedValueOnce([make("1", "First", "/brokers/a/"), make("2", "Second", "/services/professionals/b/")]);
    render(await Home());
    expect(screen.getByRole("link", { name: /Go Second/ }).getAttribute("href")).toBe("/services/professionals/b/");
    expect(screen.queryByText(/Costa Smeralda Marina Authority/)).toBeNull();
  });

  it("still renders when the catalogue is unavailable", async () => {
    listings.fetchPublishedListings.mockRejectedValue(new Error("down"));
    render(await Home());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Find the right boat. With the services you need.");
    expect(screen.queryByText("card")).toBeNull();
  });
});
