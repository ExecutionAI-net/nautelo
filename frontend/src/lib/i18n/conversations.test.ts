import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "@/lib/i18n/directory";
import {
  CONVERSATION_MESSAGES,
  formatConversationMessage,
  tConversations,
} from "@/lib/i18n/conversations";

describe("CONVERSATION_MESSAGES", () => {
  it("gives every key a non-empty EN, IT and ES translation", () => {
    // Spec 37: "All new UI text must have EN/IT/ES translation keys." A missing
    // locale silently falls back to English at runtime, so the dictionary is
    // where it has to be caught.
    const gaps: string[] = [];
    for (const [key, translations] of Object.entries(CONVERSATION_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        if (!translations[locale] || translations[locale].trim() === "") {
          gaps.push(`${key}.${locale}`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it("carries spec 37's literal broker.messages key", () => {
    expect(CONVERSATION_MESSAGES["broker.messages"]).toBeDefined();
    expect(tConversations("it", "broker.messages")).toBe("Messaggi");
  });

  it("gives ARCHIVED and BLOCKED distinct badge strings", () => {
    // Spec 2.1: two different statuses must not render the same word. The
    // components gate on `=== "ARCHIVED"` / `=== "BLOCKED"`, never `!== "OPEN"`.
    for (const locale of SUPPORTED_LOCALES) {
      expect(tConversations(locale, "messages.archived_badge")).not.toBe(
        tConversations(locale, "messages.blocked_badge"),
      );
    }
  });

  it("names a filter string for each of spec 28's five filters", () => {
    for (const key of [
      "messages.filter.all",
      "messages.filter.unread",
      "messages.filter.listing_inquiries",
      "messages.filter.profile_inquiries",
      "messages.filter.archived",
    ]) {
      expect(CONVERSATION_MESSAGES[key]).toBeDefined();
    }
  });

  it("names a message for every error code this phase can receive", () => {
    for (const code of [
      "feature_disabled",
      "authentication_required",
      "rate_limited",
      "conversation_closed",
      "conversation_superseded",
      "invalid_conversation_status",
      "conversation_filing_forbidden",
      "not_broker_member",
      "not_found",
      "validation_error",
      "unexpected_error",
    ]) {
      expect(CONVERSATION_MESSAGES[`messages.error.${code}`]).toBeDefined();
    }
  });

  it("throws on an unknown key rather than rendering it raw", () => {
    // Same contract as lib/i18n/directory.ts's t(): a raw key on screen is a
    // bug that ships silently, a thrown error is one a test catches.
    expect(() => tConversations("en", "messages.nope")).toThrow(
      /Unknown conversation message key/,
    );
  });

  it("returns the requested locale's own string when it has one", () => {
    expect(tConversations("es", "broker.messages")).toBe("Mensajes");
    expect(tConversations("it", "messages.filter.unread")).toBe("Non letti");
  });

  it("falls back to English for a blank locale entry", () => {
    // The EN-fallback branch cannot be reached through the shipped dictionary,
    // because the first test in this file forbids a blank locale anywhere in it.
    // Asserting tConversations("es", ...) === "Mensajes" would therefore prove
    // only that the Spanish string exists — it would never execute the `||`.
    // So the branch is exercised against an INJECTED entry and cleaned up.
    const KEY = "messages.__fallback_probe__";
    CONVERSATION_MESSAGES[KEY] = { en: "English only", it: "", es: "" };
    try {
      expect(tConversations("es", KEY)).toBe("English only");
      expect(tConversations("it", KEY)).toBe("English only");
      expect(tConversations("en", KEY)).toBe("English only");
    } finally {
      delete CONVERSATION_MESSAGES[KEY];
    }
  });
});

describe("formatConversationMessage", () => {
  it("substitutes named placeholders", () => {
    expect(
      formatConversationMessage(tConversations("en", "messages.unread_count"), {
        count: 3,
      }),
    ).toBe("3 unread");
  });

  it("leaves an unknown placeholder untouched rather than printing undefined", () => {
    expect(formatConversationMessage("Hi {name}", {})).toBe("Hi {name}");
  });
});
