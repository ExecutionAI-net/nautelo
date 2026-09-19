import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffProvidersPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/providers/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="Service providers"
          eyebrow="Staff Admin / Directory"
          endpoint="/api/v1/staff/providers/"
          columns={[
            { key: "display_name", label: "Name" },
            { key: "status", label: "Status" },
            { key: "owner_email", label: "Owner" },
            { key: "city", label: "City" },
            { key: "country_code", label: "Country" },
          ]}
          statusOptions={["DRAFT", "PENDING", "ACTIVE", "SUSPENDED"]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
