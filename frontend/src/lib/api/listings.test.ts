import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import {
  fetchFinanceDefaults,
  fetchPublishedListing,
  fetchPublishedListings,
  financingHref,
  listingQuery,
  requestFinanceQuote,
  type PublicListing,
} from "@/lib/api/listings";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { forwardedClientIpMock } = vi.hoisted(() => ({
  forwardedClientIpMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/internal-headers", () => ({
  forwardedClientIp: () => forwardedClientIpMock(),
}));

afterEach(() => {
  fetchMock.mockReset();
  forwardedClientIpMock.mockReset().mockResolvedValue(undefined);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function listing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: "3f1d2c4e-0000-4000-8000-000000000001",
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
    finance: { visible: false },
    ...overrides,
  };
}

const page = (results: PublicListing[] = []) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

const defaults = {
  version: 3,
  annual_rate_percent: "6.50",
  term_months: 120,
  down_payment_percent: "20.00",
};

describe("financingHref", () => {
  it("builds the exact spec 18.3 target", () => {
    expect(financingHref(listing())).toBe(
      "/financing/?listing=3f1d2c4e-0000-4000-8000-000000000001&price=459000.00&currency=EUR",
    );
  });

  it("uses the server-formatted price verbatim", () => {
    expect(financingHref(listing({ price: { amount: "1250.50", currency: "EUR" } }))).toContain(
      "price=1250.50",
    );
  });
});

describe("listingQuery", () => {
  it("omits empty values so a bare page has a clean URL", () => {
    expect(listingQuery({ page: undefined, page_size: "" })).toBe("");
  });

  it("serializes the values it is given", () => {
    expect(listingQuery({ page: "2" })).toBe("?page=2");
  });
});

describe("server-side fetches delegate to directoryFetch", () => {
  it.each([
    ["fetchPublishedListings", () => fetchPublishedListings({}), page()],
    ["fetchPublishedListing", () => fetchPublishedListing("abc"), listing()],
    ["fetchFinanceDefaults", () => fetchFinanceDefaults(), { finance_configuration: defaults }],
  ])("%s sends the internal secret header and forwards the client IP", async (_n, call, body) => {
    forwardedClientIpMock.mockResolvedValue("198.51.100.42");
    fetchMock.mockResolvedValue(json(body));

    await call();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("X-Internal-Service-Secret")).not.toBeNull();
    expect(headers.get("X-Internal-Client-IP")).toBe("198.51.100.42");
    expect(init.cache).toBe("no-store");
  });

  it("omits the client IP header when none is available", async () => {
    fetchMock.mockResolvedValue(json(page()));
    await fetchPublishedListings({});
    const headers = new Headers(fetchMock.mock.calls[0][1].headers as HeadersInit);
    expect(headers.has("X-Internal-Client-IP")).toBe(false);
  });
});

describe("fetchPublishedListings", () => {
  it("requests the collection with a clean query", async () => {
    fetchMock.mockResolvedValue(json(page()));
    await fetchPublishedListings({ page: "2" });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/listings\/\?page=2$/);
  });

  it("returns the page on 200", async () => {
    const body = page([listing()]);
    fetchMock.mockResolvedValue(json(body));
    await expect(fetchPublishedListings({})).resolves.toEqual(body);
  });

  it("returns a real empty page, distinct from null", async () => {
    fetchMock.mockResolvedValue(json(page()));
    await expect(fetchPublishedListings({})).resolves.toEqual(page());
  });

  it("returns null on 404", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(fetchPublishedListings({})).resolves.toBeNull();
  });

  it.each([429, 500, 503])("throws on %i rather than reading it as absent", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    await expect(fetchPublishedListings({})).rejects.toThrow(String(status));
  });

  it("propagates a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchPublishedListings({})).rejects.toThrow("fetch failed");
  });

  it.each([{}, { results: "nope" }, []])("throws on a malformed payload %j", async (bad) => {
    fetchMock.mockResolvedValue(json(bad));
    await expect(fetchPublishedListings({})).rejects.toThrow(/malformed/i);
  });
});

describe("fetchPublishedListing", () => {
  it("requests the encoded detail path", async () => {
    fetchMock.mockResolvedValue(json(listing()));
    await fetchPublishedListing("a b");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/listings\/a%20b\/$/);
  });

  it("returns the listing on 200", async () => {
    fetchMock.mockResolvedValue(json(listing()));
    await expect(fetchPublishedListing("x")).resolves.toEqual(listing());
  });

  it("returns null on 404", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(fetchPublishedListing("x")).resolves.toBeNull();
  });

  it.each([429, 500])("throws on %i", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    await expect(fetchPublishedListing("x")).rejects.toThrow(String(status));
  });

  it("propagates a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchPublishedListing("x")).rejects.toThrow("fetch failed");
  });

  it.each([{}, { id: 5 }, []])("throws on a malformed payload %j", async (bad) => {
    fetchMock.mockResolvedValue(json(bad));
    await expect(fetchPublishedListing("x")).rejects.toThrow(/malformed/i);
  });
});

describe("fetchFinanceDefaults", () => {
  it("reads the finance_configuration key", async () => {
    fetchMock.mockResolvedValue(json({ finance_configuration: defaults }));
    await expect(fetchFinanceDefaults()).resolves.toEqual(defaults);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/platform\/public-settings\/$/);
  });

  it("returns null when no configuration is active", async () => {
    fetchMock.mockResolvedValue(json({ finance_configuration: null }));
    await expect(fetchFinanceDefaults()).resolves.toBeNull();
  });

  it.each([404, 429, 500])("returns null on %i", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    await expect(fetchFinanceDefaults()).resolves.toBeNull();
  });

  it("returns null on a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchFinanceDefaults()).resolves.toBeNull();
  });

  it.each([
    {},
    [],
    null,
    { finance_configuration: "x" },
    { finance_configuration: { version: 1 } },
    { finance_configuration: { ...defaults, term_months: "120" } },
  ])("returns null on a malformed payload %j", async (bad) => {
    fetchMock.mockResolvedValue(json(bad));
    await expect(fetchFinanceDefaults()).resolves.toBeNull();
  });
});

describe("requestFinanceQuote", () => {
  const quote = {
    currency: "EUR",
    price: "459000.00",
    down_payment_amount: "91800.00",
    principal: "367200.00",
    annual_rate_percent: "6.50",
    term_months: 120,
    monthly_payment: "4169.00",
    total_payment: "500280.00",
    total_interest: "133080.00",
    configuration_version: 3,
    disclaimer_key: "finance.estimate",
    assumption_sources: null,
  };

  it("POSTs the JSON body to the quotes endpoint and returns the quote", async () => {
    fetchMock.mockResolvedValue(json(quote));
    const input = { listing_id: "abc", term_months: 96 };

    await expect(requestFinanceQuote(input)).resolves.toEqual(quote);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/finance\/quotes\/$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it.each([
    [404, "listing_not_found"],
    [422, "finance_not_available_for_listing"],
    [429, "throttled"],
    [500, "server_error"],
  ])("throws ApiError carrying the code on %i", async (status, code) => {
    fetchMock.mockResolvedValue(json({ error: { code, message: "m" } }, status));
    const error = await requestFinanceQuote({ listing_id: "abc" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
  });

  it("propagates a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(requestFinanceQuote({ listing_id: "abc" })).rejects.toThrow("fetch failed");
  });
});
