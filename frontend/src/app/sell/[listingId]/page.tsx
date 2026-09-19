import RequirePermission from "@/components/auth/RequirePermission";
import EditListing from "@/components/listings/EditListing";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  return (
    <main className="mx-auto w-full max-w-3xl px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission>
        <EditListing listingId={listingId} />
      </RequirePermission>
    </main>
  );
}
