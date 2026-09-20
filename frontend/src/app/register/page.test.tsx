import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RegisterPage from "@/app/register/page";
import { ApiError } from "@/lib/api/client";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), apiFetch }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

function fill() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.co" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "S3cret-pass!" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("RegisterPage", () => {
  it("has no role picker and posts no role", async () => {
    apiFetch.mockResolvedValue({});
    render(<RegisterPage />);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    fill();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ email: "a@b.co", password: "S3cret-pass!", full_name: "" });
  });

  it("shows the server's field error", async () => {
    apiFetch.mockRejectedValue(
      new ApiError(400, "validation_error", "x", { email: [{ message: "An account with this email already exists.", code: "invalid" }] }),
    );
    render(<RegisterPage />);
    fill();
    expect((await screen.findByRole("alert")).textContent).toMatch(/already exists/);
  });
});
