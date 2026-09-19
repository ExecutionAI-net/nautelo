import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MediaUpgradePanel from "@/components/listings/MediaUpgradePanel";
import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  applyMediaUpgrade: vi.fn(),
  startMediaUpgradeCheckout: vi.fn(),
}));
vi.mock("@/lib/api/sellerListings", () => api);

describe("MediaUpgradePanel", () => {
  it("offers purchase only after apply reports no unused upgrade", async () => {
    api.applyMediaUpgrade.mockRejectedValue(new ApiError(409, "media_upgrade_unavailable", "x"));
    render(<MediaUpgradePanel listingId="l1" onApplied={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Need more/ }));
    expect(screen.queryByRole("button", { name: "Buy an upgrade" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apply my upgrade" }));
    expect(await screen.findByRole("button", { name: "Buy an upgrade" })).toBeTruthy();
  });

  it("notifies the form when the upgrade is applied", async () => {
    api.applyMediaUpgrade.mockResolvedValue({ state: "CONSUMED" });
    const onApplied = vi.fn();
    render(<MediaUpgradePanel listingId="l1" onApplied={onApplied} />);
    fireEvent.click(screen.getByRole("button", { name: /Need more/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply my upgrade" }));
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
  });
});
