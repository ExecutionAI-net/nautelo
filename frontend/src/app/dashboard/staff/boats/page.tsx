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
          searchPlaceholder="Search by brand, model, seller e-mail or broker"
          columns={[
            { key: "title", label: "Listing" },
            { key: "brand_name", label: "Brand", sortable: true },
            { key: "manufacture_year", label: "Year", sortable: true },
            { key: "status", label: "Status", sortable: true },
            { key: "seller_type", label: "Seller type", sortable: true },
            { key: "seller", label: "Seller" },
            { key: "price_display", label: "Price", sortable: true, sortKey: "price" },
            { key: "updated_at", label: "Updated", sortable: true },
            { key: "owner_email", label: "Owner e-mail", panelOnly: true },
            { key: "broker_name", label: "Brokerage", panelOnly: true },
            { key: "created_at", label: "Created", panelOnly: true },
            { key: "published_at", label: "Published", panelOnly: true },
          ]}
          reviewLink={{ key: "pending_revision_id", base: "/dashboard/staff/revisions/", label: "Review and decide" }}
          publicLink={{ key: "slug", base: "/boats/", label: "Open public page", whenStatus: "PUBLISHED" }}
          statusOptions={["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "REJECTED", "SUSPENDED", "EXPIRED", "ARCHIVED"]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
