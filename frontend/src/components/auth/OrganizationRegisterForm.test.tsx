import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrganizationRegisterForm from "@/components/auth/OrganizationRegisterForm";

const apiFetch = vi.hoisted(() => vi.fn());
const uploadRegistrationLogo = vi.hoisted(() => vi.fn().mockResolvedValue("logo-key-1"));
const uploadRegistrationDocument = vi.hoisted(() => vi.fn().mockResolvedValue("doc-key-1"));
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), apiFetch }));
vi.mock("@/lib/api/orgRegistrationUploads", () => ({ uploadRegistrationLogo, uploadRegistrationDocument }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

function fillPersonalStep() {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Mia" } });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "m@b.co" } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "S3cret-pass!" } });
  fireEvent.change(screen.getByLabelText(/^Confirm password/), { target: { value: "S3cret-pass!" } });
  fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+34600" } });
}

function mockCategoriesThenRegister() {
  apiFetch.mockImplementation((url: string) =>
    url.includes("service-categories")
      ? Promise.resolve([{ slug: "rigging", name: "Rigging" }, { slug: "detailing", name: "Detailing" }, { slug: "valeting", name: "Valeting" }])
      : Promise.resolve({}),
  );
}

async function goToStep2() {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText(/^business name/i, { selector: "input" });
}

describe("OrganizationRegisterForm (PROFESSIONAL)", () => {
  it("registers a professional owner through the two-step wizard", async () => {
    mockCategoriesThenRegister();
    render(<OrganizationRegisterForm orgType="PROFESSIONAL" />);
    fillPersonalStep();
    await goToStep2();
    fireEvent.change(screen.getByLabelText(/^business name/i, { selector: "input" }), { target: { value: "Blue Rigging" } });
    fireEvent.click(await screen.findByLabelText("Rigging"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    const registerCall = apiFetch.mock.calls.find(([url]) => url.includes("register/organization"));
    expect(JSON.parse(registerCall![1].body)).toMatchObject({
      org_type: "PROFESSIONAL",
      organization_name: "Blue Rigging",
      email: "m@b.co",
      newsletter_opt_in: false,
      categories: ["rigging"],
    });
  });

  it("cannot continue to step 2 with an incomplete personal step", () => {
    mockCategoriesThenRegister();
    render(<OrganizationRegisterForm orgType="PROFESSIONAL" />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("cannot submit without choosing a category", async () => {
    mockCategoriesThenRegister();
    render(<OrganizationRegisterForm orgType="PROFESSIONAL" />);
    fillPersonalStep();
    await goToStep2();
    fireEvent.change(screen.getByLabelText(/^business name/i, { selector: "input" }), { target: { value: "Blue Rigging" } });
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
  });

  it("allows at most two categories", async () => {
    mockCategoriesThenRegister();
    render(<OrganizationRegisterForm orgType="PROFESSIONAL" />);
    fillPersonalStep();
    await goToStep2();
    fireEvent.click(await screen.findByLabelText("Rigging"));
    fireEvent.click(screen.getByLabelText("Detailing"));
    expect((screen.getByLabelText("Valeting") as HTMLInputElement).disabled).toBe(true);
  });

  it("posts newsletter_opt_in true when the owner checks it", async () => {
    mockCategoriesThenRegister();
    render(<OrganizationRegisterForm orgType="PROFESSIONAL" />);
    fillPersonalStep();
    await goToStep2();
    fireEvent.change(screen.getByLabelText(/^business name/i, { selector: "input" }), { target: { value: "Blue Rigging" } });
    fireEvent.click(await screen.findByLabelText("Rigging"));
    fireEvent.click(screen.getByLabelText("Send me occasional updates from Nautelo."));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    const registerCall = apiFetch.mock.calls.find(([url]) => url.includes("register/organization"));
    expect(JSON.parse(registerCall![1].body).newsletter_opt_in).toBe(true);
  });
});

describe("OrganizationRegisterForm (BROKER)", () => {
  function mockBrokerLookups() {
    apiFetch.mockImplementation((url: string) => {
      if (url.includes("broker-roles")) return Promise.resolve([{ slug: "ceo", name: "CEO" }]);
      if (url.includes("pricing"))
        return Promise.resolve({
          broker_plans: [{ slug: "starter", name: "Starter", monthly_price: "99", currency: "EUR", listing_limit: 10, seat_limit: 3 }],
        });
      return Promise.resolve({});
    });
  }

  function fillBrokerCommon() {
    fireEvent.change(screen.getByLabelText(/^brokerage name/i, { selector: "input" }), { target: { value: "Blue Rigging" } });
    fillPersonalStep();
    fireEvent.change(screen.getByLabelText(/trading name/i), { target: { value: "Blue Rigging Yachts" } });
    fireEvent.change(screen.getByLabelText(/your role in the company/i), { target: { value: "ceo" } });
  }

  it("makes a broker pick a plan", async () => {
    mockBrokerLookups();
    render(<OrganizationRegisterForm orgType="BROKER" />);
    expect(await screen.findByText(/Starter/)).toBeTruthy();
    expect((screen.getByRole("radio") as HTMLInputElement).checked).toBe(true);
  });

  it("requires trading name, role, logo and a document before submitting", async () => {
    mockBrokerLookups();
    render(<OrganizationRegisterForm orgType="BROKER" />);
    await screen.findByText(/Starter/);
    fillBrokerCommon();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();

    const logoInput = screen.getByLabelText(/company logo/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(logoInput, { target: { files: [new File(["x"], "logo.png", { type: "image/png" })] } });
    await waitFor(() => expect(uploadRegistrationLogo).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();

    const docInput = screen.getByLabelText(/Kimlik, NIF\/VAT/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(docInput, { target: { files: [new File(["x"], "doc.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(uploadRegistrationDocument).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByRole("button", { name: "Create account" })).not.toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    const registerCall = apiFetch.mock.calls.find(([url]) => url.includes("register/organization"));
    expect(JSON.parse(registerCall![1].body)).toMatchObject({
      org_type: "BROKER",
      trading_name: "Blue Rigging Yachts",
      role: "ceo",
      logo_key: "logo-key-1",
      document_keys: ["doc-key-1"],
    });
  });
});
