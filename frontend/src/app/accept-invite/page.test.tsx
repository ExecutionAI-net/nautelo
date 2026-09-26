import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AcceptInvitePage from "@/app/accept-invite/page";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), apiFetch }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("token=abc") }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session: null, reload: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

describe("AcceptInvitePage", () => {
  it("lets a new address register into the invited role", async () => {
    apiFetch.mockResolvedValueOnce({ organization: "Blue Rigging", org_type: "PROFESSIONAL", role: "MANAGER", email: "n@x.co", account_exists: false });
    render(<AcceptInvitePage />);
    expect(await screen.findByText((_, el) => el?.tagName === "P" && (el?.textContent?.includes("Blue Rigging") ?? false))).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Mia" } });
    fireEvent.change(screen.getByLabelText("Choose a password"), { target: { value: "S3cret-pass!" } });
    apiFetch.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/joined Blue Rigging/));
    expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toEqual({ token: "abc", password: "S3cret-pass!", full_name: "Mia" });
  });

  it("asks an existing account to sign in first", async () => {
    apiFetch.mockResolvedValueOnce({ organization: "Blue Rigging", org_type: "BROKER", role: "AGENT", email: "e@x.co", account_exists: true });
    render(<AcceptInvitePage />);
    await screen.findByText(/already exists/);
    const hrefs = screen.getAllByRole("link", { name: "Sign in" }).map((link) => link.getAttribute("href"));
    expect(hrefs.some((href) => href?.startsWith("/login/?next="))).toBe(true);
    expect(screen.queryByRole("button", { name: "Accept invitation" })).toBeNull();
  });

  it("warns a private seller in red what joining a brokerage takes away", async () => {
    apiFetch.mockResolvedValueOnce({
      organization: "Blue Marine", org_type: "BROKER", role: "AGENT", email: "p@x.co", account_exists: true,
      private_seller_warning: { listings: 2, unused_rights: 3 },
    });
    render(<AcceptInvitePage />);
    const warning = await screen.findByRole("note");
    expect(warning.className).toContain("text-error");
    expect(warning.textContent).toMatch(/lose your private seller area/);
    expect(warning.textContent).toMatch(/your 2 private listing\(s\)/);
    expect(warning.textContent).toMatch(/your 3 unused listing right\(s\)/);
  });

  it("shows no warning for an address that is not a private seller", async () => {
    apiFetch.mockResolvedValueOnce({ organization: "Blue Marine", org_type: "BROKER", role: "AGENT", email: "n@x.co", account_exists: false, private_seller_warning: null });
    render(<AcceptInvitePage />);
    await screen.findByLabelText("Full name");
    expect(screen.queryByRole("note")).toBeNull();
  });
});
