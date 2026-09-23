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
          eyebrow="Staff / Purchases"
          description="Every purchase on the platform in one ledger: one-time orders (listing packages, media upgrades), listing and profile promotions, and broker/professional subscriptions. Read-only: payment status follows Stripe and is never edited here. The Stripe identifiers for a support lookup are in the details panel."
          totalLabel="Total purchases"
          endpoint="/api/v1/staff/purchases/"
          searchPlaceholder="Search by buyer e-mail, product or Stripe id"
          columns={[
            { key: "kind", label: "Kind" },
            { key: "user_email", label: "Buyer" },
            { key: "product_name", label: "Product" },
            { key: "detail", label: "Detail" },
            { key: "amount_display", label: "Amount" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Created" },
            { key: "paid_at", label: "Paid" },
            { key: "fulfilled_at", label: "Fulfilled / period end", panelOnly: true },
            { key: "stripe_checkout_session_id", label: "Checkout session / customer", panelOnly: true },
            { key: "stripe_payment_intent_id", label: "Payment intent / subscription", panelOnly: true },
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
                (value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ") }),
              ),
            },
          ]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
