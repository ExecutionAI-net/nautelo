import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PromotionDialog from "./PromotionDialog";

const plans = [
  { code: "week", name: "1 week", days: 7, price: "99.00", currency: "EUR", is_popular: false },
  { code: "two-weeks", name: "2 weeks", days: 14, price: "149.00", currency: "EUR", is_popular: true },
];

vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
import { apiFetch } from "@/lib/api/client";

describe("PromotionDialog", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue(plans);
  });

  it("offers the plans with the popular one preselected and lets the seller skip", async () => {
    const onSkip = vi.fn();
    render(<PromotionDialog listingId="l1" title="Beneteau" returnPath="/sell/l1/" onSkip={onSkip} />);
    expect(await screen.findByRole("button", { name: /Promote my boat for €149/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Skip/ }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("continues without the pop-up when the plans cannot be loaded", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("down"));
    const onSkip = vi.fn();
    render(<PromotionDialog listingId="l1" title="Beneteau" returnPath="/sell/l1/" onSkip={onSkip} />);
    await waitFor(() => expect(onSkip).toHaveBeenCalled());
  });
});
