import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/directory", () => ({
  fetchProfessionals: vi.fn().mockResolvedValue(null),
  fetchServiceCategories: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/api/listings", () => ({
  fetchPublishedListings: vi.fn().mockResolvedValue({
    results: [{ slug: "a-1" }, { slug: null }],
    next: null,
    previous: null,
  }),
  listingPath: (l: { slug: string | null }) => (l.slug ? `/boats/${l.slug}/` : null),
}));

vi.mock("@/lib/api/brokers", () => ({
  fetchBrokers: vi.fn().mockResolvedValue({ results: [{ url: "/brokers/acme/" }], next: null }),
}));

import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("lists /boats/ and slugged listings only, even with the directory flag off", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/boats/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/boats/a-1/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/brokers/acme/"))).toBe(true);
    for (const page of ["financing", "guides", "pricing", "sell", "contact", "privacy", "terms", "cookies"]) {
      expect(urls.some((u) => u.endsWith(`/${page}/`))).toBe(true);
    }
    // 4 dynamic entries + 8 static public pages, in three languages; no service directory URLs.
    expect(urls).toHaveLength(36);
    expect(urls).toContain("http://127.0.0.1:3020/it/boats/");
    expect(urls).toContain("http://127.0.0.1:3020/es/boats/a-1/");
    expect(urls.some((u) => u.includes("/services/"))).toBe(false);
    const entry = (await sitemap()).find((e) => e.url.endsWith("/it/boats/"));
    expect(entry?.alternates?.languages).toMatchObject({
      en: "http://127.0.0.1:3020/boats/",
      it: "http://127.0.0.1:3020/it/boats/",
      es: "http://127.0.0.1:3020/es/boats/",
      "x-default": "http://127.0.0.1:3020/boats/",
    });
  });
});
