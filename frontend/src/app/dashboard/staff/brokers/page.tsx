import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffBrokersPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/brokers/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="Brokers"
          eyebrow="Staff / Brokers"
          endpoint="/api/v1/staff/brokers/"
          searchPlaceholder="Search by brokerage name or e-mail"
          columns={[
            { key: "name", label: "Name", sortable: true },
            { key: "status", label: "Status" },
            { key: "public_email", label: "Email" },
            { key: "plan_name", label: "Plan" },
            { key: "member_count", label: "Members", sortable: true },
            { key: "listing_count", label: "Listings", sortable: true },
            { key: "created_at", label: "Registered", sortable: true },
            { key: "auto_approve_listings", label: "Auto-approve listings", panelOnly: true },
            { key: "plan_renews_at", label: "Plan renews", panelOnly: true },
          ]}
          statusOptions={["DRAFT", "PENDING", "ACTIVE", "SUSPENDED"]}
        statusActionsBase="/api/v1/staff/brokers/"
        reviewLink={{ key: "id", base: "/dashboard/staff/brokers/", label: "Manage broker" }}
        />
      </RequirePermission>
    </AreaShell>
  );
}
