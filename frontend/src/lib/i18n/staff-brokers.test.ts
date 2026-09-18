import { describe, expect, it } from "vitest";

import { LISTING_STATUS_ORDER } from "@/lib/api/staffBrokers";
import { SUPPORTED_LOCALES } from "@/lib/i18n/directory";
import { STAFF_BROKER_MESSAGES, tStaffBroker } from "@/lib/i18n/staff-brokers";

/** backend/brokers/enums.py BrokerOrganizationStatus. */
const ACCOUNT_STATUSES = ["DRAFT", "PENDING", "ACTIVE", "SUSPENDED"];

describe("staff broker messages", () => {
  it("defines every key in all three supported languages", () => {
    for (const [key, translations] of Object.entries(STAFF_BROKER_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(translations[locale], `${key}.${locale}`).toBeTruthy();
        expect(translations[locale].trim(), `${key}.${locale}`).not.toBe("");
      }
    }
  });

  it("labels every broker account status", () => {
    for (const status of ACCOUNT_STATUSES) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(
          tStaffBroker(locale, `staff.broker.status.${status}`),
        ).toBeTruthy();
      }
    }
  });

  it("labels every listing status the counts panel renders", () => {
    for (const status of LISTING_STATUS_ORDER) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(
          tStaffBroker(locale, `staff.broker.listing_status.${status}`),
        ).toBeTruthy();
      }
    }
  });

  it("has a distinct, translated message for every failure the screen maps", () => {
    const keys = [
      "staff.broker.load_failed",
      "staff.broker.error.unauthenticated",
      "staff.broker.error.forbidden",
      "staff.broker.error.not_found",
      "staff.broker.error.rate_limited",
      "staff.broker.error.server",
    ];
    for (const locale of SUPPORTED_LOCALES) {
      const rendered = keys.map((key) => tStaffBroker(locale, key));
      expect(new Set(rendered).size, locale).toBe(keys.length);
    }
  });

  it("refuses an unknown key rather than rendering it raw", () => {
    expect(() => tStaffBroker("en", "staff.broker.nope")).toThrow(
      /Unknown staff broker message key/,
    );
  });

  it("translates, and falls back to English for an unfilled locale", () => {
    expect(tStaffBroker("it", "staff.broker.account_status")).toBe(
      "Stato dell'account",
    );
    expect(tStaffBroker("es", "staff.broker.account_status")).toBe(
      "Estado de la cuenta",
    );
    expect(tStaffBroker("en", "staff.broker.account_status")).toBe(
      "Account status",
    );
  });
});
