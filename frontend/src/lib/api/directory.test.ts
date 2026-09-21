import { afterEach, describe, expect, it, vi } from "vitest";

import {
  directoryFetch,
  DIRECTORY_API_BASE_URL,
  fetchProfessionals,
  fetchServiceCategories,
  formatProfessionalLocation,
} from "./directory";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// vi.mock's factory is hoisted above every top-level statement, including
// plain `const` declarations - vi.hoisted() is the sanctioned way to define
// a value the factory can still close over.
const { forwardedClientIpMock } = vi.hoisted(() => ({
  forwardedClientIpMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./internal-headers", () => ({
  forwardedClientIp: () => forwardedClientIpMock(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  fetchMock.mockReset();
  forwardedClientIpMock.mockReset().mockResolvedValue(undefined);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Contract rule 11: a 404 from a directory *collection* endpoint means the
// combined_services_professionals flag is off, and the calling page must
// notFound(). These two collection helpers are the only place that distinction
// is made, and every later phase's compliance with rule 11 rests on them
// returning null rather than an empty collection — "feature off" and "no
// results" must never collapse into the same value.
describe("Contract rule 11 — null means the rollout flag is off", () => {
  it("fetchServiceCategories returns null on 404, not an empty array", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const categories = await fetchServiceCategories("en");

    expect(categories).toBeNull();
    expect(categories).not.toEqual([]);
  });

  it("fetchProfessionals returns null on 404, not an empty page", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const results = await fetchProfessionals({}, "en");

    expect(results).toBeNull();
  });

  it("fetchServiceCategories returns a real empty array when the API says so", async () => {
    // The other half of the contract: an empty directory is not a 404, and the
    // page must render the spec 31 empty state rather than notFound().
    fetchMock.mockResolvedValue(json([]));

    await expect(fetchServiceCategories("en")).resolves.toEqual([]);
  });

  it("fetchProfessionals returns a real empty result page when the API says so", async () => {
    fetchMock.mockResolvedValue(json({ count: 0, next: null, previous: null, results: [] }));

    await expect(fetchProfessionals({ q: "nobody" }, "en")).resolves.toEqual({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
  });
});

describe("directoryFetch error handling", () => {
  it("throws on a non-404, non-2xx response", async () => {
    // A 500 is a broken backend, not "the feature is off". Swallowing it as
    // null would make every directory page 404 during an outage and hide the
    // real failure from logs and error reporting.
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(directoryFetch("/api/v1/service-categories/")).rejects.toThrow(
      "/api/v1/service-categories/ failed: 500",
    );
  });

  it("throws on a 403 as well, so a mis-gated endpoint is never read as flag-off", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    await expect(directoryFetch("/api/v1/professionals/")).rejects.toThrow();
  });

  it("returns the parsed body on success", async () => {
    fetchMock.mockResolvedValue(json({ slug: "legal" }));

    await expect(directoryFetch("/api/v1/service-categories/legal/")).resolves.toEqual({
      slug: "legal",
    });
  });
});

describe("directoryFetch internal headers", () => {
  it("always sends the internal service secret header", async () => {
    fetchMock.mockResolvedValue(json({}));

    await directoryFetch("/api/v1/service-categories/");

    const [, init] = fetchMock.mock.calls[0];
    const sentHeaders = new Headers(init.headers as HeadersInit);
    expect(sentHeaders.get("X-Internal-Service-Secret")).not.toBeNull();
  });

  it("omits the client IP header when none is available", async () => {
    forwardedClientIpMock.mockResolvedValue(undefined);
    fetchMock.mockResolvedValue(json({}));

    await directoryFetch("/api/v1/service-categories/");

    const [, init] = fetchMock.mock.calls[0];
    const sentHeaders = new Headers(init.headers as HeadersInit);
    expect(sentHeaders.has("X-Internal-Client-IP")).toBe(false);
  });

  it("forwards the client IP header when one is available", async () => {
    forwardedClientIpMock.mockResolvedValue("198.51.100.42");
    fetchMock.mockResolvedValue(json({}));

    await directoryFetch("/api/v1/service-categories/");

    const [, init] = fetchMock.mock.calls[0];
    const sentHeaders = new Headers(init.headers as HeadersInit);
    expect(sentHeaders.get("X-Internal-Client-IP")).toBe("198.51.100.42");
  });
});

describe("formatProfessionalLocation", () => {
  it("joins city and region", () => {
    expect(formatProfessionalLocation({ city: "Genova", region: "Liguria" })).toBe(
      "Genova, Liguria",
    );
  });

  it("drops a blank half rather than leaving a dangling comma", () => {
    expect(formatProfessionalLocation({ city: "Genova", region: "" })).toBe("Genova");
    expect(formatProfessionalLocation({ city: "", region: "Liguria" })).toBe("Liguria");
    expect(formatProfessionalLocation({ city: "", region: "" })).toBe("");
  });
});


describe("deployment API routing", () => {
  it("uses Docker DNS while preserving the public host and protocol", async () => {
    vi.stubEnv("INTERNAL_API_BASE_URL", "http://api:8000");
    fetchMock.mockResolvedValue(json({ results: [] }));
    await directoryFetch("/api/v1/listings/");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api:8000/api/v1/listings/");
    expect(init.headers.Host).toBe(new URL(DIRECTORY_API_BASE_URL).host);
    expect(init.headers["X-Forwarded-Proto"]).toBe(new URL(DIRECTORY_API_BASE_URL).protocol.slice(0, -1));
    expect(init.redirect).toBe("error");
  });

  it("keeps local development working without an internal origin", async () => {
    vi.stubEnv("INTERNAL_API_BASE_URL", undefined);
    fetchMock.mockResolvedValue(json({}));
    await directoryFetch("/api/v1/listings/");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${DIRECTORY_API_BASE_URL}/api/v1/listings/`);
    expect(init.headers.Host).toBeUndefined();
  });

  it("reports an HTML success response as an API routing error", async () => {
    fetchMock.mockResolvedValue(new Response("<!DOCTYPE html><html></html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }));
    await expect(directoryFetch("/api/v1/listings/")).rejects.toThrow("expected JSON. Check API routing.");
  });
});
