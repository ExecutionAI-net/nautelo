/**
 * The Phase 6 -> Phase 7 seam, end to end in one render tree: a real
 * InquiryForm submit must flip a real ContactPanel from LOCKED to GRANTED
 * without a page reload (spec 16).
 *
 * Only the two network calls are mocked. Both components are the real ones, so
 * a missing dispatch, a wrong target type or a listener bound to the wrong
 * event name all fail here — none of which Task 9's test can see, because it
 * dispatches the event itself.
 *
 * The form setup below (labels, config, session shape) is copied from Phase 6's
 * own InquiryForm.test.tsx. Re-read that file before changing anything here.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContactPanel from "@/components/contact/ContactPanel";
import InquiryForm from "@/components/inquiry/InquiryForm";
import type { InquiryConfig, InquiryContextRef } from "@/lib/api/inquiries";

const submitInquiry = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/inquiries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/inquiries")>()),
  submitInquiry: (...args: unknown[]) => submitInquiry(...args),
}));

const fetchContactAccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/contacts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/contacts")>()),
  fetchContactAccess,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/services/professionals/phase6-pro/",
}));

const sessionState = vi.hoisted(() => ({ current: {} as unknown }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => sessionState.current }));

const TARGET_ID = "11111111-1111-4111-8111-111111111111";

const context: InquiryContextRef = {
  type: "PROFESSIONAL",
  id: TARGET_ID,
  label: "Phase6 Pro",
};

const config: InquiryConfig = {
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

const BODY = "I would like to arrange a viewing next week please.";

function signedIn() {
  return {
    loading: false,
    session: {
      authenticated: true,
      user: {
        id: "u1",
        email: "ada@phase6.example",
        full_name: "Ada Rossi",
        primary_role: "BUYER",
        locale: "EN",
        email_verified: true,
        is_active: true,
      },
    },
  };
}

function renderProfilePage() {
  return render(
    <>
      <InquiryForm context={context} config={config} locale="en" />
      <ContactPanel targetType="professional" targetId={TARGET_ID} locale="en" />
    </>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  sessionState.current = signedIn();
});

describe("a successful inquiry and the contact panel", () => {
  it("unlocks the panel without a page reload", async () => {
    fetchContactAccess
      .mockResolvedValueOnce({
        state: "LOCKED",
        email_mask: "i••••@example.com",
        phone_mask: "+34 ••• ••• ••2",
        unlock_rule: "SEND_INQUIRY",
      })
      .mockResolvedValue({
        state: "GRANTED",
        email: "info@example.com",
        phone: "+34900111222",
        website_url: null,
        granted_at: "2026-09-18T10:30:00Z",
      });
    submitInquiry.mockResolvedValue({
      conversation_id: "c1",
      message_id: "m1",
      contact_access: "GRANTED",
      next_url: "/dashboard/private-seller/messages/c1/",
    });
    renderProfilePage();
    await screen.findByText("i••••@example.com");

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(submitInquiry).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("link", { name: "info@example.com" }),
    ).toBeInTheDocument();
    expect(fetchContactAccess).toHaveBeenCalledTimes(2);
  });

  it("re-asks the server rather than unblurring locally", async () => {
    // Spec 16: "do not rely on client-side unblur alone." If the second answer
    // is still LOCKED — a grant the backend declined to create, or a flag that
    // is off — the panel must stay locked.
    fetchContactAccess.mockResolvedValue({
      state: "LOCKED",
      email_mask: "i••••@example.com",
      phone_mask: "+34 ••• ••• ••2",
      unlock_rule: "SEND_INQUIRY",
    });
    submitInquiry.mockResolvedValue({
      conversation_id: "c1",
      message_id: "m1",
      contact_access: "GRANTED",
      next_url: "/dashboard/private-seller/messages/c1/",
    });
    renderProfilePage();
    await screen.findByText("i••••@example.com");

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(fetchContactAccess).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("link", { name: "info@example.com" })).toBeNull();
    expect(screen.getByText("i••••@example.com")).toBeInTheDocument();
  });

  it("does not refresh when the submit failed", async () => {
    fetchContactAccess.mockResolvedValue({
      state: "LOCKED",
      email_mask: "i••••@example.com",
      phone_mask: "+34 ••• ••• ••2",
      unlock_rule: "SEND_INQUIRY",
    });
    submitInquiry.mockRejectedValue(new Error("rate limited"));
    renderProfilePage();
    await screen.findByText("i••••@example.com");

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(submitInquiry).toHaveBeenCalledTimes(1));
    expect(fetchContactAccess).toHaveBeenCalledTimes(1);
  });
});

describe("contactTargetTypeForContext", () => {
  it("maps the two grantable contexts onto their URL segments", async () => {
    const { contactTargetTypeForContext } = await vi.importActual<
      typeof import("@/lib/api/contacts")
    >("@/lib/api/contacts");

    expect(contactTargetTypeForContext("BROKER")).toBe("broker");
    expect(contactTargetTypeForContext("PROFESSIONAL")).toBe("professional");
  });

  it("returns null for a LISTING context, which has no contact endpoint", () => {
    // A private-seller listing grants nothing at all (Phase 6 reports
    // NOT_APPLICABLE), and a broker-owned listing grants the BROKER's contact,
    // whose id this form does not carry. Dispatching the listing id as a
    // contact target would be a refresh request no panel can match.
    return import("@/lib/api/contacts").then(({ contactTargetTypeForContext }) => {
      expect(contactTargetTypeForContext("LISTING")).toBeNull();
      expect(contactTargetTypeForContext("nonsense")).toBeNull();
    });
  });
});
