import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearDraftToken,
  readDraftToken,
  storeDraftToken,
} from "@/lib/inquiry/draft-storage";

const contextA = { type: "PROFESSIONAL" as const, id: "aaa", label: "Pro A" };
const contextB = { type: "PROFESSIONAL" as const, id: "bbb", label: "Pro B" };

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("draft-storage", () => {
  it("round-trips a token for one context", () => {
    storeDraftToken(contextA, "token-a");
    expect(readDraftToken(contextA)).toBe("token-a");
  });

  it("keys by context, so another provider's page never restores this draft", () => {
    storeDraftToken(contextA, "token-a");
    expect(readDraftToken(contextB)).toBeNull();
  });

  it("clears a token", () => {
    storeDraftToken(contextA, "token-a");
    clearDraftToken(contextA);
    expect(readDraftToken(contextA)).toBeNull();
  });

  it("never throws when storage is unavailable (private mode, blocked cookies)", () => {
    const boom = () => {
      throw new Error("SecurityError");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);

    expect(() => storeDraftToken(contextA, "token-a")).not.toThrow();
    expect(readDraftToken(contextA)).toBeNull();
    expect(() => clearDraftToken(contextA)).not.toThrow();

    vi.restoreAllMocks();
  });
});
