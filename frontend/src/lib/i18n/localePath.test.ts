import { describe, expect, it } from "vitest";

import { localizePath, prefixFor, splitLocalePath } from "@/lib/i18n/localePath";

describe("localePath", () => {
  it("keeps English at the root and prefixes the other languages", () => {
    expect(prefixFor("en")).toBe("");
    expect(prefixFor("it")).toBe("/it");
    expect(localizePath("/boats/", "en")).toBe("/boats/");
    expect(localizePath("/boats/", "it")).toBe("/it/boats/");
    expect(localizePath("/", "es")).toBe("/es/");
  });

  it("never prefixes what is not a plain site path, or a path that already has a language", () => {
    for (const path of ["https://x.test/a", "//cdn.test/a", "#study", "?page=2", "/api/v1/x/", "/it/boats/", "mailto:a@b.c"]) {
      expect(localizePath(path, "es")).toBe(path);
    }
  });

  it("splits a prefixed address back into language and page", () => {
    expect(splitLocalePath("/it/boats/x/")).toEqual({ locale: "it", path: "/boats/x/" });
    expect(splitLocalePath("/es")).toEqual({ locale: "es", path: "/" });
    expect(splitLocalePath("/boats/")).toEqual({ locale: "en", path: "/boats/" });
    // Only whole segments count as a language: "/italy/" is a page, not Italian.
    expect(splitLocalePath("/italy/")).toEqual({ locale: "en", path: "/italy/" });
  });
});
