import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import EntitlementLedger from "@/components/staff/EntitlementLedger";

const api = vi.hoisted(() => ({
  fetchEntitlements: vi.fn(),
  grantEntitlement: vi.fn().mockResolvedValue({}),
  changeEntitlement: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/api/staffEntitlements", () => api);

const row = (state: string) => ({
  id: "e1",
  user_id: "u1",
  entitlement_type: "PAID_LISTING",
  source: "STRIPE",
  state,
  listing_id: null,
  valid_until: null,
  consumed_at: null,
  revoked_at: null,
  reason: "",
  payment_order_id: null,
});

describe("EntitlementLedger", () => {
  it("revokes an available right with a reason", async () => {
    api.fetchEntitlements.mockResolvedValue({ results: [row("AVAILABLE")] });
    vi.spyOn(window, "prompt").mockReturnValue("Refund");
    render(<EntitlementLedger />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(api.changeEntitlement).toHaveBeenCalledWith("e1", "revoke", "Refund"));
  });

  it("offers restore only for consumed rights", async () => {
    api.fetchEntitlements.mockResolvedValue({ results: [row("CONSUMED")] });
    render(<EntitlementLedger />);
    expect(await screen.findByRole("button", { name: "Restore" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
  });
});
