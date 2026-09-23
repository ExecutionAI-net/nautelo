import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffProvidersPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/providers/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="Providers"
          eyebrow="Staff / Providers"
          endpoint="/api/v1/staff/providers/"
          searchPlaceholder="Search by name, owner e-mail or city"
          columns={[
            { key: "display_name", label: "Name", sortable: true },
            { key: "status", label: "Status" },
            { key: "owner_email", label: "Owner" },
            { key: "city", label: "City", sortable: true },
            { key: "country_code", label: "Country" },
            { key: "created_at", label: "Registered", sortable: true },
          ]}
          statusOptions={["DRAFT", "PENDING", "ACTIVE", "SUSPENDED"]}
        statusActionsBase="/api/v1/staff/providers/"
        />
      </RequirePermission>
    </AreaShell>
  );
}
