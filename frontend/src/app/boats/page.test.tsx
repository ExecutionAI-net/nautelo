import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BoatsPage from "@/app/boats/page";
import type { PublicListing } from "@/lib/api/listings";

const fetchPublishedListings = vi.fn();

vi.mock("@/i18n/server", async () => {
  const { makeTranslate } = await import("@/i18n");
  return { getT: async () => makeTranslate({}) };
});
vi.mock("@/components/content/AdSlot", () => ({ default: () => null }));
vi.mock("@/lib/api/listings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/listings")>(
    "@/lib/api/listings",
  );
  return {
    ...actual,
    fetchPublishedListings: (...args: unknown[]) => fetchPublishedListings(...args),
  };
});

vi.mock("@/components/listings/FinanceDetailsDisclosure", () => ({
  default: () => <div />,
}));

function listing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: "3f1d2c4e-0000-4000-8000-000000000001",
    slug: "2021-beneteau-oceanis-3f1d2c4e",
    broker: null,
    seller_type: "BROKER",
    snapshot_version: 1,
    published_at: "2026-09-18T08:00:00Z",
    expires_at: null,
    brand_name: "Beneteau",
    model_name: "Oceanis 46.1",
    custom_model_name: "",
    manufacture_year: 2021,
    title: { en: "Oceanis 46.1", it: "", es: "" },
    description: { en: "", it: "", es: "" },
    specifications: {},
    specifications_schema_version: 1,
    location: { country: "ES", region: "Illes Balears", city: "Palma" },
    price: { amount: "459000.00", currency: "EUR" },
    media: [],
    view_count: 149,
    finance: {
      visible: true,
      monthly_payment: "8456.36",
      annual_rate_percent: "5.0000",
      term_months: 48,
      down_payment_percent: "20.0000",
      configuration_version: 1,
    },
    ...overrides,
  };
}

function page(results: PublicListing[], extra: Record<string, unknown> = {}) {
  fetchPublishedListings.mockResolvedValue({
    count: results.length,
    next: null,
    previous: null,
    results,
    ...extra,
  });
  return BoatsPage({ searchParams: Promise.resolve({}) });
}

beforeEach(() => {
  fetchPublishedListings.mockReset();
});

describe("/boats/", () => {
  it("forwards the active filters to the API and shows them as chips", async () => {
    fetchPublishedListings.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    render(
      await BoatsPage({
        searchParams: Promise.resolve({ brand: "Lagoon", price_max: "500000", sort: "price_asc", junk: "x" }),
      }),
    );

    expect(fetchPublishedListings).toHaveBeenCalledWith({
      brand: "Lagoon",
      price_max: "500000",
      sort: "price_asc",
      page: undefined,
    });
    expect(screen.getByText("Up to €500000")).toBeInTheDocument();
    expect(screen.getByText("No boats match these filters.")).toBeInTheDocument();
  });

  it("renders one card per published listing", async () => {
    render(await page([listing()]));

    expect(
      screen.getByRole("heading", { name: "2021 Beneteau Oceanis 46.1" }),
    ).toBeInTheDocument();
  });

  it("resolves the disclaimer asterisk inside the list region", async () => {
    const { container } = render(await page([listing()]));

    expect(screen.getByRole("link", { name: "See the financing disclaimer" })).toHaveAttribute(
      "href",
      "#finance-disclaimer",
    );
    expect(container.querySelector("#finance-disclaimer")).toHaveTextContent(
      /Illustrative estimate only/,
    );
  });

  it("shows a true empty message rather than placeholder cards", async () => {
    render(await page([]));

    expect(screen.getByText("No boats are published yet.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("renders no disclaimer when no card on the page shows finance", async () => {
    const { container } = render(await page([listing({ finance: { visible: false } })]));

    expect(container.querySelector("#finance-disclaimer")).toBeNull();
  });

  it("renders no footnote when the only finance block sits on an unsupported currency", async () => {
    const { container } = render(
      await page([listing({ price: { amount: "459000.00", currency: "USD" } })]),
    );

    expect(container.querySelector("#finance-disclaimer")).toBeNull();
  });

  it("submits the sort control on change instead of waiting for the filters form", async () => {
    fetchPublishedListings.mockResolvedValue({ count: 1, next: null, previous: null, results: [listing()] });
    render(
      await BoatsPage({
        searchParams: Promise.resolve({ brand: "Lagoon", sort: "price_asc" }),
      }),
    );

    const select = screen.getByLabelText("Sort by") as HTMLSelectElement;
    const form = select.closest("form") as HTMLFormElement;
    // Its own form, separate from the sidebar's "Apply filters" form, and carrying the
    // other active filters as hidden fields so changing sort doesn't drop them.
    expect(form.querySelector('input[name="brand"]')).toHaveValue("Lagoon");
    expect(form.querySelector('button[type="submit"]')).toBeNull();

    const requestSubmit = vi.fn();
    form.requestSubmit = requestSubmit;
    fireEvent.change(select, { target: { value: "price_desc" } });

    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });

  it("links to the next page when the API says there is one", async () => {
    render(
      await page([listing()], { next: "http://api/api/v1/listings/?page=2", count: 40 }),
    );

    // next/link applies next.config's trailingSlash at runtime, not under jsdom.
    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toMatch(
      /^\/boats\/?\?page=2$/,
    );
  });
});
