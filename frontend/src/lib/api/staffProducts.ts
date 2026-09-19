// Staff product configuration (spec 23.5, 26.4). Staff admin only.
import { apiFetch } from "@/lib/api/client";

export interface StaffProduct {
  id: string;
  code: string;
  name_en: string;
  is_active: boolean;
  display_amount: string;
  currency: string;
  stripe_product_id: string;
  stripe_price_id: string;
  entitlement_valid_days: number | null;
  publication_days: number | null;
  price_state: string;
  price_reason: string | null;
}

export function fetchProducts() {
  return apiFetch<StaffProduct[]>("/api/v1/staff/products/");
}

export function updateProduct(id: string, changes: Partial<StaffProduct>) {
  return apiFetch<StaffProduct>(`/api/v1/staff/products/${encodeURIComponent(id)}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
}
