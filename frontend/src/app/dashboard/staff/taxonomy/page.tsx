import RequirePermission from "@/components/auth/RequirePermission";
import OtherModelQueue from "@/components/staff/OtherModelQueue";

export default function StaffTaxonomyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-space-lg">
      <RequirePermission permission="manage_taxonomy">
        <OtherModelQueue />
      </RequirePermission>
    </main>
  );
}
