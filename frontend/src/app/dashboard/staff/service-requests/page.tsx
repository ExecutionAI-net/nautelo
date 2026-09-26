import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffServiceRequestsPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/service-requests/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="Service requests"
          eyebrow="Staff / Service requests"
          endpoint="/api/v1/staff/service-requests/"
          columns={[
            { key: "subject", label: "Subject" },
            { key: "status", label: "Status" },
            { key: "initiator_email", label: "From" },
            { key: "professional_name", label: "Provider" },
            { key: "created_at", label: "Created" },
          ]}
          statusOptions={["OPEN", "ARCHIVED", "BLOCKED", "CLOSED"]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
