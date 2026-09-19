import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTACT_ACCESS_REFRESH_EVENT,
  contactAccessPath,
  fetchContactAccess,
  requestContactAccessRefresh,
  type ContactAccessRefreshDetail,
} from "@/lib/api/contacts";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch }));

beforeEach(() => {
  apiFetch.mockReset();
});

describe("contactAccessPath", () => {
  it("builds spec 30.1's path from the lowercase segment", () => {
    expect(contactAccessPath("professional", "abc-123")).toBe(
      "/api/v1/contacts/professional/abc-123/",
    );
    expect(contactAccessPath("broker", "abc-123")).toBe(
      "/api/v1/contacts/broker/abc-123/",
    );
  });
});

describe("fetchContactAccess", () => {
  it("unwraps the { contact } envelope", async () => {
    apiFetch.mockResolvedValue({
      contact: {
        state: "LOCKED",
        email_mask: "i••••@example.com",
        phone_mask: "+34 ••• ••• ••2",
        unlock_rule: "SEND_INQUIRY",
      },
    });

    const access = await fetchContactAccess("professional", "abc-123");

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/contacts/professional/abc-123/", {
      cache: "no-store",
    });
    expect(access.state).toBe("LOCKED");
  });

  it("never lets the browser cache a per-viewer answer", () => {
    // The server sends Cache-Control: private, no-store; this is the client
    // half of the same rule. A cached LOCKED replayed after login (or a cached
    // GRANTED replayed after logout) is a cross-viewer disclosure.
    apiFetch.mockResolvedValue({ contact: { state: "UNAVAILABLE" } });

    void fetchContactAccess("broker", "abc-123");

    expect(apiFetch.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it("propagates an ApiError rather than inventing a locked state", async () => {
    // A network failure must not be indistinguishable from "locked": the panel
    // shows an error, so a reader is never told a false reason for the lock.
    apiFetch.mockRejectedValue(new Error("boom"));

    await expect(fetchContactAccess("professional", "abc-123")).rejects.toThrow("boom");
  });
});

describe("requestContactAccessRefresh", () => {
  it("dispatches an event carrying the target it refers to", () => {
    const seen: ContactAccessRefreshDetail[] = [];
    const listener = (event: Event) => {
      seen.push((event as CustomEvent<ContactAccessRefreshDetail>).detail);
    };
    window.addEventListener(CONTACT_ACCESS_REFRESH_EVENT, listener);

    requestContactAccessRefresh("professional", "abc-123");

    window.removeEventListener(CONTACT_ACCESS_REFRESH_EVENT, listener);
    expect(seen).toEqual([{ targetType: "professional", targetId: "abc-123" }]);
  });
});
