import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

export const dynamic = "force-dynamic";

export default function StaffBoatsPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/boats/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="Boats"
          eyebrow="Staff / Boats"
          endpoint="/api/v1/staff/boats/"
          columns={[
            { key: "title", label: "Listing" },
            { key: "brand_name", label: "Brand" },
            { key: "manufacture_year", label: "Year" },
            { key: "status", label: "Status" },
            { key: "seller_type", label: "Seller type" },
            { key: "price_display", label: "Price" },
            { key: "owner_email", label: "Owner" },
            { key: "broker_name", label: "Broker" },
          ]}
          reviewLink={{ key: "pending_revision_id", base: "/dashboard/staff/revisions/", label: "Review and decide" }}
          statusOptions={["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "REJECTED", "SUSPENDED", "EXPIRED", "ARCHIVED"]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
