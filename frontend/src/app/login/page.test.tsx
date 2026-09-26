import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

const replaceMock = vi.fn();
const loginMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/auth/session", () => ({
  useSession: () => ({ login: loginMock }),
}));

beforeAll(async () => {
  // First render/interaction in a fresh jsdom environment pays a one-time
  // React + testing-library warm-up cost (~2-4s under Vitest's parallel
  // workers) that otherwise lands inside whichever `it()` runs first and
  // trips its waitFor/testTimeout. Absorb that cost here, under the more
  // generous hookTimeout, so no test's timing budget depends on run order.
  loginMock.mockResolvedValue(undefined);
  const { unmount } = render(<LoginPage />);
  await submit();
  unmount();
  cleanup();
  loginMock.mockReset();
});

beforeEach(() => {
  replaceMock.mockReset();
  loginMock.mockReset().mockResolvedValue(undefined);
  searchParams = new URLSearchParams();
});

async function submit() {
  // delay: null skips userEvent's real setTimeout between keystrokes, so
  // typing resolves via microtasks instead of the macrotask timer queue —
  // under Vitest's parallel jsdom workers that queue backs up and blows
  // past waitFor/testTimeout (see the flakiness investigation in Task 14).
  const user = userEvent.setup({ delay: null });
  await user.type(screen.getByLabelText(/email/i), "pilot@example.com");
  await user.type(screen.getByLabelText(/^password/i), "n4uta-test-Passw0rd");
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  it("signs in and redirects to the default destination", async () => {
    render(<LoginPage />);
    await submit();

    expect(loginMock).toHaveBeenCalledWith(
      "pilot@example.com",
      "n4uta-test-Passw0rd",
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });

  it("honours a safe ?next= destination", async () => {
    searchParams = new URLSearchParams("next=/dashboard/private-seller/account/");
    render(<LoginPage />);
    await submit();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/dashboard/private-seller/account/"));
  });

  it("refuses an off-site ?next= and falls back to the root", async () => {
    // The security-relevant case: the page must route through safeNextUrl(),
    // not straight to searchParams.get("next").
    searchParams = new URLSearchParams("next=https://evil.example.com/steal");
    render(<LoginPage />);
    await submit();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(replaceMock).not.toHaveBeenCalledWith(
      expect.stringContaining("evil.example.com"),
    );
  });

  it("shows the server's message and does not redirect when sign-in fails", async () => {
    const { ApiError } = await import("@/lib/api/client");
    loginMock.mockRejectedValue(
      new ApiError(
        401,
        "no_active_account",
        "No active account found.",
        {},
        "req-1",
      ),
    );
    render(<LoginPage />);
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No active account found.",
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
