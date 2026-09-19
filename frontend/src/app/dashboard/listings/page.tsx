import RequirePermission from "@/components/auth/RequirePermission";
import MyListings from "@/components/listings/MyListings";

export default function MyListingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission>
        <MyListings />
      </RequirePermission>
    </main>
  );
}
