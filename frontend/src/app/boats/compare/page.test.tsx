import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ComparePage from "@/app/boats/compare/page";
import type { PublicListing } from "@/lib/api/listings";

const fetchPublishedListing = vi.fn();

vi.mock("@/i18n/server", async () => {
  const { makeTranslate } = await import("@/i18n");
  return { getT: async () => makeTranslate({}) };
});
vi.mock("@/lib/i18n/requestLocale", () => ({ getRequestLocale: async () => "en" }));
vi.mock("@/lib/api/listings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/listings")>("@/lib/api/listings");
  return { ...actual, fetchPublishedListing: (...args: unknown[]) => fetchPublishedListing(...args) };
});

const A = "3f1d2c4e-0000-4000-8000-000000000001";
const B = "3f1d2c4e-0000-4000-8000-000000000002";

function listing(id: string, overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id,
    slug: `boat-${id.slice(-1)}`,
    broker: null,
    seller_type: "PRIVATE",
    snapshot_version: 1,
    published_at: "2026-09-18T08:00:00Z",
    expires_at: null,
    brand_name: "Beneteau",
    model_name: "Oceanis 46.1",
    custom_model_name: "",
    manufacture_year: 2021,
    title: { en: "", it: "", es: "" },
    description: { en: "", it: "", es: "" },
    specifications: { boat_type: "sailboat", cabins: 3 },
    specifications_schema_version: 1,
    location: { country: "IT", region: "Liguria", city: "Genoa" },
    price: { amount: "189000.00", currency: "EUR" },
    media: [],
    view_count: 0,
    finance: { visible: false },
    ...overrides,
  };
}

describe("ComparePage", () => {
  it("explains how to start when no ids are given", async () => {
    render(await ComparePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Nothing to compare yet")).toBeTruthy();
    expect(fetchPublishedListing).not.toHaveBeenCalled();
  });

  it("renders the requested listings side by side from the API and highlights differing rows", async () => {
    fetchPublishedListing.mockImplementation(async (id: string) =>
      id === A ? listing(A) : id === B ? listing(B, { manufacture_year: 2019, specifications: { boat_type: "sailboat", cabins: 4 } }) : null,
    );
    render(await ComparePage({ searchParams: Promise.resolve({ ids: `${A},${B},not-a-uuid` }) }));

    expect(screen.getByText("Comparing 2 boats")).toBeTruthy();
    expect(screen.getAllByText("Sailboat")).toHaveLength(2);
    const cabins = screen.getByText("Cabins").closest("tr");
    expect(cabins?.className).toContain("bg-surface-container-low");
    const type = screen.getByText("Boat type").closest("tr");
    expect(type?.className).not.toContain("bg-surface-container-low");
    expect(screen.getAllByText("View listing")[0].getAttribute("href")).toContain("/boats/boat-1");
    expect(fetchPublishedListing).toHaveBeenCalledTimes(2);
  });
});
