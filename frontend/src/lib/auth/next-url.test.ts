import { describe, expect, it } from "vitest";

import { isSafeNextUrl, safeNextUrl } from "@/lib/auth/next-url";

describe("isSafeNextUrl", () => {
  it("accepts local absolute paths", () => {
    expect(isSafeNextUrl("/dashboard/broker/")).toBe(true);
    expect(isSafeNextUrl("/boats/?brand=azimut#specs")).toBe(true);
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(isSafeNextUrl("https://evil.example/steal")).toBe(false);
    expect(isSafeNextUrl("//evil.example/steal")).toBe(false);
    expect(isSafeNextUrl("http:/evil.example")).toBe(false);
  });

  it("rejects backslash and control-character smuggling", () => {
    expect(isSafeNextUrl("/\\evil.example")).toBe(false);
    expect(isSafeNextUrl("\t//evil.example")).toBe(false);
    expect(isSafeNextUrl("\n/ok")).toBe(false);
    expect(isSafeNextUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects empty and missing values", () => {
    expect(isSafeNextUrl("")).toBe(false);
    expect(isSafeNextUrl(null)).toBe(false);
    expect(isSafeNextUrl(undefined)).toBe(false);
    expect(isSafeNextUrl("dashboard")).toBe(false);
  });
});

describe("safeNextUrl", () => {
  it("returns the value when safe and the fallback otherwise", () => {
    expect(safeNextUrl("/messages/")).toBe("/messages/");
    expect(safeNextUrl("https://evil.example")).toBe("/");
    expect(safeNextUrl(null, "/dashboard/private-seller/account/")).toBe("/dashboard/private-seller/account/");
  });
});
