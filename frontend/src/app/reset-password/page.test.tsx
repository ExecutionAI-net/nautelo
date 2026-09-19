import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ResetPasswordPage from "@/app/reset-password/page";
import { ApiError } from "@/lib/api/client";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), apiFetch }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("token=abc") }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

function submit() {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Br4nd-new-pass-77" } });
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
}

describe("ResetPasswordPage", () => {
  it("sends the token from the URL with the new password", async () => {
    apiFetch.mockResolvedValue(undefined);
    render(<ResetPasswordPage />);
    submit();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ token: "abc", password: "Br4nd-new-pass-77" });
  });

  it("shows a generic message for a bad token", async () => {
    apiFetch.mockRejectedValue(new ApiError(400, "validation_error", "x", { token: [{ message: "invalid_reset_token", code: "invalid" }] }));
    render(<ResetPasswordPage />);
    submit();
    expect((await screen.findByRole("alert")).textContent).toMatch(/invalid or has expired/);
  });
});
