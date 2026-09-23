import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime } from "@/lib/i18n/datetime";

describe("formatDateTime", () => {
  it("prints day, month name, year and a 24-hour time without seconds", () => {
    const out = formatDateTime("en", "2026-09-23T19:30:25Z");
    expect(out).toMatch(/^\d{1,2} Sept? 2026, \d{2}:\d{2}$/);
    expect(out).not.toContain("PM");
  });

  it("prints only the date with formatDate and tolerates a bad stamp", () => {
    expect(formatDate("en", "2026-09-23T19:30:25Z")).toMatch(/^\d{1,2} Sept? 2026$/);
    expect(formatDateTime("en", "not-a-date")).toBe("");
  });
});
