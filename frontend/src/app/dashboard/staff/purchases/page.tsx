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
          description="Every purchase on the platform in one ledger: one-time orders (listing packages, media upgrades), listing and profile promotions, and broker/professional subscriptions, with Stripe identifiers for support lookups. Read-only: payment status is never edited manually, it follows Stripe. For subscriptions the identifier columns hold the Stripe customer and subscription ids."
          totalLabel="Total purchases"
          endpoint="/api/v1/staff/purchases/"
          columns={[
            { key: "kind", label: "Kind" },
            { key: "user_email", label: "Buyer" },
            { key: "product_name", label: "Product" },
            { key: "detail", label: "Detail" },
            { key: "amount_display", label: "Amount" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Created" },
            { key: "paid_at", label: "Paid" },
            { key: "fulfilled_at", label: "Fulfilled / period end" },
            { key: "stripe_checkout_session_id", label: "Checkout session / customer" },
            { key: "stripe_payment_intent_id", label: "Payment intent / subscription" },
          ]}
          groups={[
            {
              param: "kind",
              label: "Kind",
              options: [
                { value: "Order", label: "Orders" },
                { value: "Promotion", label: "Promotions" },
                { value: "Broker subscription", label: "Broker subscriptions" },
                { value: "Professional membership", label: "Professional memberships" },
              ],
            },
            {
              param: "status",
              label: "Status",
              facets: true,
              options: ["CREATED", "CHECKOUT_OPEN", "PAID", "FULFILLED", "FAILED", "EXPIRED", "REFUNDED", "DISPUTED", "PENDING", "REVIEW", "TRIALING", "ACTIVE", "PAST_DUE", "LAPSED", "CANCELED"].map(
                (value) => ({ value, label: value }),
              ),
            },
          ]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
