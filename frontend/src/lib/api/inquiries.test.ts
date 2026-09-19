import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchInquiryConfig } from "@/lib/api/inquiries";

const directoryFetch = vi.fn();
vi.mock("@/lib/api/directory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/directory")>();
  return { ...actual, directoryFetch: (...args: unknown[]) => directoryFetch(...args) };
});

const CONFIG = {
  enabled: true,
  privacy_policy_version: "2026-09",
  honeypot_field: "company_website",
  limits: {
    full_name: { min: 2, max: 120 },
    subject: { min: 3, max: 150 },
    message: { min: 20, max: 4000 },
    phone_max: 32,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchInquiryConfig", () => {
  it("reads the config from the API", async () => {
    directoryFetch.mockResolvedValue(CONFIG);
    await expect(fetchInquiryConfig()).resolves.toEqual(CONFIG);
  });

  it("goes through directoryFetch, which is what forwards the visitor IP", async () => {
    // Not an implementation detail: directoryFetch attaches
    // X-Internal-Service-Secret and X-Internal-Client-IP (PR #103), without
    // which every server-rendered visitor shares one `messaging_read` throttle
    // bucket and a 429 makes the inquiry form disappear from the page. A plain
    // `fetch()` here would compile, pass a happy-path test, and reintroduce
    // exactly that - so the delegation is asserted, not assumed.
    directoryFetch.mockResolvedValue(CONFIG);
    await fetchInquiryConfig();
    expect(directoryFetch).toHaveBeenCalledWith("/api/v1/inquiries/config/");
  });

  it("returns null when the API is unreachable, so the page fails closed", async () => {
    directoryFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(fetchInquiryConfig()).resolves.toBeNull();
  });

  it("returns null on a non-2xx rather than throwing during SSR", async () => {
    directoryFetch.mockRejectedValue(new Error("Directory API failed: 503"));
    await expect(fetchInquiryConfig()).resolves.toBeNull();
  });

  it("returns null on a 404, which directoryFetch reports as null", async () => {
    directoryFetch.mockResolvedValue(null);
    await expect(fetchInquiryConfig()).resolves.toBeNull();
  });
});
