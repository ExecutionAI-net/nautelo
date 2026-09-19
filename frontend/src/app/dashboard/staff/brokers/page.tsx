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
          eyebrow="Staff Admin / Brokerage"
          endpoint="/api/v1/staff/brokers/"
          columns={[
            { key: "name", label: "Name" },
            { key: "status", label: "Status" },
            { key: "public_email", label: "Email" },
            { key: "member_count", label: "Members" },
            { key: "listing_count", label: "Listings" },
          ]}
          statusOptions={["DRAFT", "PENDING", "ACTIVE", "SUSPENDED"]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
