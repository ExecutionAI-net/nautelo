import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UnpaidNotice from "@/components/provider/UnpaidNotice";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), apiFetch }));

describe("UnpaidNotice", () => {
  it("renders nothing once the profile is active", () => {
    const { container } = render(<UnpaidNotice status="ACTIVE" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no profile yet", () => {
    const { container } = render(<UnpaidNotice status={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("warns and starts checkout for a draft profile", async () => {
    apiFetch.mockResolvedValue({ checkout_url: "https://stripe.example/pay" });
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign }, writable: true });

    render(<UnpaidNotice status="DRAFT" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pay now" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://stripe.example/pay"));
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/provider/membership/checkout/", { method: "POST" });
  });
});
