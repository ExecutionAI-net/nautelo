import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

const request = (path: string, cookie?: string, method = "GET") =>
  new NextRequest(`http://site.test${path}`, { method, headers: cookie ? { cookie: `nauta_locale=${cookie}` } : {} });

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

  it("serves the root in English, whatever the browser asks for", () => {
    const response = proxy(request("/boats/"));
    expect(response.headers.get("x-middleware-request-x-nauta-locale")).toBe("en");
    expect(response.status).toBe(200);
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
});
