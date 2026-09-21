import { describe, expect, it } from "vitest";

import { askingPrice } from "@/components/listings/money";
import { countryName, placeLabel } from "@/lib/i18n/places";

describe("placeLabel", () => {
  it("names the country and never repeats a city as its region", () => {
    expect(placeLabel({ city: "Trieste", region: "Friuli Venezia Giulia", country: "IT" })).toBe("Trieste, Friuli Venezia Giulia, Italy");
    expect(placeLabel({ city: "Valletta", region: "valletta", country: "MT" })).toBe("Valletta, Malta");
    expect(placeLabel({ city: "Ibiza", region: "", country: "" })).toBe("Ibiza");
  });

  it("falls back to the code when the country is unknown", () => {
    expect(countryName("ZZ")).toBeTruthy();
  });
});

describe("askingPrice", () => {
  it("drops the cents of a whole amount and keeps real ones", () => {
    expect(askingPrice("en", "13500.00", "EUR")).toBe("€13,500");
    expect(askingPrice("en", "125500.50", "EUR")).toBe("€125,500.50");
    expect(askingPrice("en", "abc", "EUR")).toBeNull();
  });
});
