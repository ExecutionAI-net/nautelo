import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffContactGrantsPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/contact-grants/">
      <RequirePermission permission="approve_listings_and_revisions">
        <StaffDataTable
          title="Contact grants"
          eyebrow="Staff / Contact grants"
          description="Every grant that unlocked a broker or professional's contact details for a viewer. IDs only, by design - cross-reference the viewer, broker or professional on their own staff page. Revoking is one-way and requires a reason for the audit log."
          totalLabel="Total grants"
          endpoint="/api/v1/staff/contact-grants/"
          columns={[
            { key: "id", label: "Grant ID" },
            { key: "viewer_id", label: "Viewer ID" },
            { key: "target_type", label: "Target type" },
            { key: "target_entity_id", label: "Target ID" },
            { key: "status", label: "Status" },
            { key: "granted_at", label: "Granted" },
            { key: "revoked_at", label: "Revoked" },
            { key: "first_revealed_at", label: "First revealed" },
          ]}
          statusOptions={["ACTIVE", "REVOKED"]}
          revokeAction={{ base: "/api/v1/staff/contact-grants/", label: "Revoke access", reasonPlaceholder: "e.g. Harassment report #22" }}
        />
      </RequirePermission>
    </AreaShell>
  );
}
