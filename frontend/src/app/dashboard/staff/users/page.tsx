import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffUsersPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/users/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="Users"
          eyebrow="Staff Admin / Identity"
          endpoint="/api/v1/staff/users/"
          columns={[
            { key: "email", label: "Email" },
            { key: "full_name", label: "Name" },
            { key: "primary_role", label: "Role" },
            { key: "is_active", label: "Active" },
            { key: "date_joined_at", label: "Joined" },
          ]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
