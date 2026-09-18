import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardedClientIp } from "./internal-headers";

// vi.mock's factory is hoisted above every top-level statement, including
// plain `const` declarations - vi.hoisted() is the sanctioned way to define
// a value the factory can still close over.
const { headersMock } = vi.hoisted(() => ({ headersMock: vi.fn() }));
vi.mock("next/headers", () => ({ headers: headersMock }));

afterEach(() => headersMock.mockReset());

describe("forwardedClientIp", () => {
  it("returns the first entry of x-forwarded-for", async () => {
    headersMock.mockResolvedValue(
      new Headers({ "x-forwarded-for": "198.51.100.42, 10.0.0.5" }),
    );

    await expect(forwardedClientIp()).resolves.toBe("198.51.100.42");
  });

  it("returns undefined when there is no x-forwarded-for header", async () => {
    headersMock.mockResolvedValue(new Headers());

    await expect(forwardedClientIp()).resolves.toBeUndefined();
  });

  it("returns undefined instead of throwing when headers() is unavailable", async () => {
    headersMock.mockRejectedValue(new Error("outside request scope"));

    await expect(forwardedClientIp()).resolves.toBeUndefined();
  });
});
