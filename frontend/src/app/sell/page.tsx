import RequirePermission from "@/components/auth/RequirePermission";
import SellListingForm from "@/components/listings/SellListingForm";

export default function SellPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission permission="create_private_listing">
        <SellListingForm />
      </RequirePermission>
    </main>
  );
}
