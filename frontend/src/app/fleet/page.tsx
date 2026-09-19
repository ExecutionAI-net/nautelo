import RequirePermission from "@/components/auth/RequirePermission";
import FleetListingPage from "@/components/listings/FleetListingPage";

export default function FleetPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission permission="create_broker_listing">
        <FleetListingPage />
      </RequirePermission>
    </main>
  );
}
