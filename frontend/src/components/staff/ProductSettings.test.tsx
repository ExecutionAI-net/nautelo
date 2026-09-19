import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProductSettings from "@/components/staff/ProductSettings";

const api = vi.hoisted(() => ({ fetchProducts: vi.fn(), updateProduct: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/api/staffProducts", () => api);

describe("ProductSettings", () => {
  it("saves Stripe ids and the active flag for a product", async () => {
    api.fetchProducts.mockResolvedValue([
      {
        id: "p1", code: "INDIVIDUAL_LISTING_RIGHT", name_en: "Right", is_active: false,
        display_amount: "49.00", currency: "EUR", stripe_product_id: "", stripe_price_id: "",
        entitlement_valid_days: 365, publication_days: 90, price_state: "UNCHECKED", price_reason: null,
      },
    ]);
    render(<ProductSettings />);
    fireEvent.change(await screen.findByLabelText("Stripe price id"), { target: { value: "price_123" } });
    fireEvent.click(screen.getByLabelText("Active"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(api.updateProduct).toHaveBeenCalledWith("p1", {
        name_en: "Right", stripe_product_id: "", stripe_price_id: "price_123", is_active: true,
      }),
    );
  });
});
