import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffPurchasesPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/purchases/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="Purchases"
          eyebrow="Staff Admin / Billing"
          description="Every marketplace order (listing packages, media upgrades), with Stripe identifiers for support lookups. Read-only: payment status is never edited manually, it follows Stripe."
          totalLabel="Total orders"
          endpoint="/api/v1/staff/purchases/"
          columns={[
            { key: "user_email", label: "Buyer" },
            { key: "product_name", label: "Product" },
            { key: "amount_display", label: "Amount" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Created" },
            { key: "paid_at", label: "Paid" },
            { key: "fulfilled_at", label: "Fulfilled" },
            { key: "stripe_checkout_session_id", label: "Checkout session" },
            { key: "stripe_payment_intent_id", label: "Payment intent" },
          ]}
          statusOptions={["CREATED", "CHECKOUT_OPEN", "PAID", "FULFILLED", "FAILED", "EXPIRED", "REFUNDED", "DISPUTED"]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
