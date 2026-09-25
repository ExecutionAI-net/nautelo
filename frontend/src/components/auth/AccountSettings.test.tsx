import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AccountSettings from "@/components/auth/AccountSettings";

const apiFetch = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const reload = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/api/client", () => ({ apiFetch }));
vi.mock("@/lib/auth/session", () => ({
  useSession: () => ({
    session: {
      user: {
        email: "a@b.c",
        full_name: "Ann",
        phone_number: "+34 600 000 000",
        newsletter_opt_in: false,
        locale: "EN",
        email_verified: true,
      },
    },
    reload,
  }),
}));

function mockLocation({ pathname = "/dashboard/account/", search = "", hash = "" } = {}) {
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    value: { pathname, search, hash, assign },
    writable: true,
  });
  return assign;
}

describe("AccountSettings", () => {
  beforeEach(() => {
    apiFetch.mockClear();
    apiFetch.mockResolvedValue({});
    reload.mockClear();
  });

  afterEach(() => {
    document.cookie = "nauta_locale=; path=/; max-age=0";
  });

  it("patches only the editable fields, reloads the session and does not navigate when the language is unchanged", async () => {
    const assign = mockLocation();
    render(<AccountSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const [path, init] = apiFetch.mock.calls[0];
    expect(path).toBe("/api/v1/account/");
    expect(JSON.parse(init.body)).toEqual({ full_name: "Ann", phone_number: "+34 600 000 000", newsletter_opt_in: false, locale: "EN" });
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it("saves an edited phone number alongside the other fields", async () => {
    mockLocation();
    render(<AccountSettings />);
    fireEvent.click(screen.getByLabelText("Country code"));
    fireEvent.click(screen.getByRole("option", { name: /^Italy/ }));
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "3331234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const [, init] = apiFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ full_name: "Ann", phone_number: "+393331234567", newsletter_opt_in: false, locale: "EN" });
  });

  it("lets a user opt into or out of the newsletter later", async () => {
    mockLocation();
    render(<AccountSettings />);
    fireEvent.click(screen.getByLabelText("Send me occasional updates from Nautelo."));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const [, init] = apiFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      full_name: "Ann",
      phone_number: "+34 600 000 000",
      newsletter_opt_in: true,
      locale: "EN",
    });
  });

  it("remembers a changed interface language and reopens the same page under its address", async () => {
    const assign = mockLocation({ pathname: "/dashboard/account/", search: "?tab=security" });
    render(<AccountSettings />);
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "IT" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const [, init] = apiFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ full_name: "Ann", phone_number: "+34 600 000 000", newsletter_opt_in: false, locale: "IT" });
    expect(document.cookie).toContain("nauta_locale=it");
    expect(assign).toHaveBeenCalledWith("/it/dashboard/account/?tab=security");
  });

  it("asks for confirmation before sending a password reset link, then sends it to the user's own email", async () => {
    mockLocation();
    render(<AccountSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByRole("dialog", { name: "Send password reset link" })).toBeTruthy();
    expect(apiFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, send it" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      "/api/v1/auth/password-reset/",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "a@b.c" }) }),
    ));
    expect(await screen.findByText("Check your email for the reset link.")).toBeTruthy();
  });

  it("cancels the reset-password confirmation without sending anything", () => {
    mockLocation();
    render(<AccountSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
