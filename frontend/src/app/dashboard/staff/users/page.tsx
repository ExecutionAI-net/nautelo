import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffUsersPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/users/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="User Management"
          eyebrow="Staff Admin / Identity"
          description="Review accounts across private sellers, brokers, service providers and staff, and freeze or re-activate them."
          totalLabel="Total registered users"
          endpoint="/api/v1/staff/users/"
          statusActionsBase="/api/v1/staff/users/"
          columns={[
            { key: "full_name", label: "User" },
            { key: "email", label: "Email" },
            { key: "primary_role", label: "Role" },
            { key: "is_active", label: "Active" },
            { key: "date_joined_at", label: "Registered" },
          ]}
          groups={[
            {
              param: "role",
              label: "Role",
              facets: true,
              options: [
                { value: "BUYER", label: "Buyers" },
                { value: "PRIVATE_SELLER", label: "Private sellers" },
                { value: "BROKER", label: "Yacht brokers" },
                { value: "SERVICE_PROVIDER", label: "Service providers" },
                { value: "STAFF", label: "Admin / Staff" },
              ],
            },
            {
              param: "state",
              label: "Status",
              options: [
                { value: "active", label: "Active" },
                { value: "unverified", label: "Unverified" },
                { value: "suspended", label: "Suspended" },
              ],
            },
          ]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
