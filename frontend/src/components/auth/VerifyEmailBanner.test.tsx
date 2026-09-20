import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VerifyEmailBanner from "@/components/auth/VerifyEmailBanner";

const apiFetch = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), apiFetch }));
vi.mock("@/lib/auth/session", () => ({ useSession: () => ({ session: session.value }) }));

describe("VerifyEmailBanner", () => {
  it("renders nothing without a session or for a verified user", () => {
    session.value = null;
    const { container, rerender } = render(<VerifyEmailBanner />);
    expect(container.textContent).toBe("");
    session.value = { authenticated: true, user: { email: "a@b.co", email_verified: true } };
    rerender(<VerifyEmailBanner />);
    expect(container.textContent).toBe("");
  });

  it("warns an unverified user and can resend the email", async () => {
    session.value = { authenticated: true, user: { email: "a@b.co", email_verified: false } };
    apiFetch.mockResolvedValue({});
    render(<VerifyEmailBanner />);
    expect(screen.getByRole("alert").textContent).toMatch(/Verify your email/);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button").textContent).toMatch(/Email sent/));
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ email: "a@b.co" });
  });
});
