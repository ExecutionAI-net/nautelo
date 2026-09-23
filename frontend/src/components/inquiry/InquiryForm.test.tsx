import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InquiryForm from "@/components/inquiry/InquiryForm";
import { ApiError } from "@/lib/api/client";
import type { InquiryConfig, InquiryContextRef } from "@/lib/api/inquiries";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/services/professionals/phase6-pro/",
}));

const submitInquiry = vi.fn();
const createInquiryDraft = vi.fn();
const resolveInquiryDraft = vi.fn();
vi.mock("@/lib/api/inquiries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/inquiries")>();
  return {
    ...actual,
    submitInquiry: (...args: unknown[]) => submitInquiry(...args),
    createInquiryDraft: (...args: unknown[]) => createInquiryDraft(...args),
    resolveInquiryDraft: (...args: unknown[]) => resolveInquiryDraft(...args),
  };
});

let sessionValue: unknown;
vi.mock("@/lib/auth/session", () => ({
  useSession: () => sessionValue,
}));

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

const context: InquiryContextRef = {
  type: "PROFESSIONAL",
  id: "11111111-1111-4111-8111-111111111111",
  label: "Phase6 Pro",
};

const BODY = "I would like to arrange a viewing next week please.";

function signedIn(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    session: {
      authenticated: true,
      user: {
        id: "u1",
        email: "ada@phase6.example",
        full_name: "Ada Rossi",
        primary_role: "PRIVATE_SELLER",
        locale: "EN",
        email_verified: true,
        is_active: true,
        ...overrides,
      },
    },
  };
}

function guest() {
  return { loading: false, session: { authenticated: false, user: null } };
}

function renderForm() {
  return render(<InquiryForm context={context} config={config} locale="en" />);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  sessionValue = guest();
});

describe("InquiryForm", () => {
  it("renders every field spec 15.1 requires", () => {
    sessionValue = signedIn();
    renderForm();

    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Send me occasional updates from Nautelo."),
    ).toBeInTheDocument();
  });

  it("prefills name and email from the profile and makes email read-only", () => {
    sessionValue = signedIn();
    renderForm();

    expect(screen.getByLabelText("Full name")).toHaveValue("Ada Rossi");
    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("ada@phase6.example");
    expect(email).toHaveAttribute("readonly");
    // Text, not a link: there is no /account/ page yet and a 404 would be worse
    // than an explanation. See the component comment and Known Limitation 15.
    expect(
      screen.getByText(
        "Messages are sent from your account email. Change it in your account settings.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /account/i })).toBeNull();
  });

  it("prefills the phone from the profile but keeps it editable", async () => {
    sessionValue = signedIn({ phone_number: "+34600000000" });
    renderForm();

    const phone = screen.getByLabelText("Phone");
    expect(phone).toHaveValue("+34600000000");
    await userEvent.clear(phone);
    await userEvent.type(phone, "+390000000000");
    expect(phone).toHaveValue("+390000000000");
  });

  it("derives the default subject from the context and lets it be edited", async () => {
    sessionValue = signedIn();
    renderForm();
    const subject = screen.getByLabelText("Subject");
    expect(subject).toHaveValue("Question about Phase6 Pro");

    await userEvent.clear(subject);
    await userEvent.type(subject, "Mooring");
    expect(subject).toHaveValue("Mooring");
  });

  it("leaves marketing consent unchecked and privacy consent unchecked", () => {
    sessionValue = signedIn();
    renderForm();
    expect(
      screen.getByLabelText("Send me occasional updates from Nautelo."),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    ).not.toBeChecked();
  });

  it("renders the honeypot hidden from people and from assistive technology", () => {
    sessionValue = signedIn();
    const { container } = renderForm();
    const honeypot = container.querySelector<HTMLInputElement>(
      'input[name="company_website"]',
    );

    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    expect(honeypot!.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(honeypot).toHaveValue("");
  });

  it("sends a valid inquiry and shows the confirmation", async () => {
    sessionValue = signedIn();
    submitInquiry.mockResolvedValue({
      conversation_id: "c1",
      message_id: "m1",
      contact_access: "GRANTED",
      next_url: "/dashboard/private-seller/messages/c1/",
    });
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(submitInquiry).toHaveBeenCalledTimes(1));
    expect(submitInquiry).toHaveBeenCalledWith({
      context_type: "PROFESSIONAL",
      context_id: context.id,
      full_name: "Ada Rossi",
      email: "ada@phase6.example",
      phone: "",
      subject: "Question about Phase6 Pro",
      message: BODY,
      privacy_policy_version: "2026-09",
      privacy_consent: true,
      marketing_consent: false,
      company_website: "",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your message has been forwarded to Phase6 Pro. They will get back to you as soon as possible. Thank you.",
    );
  });

  it("does not navigate away after sending, because the inbox page does not exist yet", async () => {
    sessionValue = signedIn();
    submitInquiry.mockResolvedValue({
      conversation_id: "c1",
      message_id: "m1",
      contact_access: "GRANTED",
      next_url: "/dashboard/private-seller/messages/c1/",
    });
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await screen.findByRole("status");
    expect(push).not.toHaveBeenCalled();
  });

  it("will not send without privacy consent", async () => {
    sessionValue = signedIn();
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(submitInquiry).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Accept the privacy policy to send your message.",
    );
  });

  it("tells an unverified account to verify first and sends nothing", async () => {
    sessionValue = signedIn({ email_verified: false });
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(submitInquiry).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Verify your email address before sending a message.",
    );
  });

  it("saves a guest's draft and sends them to sign in with a local next URL", async () => {
    createInquiryDraft.mockResolvedValue({ draft_token: "tok", expires_in: 1800 });
    renderForm();

    await userEvent.type(screen.getByLabelText("Full name"), "Ada Rossi");
    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(screen.getByRole("button", { name: "Sign in to send" }));

    await waitFor(() => expect(createInquiryDraft).toHaveBeenCalledTimes(1));
    expect(createInquiryDraft).toHaveBeenCalledWith({
      context_type: "PROFESSIONAL",
      context_id: context.id,
      full_name: "Ada Rossi",
      phone: "",
      subject: "Question about Phase6 Pro",
      message: BODY,
    });
    expect(submitInquiry).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(
      "/login/?next=%2Fservices%2Fprofessionals%2Fphase6-pro%2F",
    );
    expect(
      window.sessionStorage.getItem(`nauta.inquiry-draft:PROFESSIONAL:${context.id}`),
    ).toBe("tok");
  });

  it("does not ask a guest for consent before they have even signed in", () => {
    renderForm();
    // The consent checkbox is still shown (spec 15.1 lists it), but the guest's
    // button is the sign-in one - consent is given by the person who actually
    // sends, after they return (spec 15.2).
    expect(screen.getByRole("button", { name: "Sign in to send" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
  });

  it("restores a saved draft after sign-in and waits for a real Send", async () => {
    window.sessionStorage.setItem(
      `nauta.inquiry-draft:PROFESSIONAL:${context.id}`,
      "tok",
    );
    resolveInquiryDraft.mockResolvedValue({
      context_type: "PROFESSIONAL",
      context_id: context.id,
      full_name: "Ada Rossi",
      phone: "+390000000000",
      subject: "Mooring question",
      message: BODY,
    });
    sessionValue = signedIn();
    renderForm();

    await waitFor(() =>
      expect(screen.getByLabelText("Message")).toHaveValue(BODY),
    );
    expect(screen.getByLabelText("Subject")).toHaveValue("Mooring question");
    expect(screen.getByLabelText("Phone")).toHaveValue("+390000000000");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your message was saved. Check it and press Send.",
    );
    // Spec 15.2, verbatim: "Do not send an inquiry automatically after login."
    expect(submitInquiry).not.toHaveBeenCalled();
    expect(
      window.sessionStorage.getItem(`nauta.inquiry-draft:PROFESSIONAL:${context.id}`),
    ).toBeNull();
  });

  it("maps a backend error code onto localized copy", async () => {
    sessionValue = signedIn();
    submitInquiry.mockRejectedValue(
      new ApiError(429, "rate_limited", "raw backend text"),
    );
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You are sending messages too quickly. Please try again shortly.",
    );
  });

  it("shows field errors from a validation_error envelope", async () => {
    sessionValue = signedIn();
    submitInquiry.mockRejectedValue(
      new ApiError(400, "validation_error", "invalid", {
        message: [{ message: "Ensure this field has at least 20 characters.", code: "min_length" }],
      }),
    );
    renderForm();

    await userEvent.type(screen.getByLabelText("Message"), BODY);
    await userEvent.click(
      screen.getByLabelText("I accept the privacy policy (version 2026-09)."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ensure this field has at least 20 characters.",
    );
  });
});
