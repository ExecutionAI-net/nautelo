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

describe("OrganizationRegisterForm", () => {
  it("registers a professional owner", async () => {
    apiFetch.mockResolvedValue({});
    render(<OrganizationRegisterForm orgType="PROFESSIONAL" />);
    fillCommon();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({
      org_type: "PROFESSIONAL",
      organization_name: "Blue Rigging",
      email: "m@b.co",
      newsletter_opt_in: false,
    });
  });

  it("posts newsletter_opt_in true when the owner checks it", async () => {
    apiFetch.mockResolvedValue({});
    render(<OrganizationRegisterForm orgType="PROFESSIONAL" />);
    fillCommon();
    fireEvent.click(screen.getByLabelText("Send me occasional updates from NAUTA."));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(JSON.parse(apiFetch.mock.calls[0][1].body).newsletter_opt_in).toBe(true);
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
