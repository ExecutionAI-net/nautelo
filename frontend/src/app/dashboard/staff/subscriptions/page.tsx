import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffSubscriptionsPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/subscriptions/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="Subscriptions and entitlements"
          eyebrow="Staff Admin / Billing"
          endpoint="/api/v1/staff/subscriptions/"
          columns={[
            { key: "user_email", label: "User" },
            { key: "entitlement_type", label: "Type" },
            { key: "source", label: "Source" },
            { key: "state", label: "State" },
            { key: "valid_until", label: "Valid until" },
          ]}
          statusOptions={["AVAILABLE", "RESERVED", "CONSUMED", "EXPIRED", "REVOKED"]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
