import RequirePermission from "@/components/auth/RequirePermission";
import ModerationQueue from "@/components/staff/ModerationQueue";

export default function StaffHomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-space-lg">
      <RequirePermission permission="approve_listings_and_revisions">
        <ModerationQueue />
      </RequirePermission>
    </main>
  );
}
