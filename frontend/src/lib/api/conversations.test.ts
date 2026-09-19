import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import {
  CONVERSATION_FILTERS,
  conversationListQuery,
  fetchBrokerDashboard,
  fetchConversation,
  fetchConversations,
  fetchThread,
  markConversationRead,
  messageErrorKey,
  postReply,
  resolveFilter,
  setConversationStatus,
} from "@/lib/api/conversations";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
});

describe("conversationListQuery", () => {
  it("covers exactly spec 28's five filters", () => {
    expect([...CONVERSATION_FILTERS]).toEqual([
      "ALL",
      "UNREAD",
      "LISTING",
      "PROFILE",
      "ARCHIVED",
    ]);
  });

  it("maps ALL onto status=ALL", () => {
    expect(conversationListQuery("ALL", {})).toBe("status=ALL");
  });

  it("maps UNREAD onto the default OPEN inbox plus unread=true", () => {
    expect(conversationListQuery("UNREAD", {})).toBe("unread=true");
  });

  it("maps LISTING onto one conversation type", () => {
    expect(conversationListQuery("LISTING", {})).toBe("type=LISTING_INQUIRY");
  });

  it("maps PROFILE onto two REPEATED type parameters", () => {
    // Spec 28's "Profile inquiries" is two conversation types, so the parameter
    // repeats — Phase 6 contract rule 7. A comma-joined value would filter to
    // nothing, because the server matches each value exactly.
    expect(conversationListQuery("PROFILE", {})).toBe(
      "type=BROKER_INQUIRY&type=PROFESSIONAL_INQUIRY",
    );
  });

  it("maps ARCHIVED onto status=ARCHIVED", () => {
    expect(conversationListQuery("ARCHIVED", {})).toBe("status=ARCHIVED");
  });

  it("adds the broker scope when one is given", () => {
    expect(conversationListQuery("ALL", { brokerId: "b-1" })).toBe(
      "status=ALL&broker=b-1",
    );
  });

  it("omits page=1 so the first page has exactly one URL", () => {
    expect(conversationListQuery("ALL", { page: 1 })).toBe("status=ALL");
    expect(conversationListQuery("ALL", { page: 2 })).toBe("status=ALL&page=2");
  });
});

describe("fetchConversations", () => {
  it("calls the inbox endpoint with the built query", async () => {
    await fetchConversations("PROFILE", { brokerId: "b-1" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/conversations/?type=BROKER_INQUIRY&type=PROFESSIONAL_INQUIRY&broker=b-1",
    );
  });
});

describe("resolveFilter", () => {
  it("accepts a known filter, case-insensitively", () => {
    expect(resolveFilter("ARCHIVED")).toBe("ARCHIVED");
    expect(resolveFilter("unread")).toBe("UNREAD");
  });

  it("falls back to ALL for anything else", () => {
    expect(resolveFilter(undefined)).toBe("ALL");
    expect(resolveFilter("")).toBe("ALL");
    expect(resolveFilter("NONSENSE")).toBe("ALL");
  });
});

describe("fetchConversation", () => {
  it("calls the detail endpoint rather than scanning the inbox", async () => {
    // Ruling 14: ConversationPagination.page_size is 20, so finding a row by
    // paging the inbox is silently wrong for anyone with 21 conversations.
    apiFetch.mockResolvedValue({ id: "c-1" });
    await fetchConversation("c-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/conversations/c-1/");
  });
});

describe("fetchThread", () => {
  it("calls the thread endpoint", async () => {
    await fetchThread("c-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/conversations/c-1/messages/");
  });

  it("passes a page through", async () => {
    await fetchThread("c-1", 3);
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/conversations/c-1/messages/?page=3",
    );
  });
});

describe("postReply", () => {
  it("POSTs the body under the server's field name", async () => {
    apiFetch.mockResolvedValue({ id: "m-1" });
    await postReply("c-1", "Thank you, next Tuesday morning works for us.");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/conversations/c-1/messages/", {
      method: "POST",
      body: JSON.stringify({
        message: "Thank you, next Tuesday morning works for us.",
      }),
    });
  });
});

describe("markConversationRead", () => {
  it("POSTs an empty body to the read endpoint", async () => {
    apiFetch.mockResolvedValue({ marked_read: 2 });
    await markConversationRead("c-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/conversations/c-1/read/", {
      method: "POST",
      body: "{}",
    });
  });
});

describe("setConversationStatus", () => {
  it("PATCHes the status endpoint", async () => {
    apiFetch.mockResolvedValue({ id: "c-1", status: "ARCHIVED" });
    await setConversationStatus("c-1", "ARCHIVED");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/conversations/c-1/status/", {
      method: "PATCH",
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
  });
});

describe("fetchBrokerDashboard", () => {
  it("calls the broker dashboard endpoint", async () => {
    apiFetch.mockResolvedValue({ published_listings: 0 });
    await fetchBrokerDashboard("b-1");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/brokers/b-1/dashboard/");
  });
});

describe("messageErrorKey", () => {
  it("maps a known ApiError code onto its dictionary key", () => {
    expect(messageErrorKey(new ApiError(403, "feature_disabled", "x"))).toBe(
      "messages.error.feature_disabled",
    );
  });

  it("maps an unknown ApiError code onto the generic key", () => {
    expect(messageErrorKey(new ApiError(500, "teapot", "x"))).toBe(
      "messages.error.unexpected_error",
    );
  });

  it("maps a 404 onto not_found even though DRF sends code not_found", () => {
    expect(messageErrorKey(new ApiError(404, "not_found", "x"))).toBe(
      "messages.error.not_found",
    );
  });

  it("maps a non-ApiError throwable onto the generic key", () => {
    expect(messageErrorKey(new Error("network"))).toBe(
      "messages.error.unexpected_error",
    );
  });

  it("maps the two codes this phase's own endpoints introduce", () => {
    expect(
      messageErrorKey(new ApiError(403, "conversation_filing_forbidden", "x")),
    ).toBe("messages.error.conversation_filing_forbidden");
    expect(messageErrorKey(new ApiError(403, "not_broker_member", "x"))).toBe(
      "messages.error.not_broker_member",
    );
  });
});
