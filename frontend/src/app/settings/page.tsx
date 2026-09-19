import RequirePermission from "@/components/auth/RequirePermission";
import ProductSettings from "@/components/staff/ProductSettings";

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-space-lg">
      <RequirePermission permission="configure_products_and_settings">
        <ProductSettings />
      </RequirePermission>
    </main>
  );
}
