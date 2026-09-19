import RequirePermission from "@/components/auth/RequirePermission";
import EntitlementLedger from "@/components/staff/EntitlementLedger";

export default function StaffEntitlementsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-space-lg">
      <RequirePermission permission="configure_products_and_settings">
        <EntitlementLedger />
      </RequirePermission>
    </main>
  );
}
