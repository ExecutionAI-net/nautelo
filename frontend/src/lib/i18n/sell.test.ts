import { describe, expect, it } from "vitest";

import { tSell } from "@/lib/i18n/sell";

describe("tSell", () => {
  it("translates and interpolates", () => {
    expect(tSell("it", "sell.media_limits", { images: 25, videos: 1 })).toBe(
      "Fino a 25 immagini e 1 video.",
    );
  });
  it("throws on unknown keys", () => {
    expect(() => tSell("en", "sell.nope")).toThrow();
  });
});
