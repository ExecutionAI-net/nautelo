import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffLeadsPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/leads/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="Leads"
          eyebrow="Staff / Leads"
          endpoint="/api/v1/staff/leads/"
          searchPlaceholder="Search by subject or sender e-mail"
          columns={[
            { key: "subject", label: "Subject", sortable: true },
            { key: "conversation_type", label: "Type" },
            { key: "status", label: "Status", sortable: true },
            { key: "initiator_email", label: "From" },
            { key: "broker_name", label: "Broker" },
            { key: "created_at", label: "Created", sortable: true },
          ]}
          statusOptions={["OPEN", "ARCHIVED", "BLOCKED"]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
