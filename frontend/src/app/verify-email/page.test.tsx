import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VerifyEmailPage from "./page";

const apiFetchMock = vi.fn();
const reloadMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/auth/session", () => ({
  useSession: () => ({ reload: reloadMock }),
}));

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>(
    "@/lib/api/client",
  );
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetchMock(...args) };
});

beforeEach(() => {
  apiFetchMock.mockReset();
  reloadMock.mockReset().mockResolvedValue(undefined);
  searchParams = new URLSearchParams();
});

describe("VerifyEmailPage", () => {
  it("confirms success and refreshes the session", async () => {
    searchParams = new URLSearchParams("token=a-valid-token");
    apiFetchMock.mockResolvedValue({});

    render(<VerifyEmailPage />);

    expect(
      await screen.findByText(/your email address is verified/i),
    ).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/verify-email/",
      expect.objectContaining({ method: "POST" }),
    );
    expect(reloadMock).toHaveBeenCalled();
  });

  it("reports a genuinely invalid, expired, or foreign token", async () => {
    const { ApiError } = await import("@/lib/api/client");
    searchParams = new URLSearchParams("token=not-a-real-token");
    apiFetchMock.mockRejectedValue(
      new ApiError(
        400,
        "validation_error",
        "The submitted data is invalid.",
        {},
        "req-2",
      ),
    );

    render(<VerifyEmailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid or has already been used/i,
    );
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("shows success again when the same link is opened a second time", async () => {
    // The backend treats a moments-later replay of an already-consumed token
    // as an idempotent success (a mail client or corporate link-scanner
    // prefetching the link, a double-click, or a browser retry all resend
    // the exact same token after it already verified the account), so a
    // second visit to the identical link must render success too - not the
    // "invalid or already been used" failure a naive single-use check would
    // produce.
    searchParams = new URLSearchParams("token=already-verified-token");
    apiFetchMock.mockResolvedValue({});

    const { unmount } = render(<VerifyEmailPage />);
    expect(
      await screen.findByText(/your email address is verified/i),
    ).toBeInTheDocument();
    unmount();

    render(<VerifyEmailPage />);
    expect(
      await screen.findByText(/your email address is verified/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a link with no token at all, without calling the API", async () => {
    render(<VerifyEmailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /missing its token/i,
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
