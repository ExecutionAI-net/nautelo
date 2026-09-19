import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("next.config", () => {
  it("makes the trailing-slash form canonical, as every spec 4.1 route does", () => {
    expect(nextConfig.trailingSlash).toBe(true);
  });

  it("sends baseline security headers on every route", async () => {
    const rules = await nextConfig.headers!();
    const keys = rules[0].headers.map((h) => h.key);
    expect(rules[0].source).toBe("/:path*");
    expect(keys).toEqual(
      expect.arrayContaining([
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });

  it("301-redirects both retired directory URLs and the retired broker services URL", async () => {
    const redirects = await nextConfig.redirects!();

    expect(redirects).toHaveLength(3);
    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/services/",
          destination: "/services/professionals/",
          statusCode: 301,
        }),
        expect.objectContaining({
          source: "/professionals/",
          destination: "/services/professionals/",
          statusCode: 301,
        }),
        expect.objectContaining({
          source: "/dashboard/broker/services/",
          destination: "/dashboard/broker/messages/",
          statusCode: 301,
        }),
      ]),
    );
  });

  it("redirects the retired broker route to a page that exists", async () => {
    const redirects = await nextConfig.redirects!();
    const legacy = redirects.find(
      (redirect) => redirect.source === "/dashboard/broker/services/",
    );
    expect(legacy?.destination).toBe("/dashboard/broker/messages/");
  });

  it("never emits 308 by using permanent instead of an explicit 301", async () => {
    const redirects = await nextConfig.redirects!();

    for (const redirect of redirects) {
      expect(redirect).not.toHaveProperty("permanent");
      expect((redirect as { statusCode?: number }).statusCode).toBe(301);
    }
  });

  it("never redirects to a destination that is itself a redirect source", async () => {
    const redirects = await nextConfig.redirects!();
    const sources = new Set(redirects.map((redirect) => redirect.source));

    for (const redirect of redirects) {
      expect(sources.has(redirect.destination)).toBe(false);
    }
  });
});
