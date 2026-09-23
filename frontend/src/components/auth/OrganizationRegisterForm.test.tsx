import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrganizationRegisterForm from "@/components/auth/OrganizationRegisterForm";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), apiFetch }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

function fillCommon() {
  fireEvent.change(screen.getByLabelText(/name$/i, { selector: "input" }) as HTMLElement, { target: { value: "Blue Rigging" } });
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Mia" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "m@b.co" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "S3cret-pass!" } });
  fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+34600" } });
}

function mockCategoriesThenRegister() {
  apiFetch.mockImplementation((url: string) =>
    url.includes("service-categories")
      ? Promise.resolve([{ slug: "rigging", name: "Rigging" }])
      : Promise.resolve({}),
  );
}

async function pickCategory() {
  fireEvent.change(await screen.findByLabelText(/which field are you a professional in/i), {
    target: { value: "rigging" },
  });
}

describe("OrganizationRegisterForm", () => {
  it("registers a professional owner", async () => {
    mockCategoriesThenRegister();
    render(<OrganizationRegisterForm orgType="PROFESSIONAL" />);
    fillCommon();
    await pickCategory();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    const registerCall = apiFetch.mock.calls.find(([url]) => url.includes("register/organization"));
    expect(JSON.parse(registerCall![1].body)).toMatchObject({
      org_type: "PROFESSIONAL",
      organization_name: "Blue Rigging",
      email: "m@b.co",
      newsletter_opt_in: false,
      category: "rigging",
    });
  });

  it("cannot submit without choosing a category", async () => {
    mockCategoriesThenRegister();
    render(<OrganizationRegisterForm orgType="PROFESSIONAL" />);
    fillCommon();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
  });

  it("posts newsletter_opt_in true when the owner checks it", async () => {
    mockCategoriesThenRegister();
    render(<OrganizationRegisterForm orgType="PROFESSIONAL" />);
    fillCommon();
    await pickCategory();
    fireEvent.click(screen.getByLabelText("Send me occasional updates from NAUTA."));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    const registerCall = apiFetch.mock.calls.find(([url]) => url.includes("register/organization"));
    expect(JSON.parse(registerCall![1].body).newsletter_opt_in).toBe(true);
  });

  it("makes a broker pick a plan", async () => {
    apiFetch.mockResolvedValue({
      broker_plans: [{ slug: "starter", name: "Starter", monthly_price: "99", currency: "EUR", listing_limit: 10, seat_limit: 3 }],
    });
    render(<OrganizationRegisterForm orgType="BROKER" />);
    expect(await screen.findByText(/Starter/)).toBeTruthy();
    expect((screen.getByRole("radio") as HTMLInputElement).checked).toBe(true);
  });
});
