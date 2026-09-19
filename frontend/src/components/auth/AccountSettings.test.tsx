import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AccountSettings from "@/components/auth/AccountSettings";

const apiFetch = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const reload = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/api/client", () => ({ apiFetch }));
vi.mock("@/lib/auth/session", () => ({
  useSession: () => ({
    session: { user: { email: "a@b.c", full_name: "Ann", locale: "EN", email_verified: true } },
    reload,
  }),
}));

describe("AccountSettings", () => {
  it("patches only the editable fields and reloads the session", async () => {
    render(<AccountSettings />);
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "IT" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const [path, init] = apiFetch.mock.calls[0];
    expect(path).toBe("/api/v1/account/");
    expect(JSON.parse(init.body)).toEqual({ full_name: "Ann", locale: "IT" });
    expect(await screen.findByRole("status")).toBeTruthy();
  });
});
