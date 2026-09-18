import { afterEach, describe, expect, it, vi } from "vitest";

import {
  directoryFetch,
  fetchProfessionals,
  fetchServiceCategories,
  formatProfessionalLocation,
} from "./directory";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

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
