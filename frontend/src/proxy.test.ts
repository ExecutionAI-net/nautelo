import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "@/proxy";

const request = (path: string, cookie?: string, method = "GET", acceptLanguage?: string) =>
  new NextRequest(`http://site.test${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie: `nauta_locale=${cookie}` } : {}),
      ...(acceptLanguage ? { "accept-language": acceptLanguage } : {}),
    },
  });

describe("proxy", () => {
  it("serves /it/... with the same pages, told which language it is in", () => {
    const response = proxy(request("/it/boats/?brand=Azimut"));
    expect(response.headers.get("x-middleware-rewrite")).toBe("http://site.test/boats/?brand=Azimut");
    expect(response.headers.get("x-middleware-request-x-nauta-locale")).toBe("it");
    expect(response.headers.get("x-middleware-request-x-nauta-path")).toBe("/boats/");
    expect(response.cookies.get("nauta_locale")?.value).toBe("it");
  });

  it("treats the bare prefix as the language's home page", () => {
    const response = proxy(request("/es/"));
    expect(response.headers.get("x-middleware-rewrite")).toBe("http://site.test/");
  });

  it("serves the root in English when the browser has no language preference we recognize", () => {
    const response = proxy(request("/boats/", undefined, "GET", "de-DE,de;q=0.9"));
    expect(response.headers.get("x-middleware-request-x-nauta-locale")).toBe("en");
    expect(response.status).toBe(200);
  });

  it("matches a first-time visitor's browser language when there is no saved cookie", () => {
    const response = proxy(request("/boats/", undefined, "GET", "it-IT,it;q=0.9,en;q=0.8"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://site.test/it/boats/");
    expect(response.cookies.get("nauta_locale")?.value).toBe("it");
  });

  it("prefers the saved cookie over the browser's language once one is set", () => {
    const response = proxy(request("/boats/", "en", "GET", "it-IT,it;q=0.9"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-nauta-locale")).toBe("en");
  });

  it("sends a visitor who chose Italian to the Italian address, keeping the query", () => {
    const response = proxy(request("/boats/?brand=Azimut", "it"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://site.test/it/boats/?brand=Azimut");
    expect(response.headers.get("vary")).toContain("Cookie");
  });

  it("does not redirect a visitor who chose English, or anything that is not a page load", () => {
    expect(proxy(request("/boats/", "en")).status).toBe(200);
    expect(proxy(request("/boats/", "it", "POST")).status).toBe(200);
  });

  it("matcher covers pages (also prefixed ones) and skips the API, Next files and files with an extension", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    for (const path of ["/", "/it/", "/es/boats/", "/boats/a-1/"]) expect(re.test(path)).toBe(true);
    for (const path of ["/api/v1/x", "/_next/static/a.js", "/sitemap.xml", "/logo.png"]) expect(re.test(path)).toBe(false);
  });
});
