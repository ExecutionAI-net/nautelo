import RequirePermission from "@/components/auth/RequirePermission";
import StaffBrokerDetailView from "@/components/staff/StaffBrokerDetailView";

/**
 * Spec §21 "Staff broker UI", at spec §4.2's staff `/brokers/` route under the
 * staff dashboard prefix §26.1 writes out in full.
 *
 * The gate is `approve_listings_and_revisions` (staff moderator and above), not
 * `configure_broker_auto_approval` (staff admin only): a moderator working the
 * boats queue needs this broker's status, backlog and policy state, and the
 * switch itself is disabled for them (Task 8). It also mirrors the backend's
 * own gate on `GET /api/v1/staff/brokers/<id>/` (IsStaffModerator). Spec §21's
 * acceptance test 2 — "An ordinary broker user cannot toggle auto-approval
 * through UI or API" — is satisfied here for the UI half: a broker user has
 * neither permission and gets the 403 screen instead of the page.
 *
 * `params` is a Promise in Next 16. This page is a server component that awaits
 * it and hands the plain id to the client component below.
 */
export default async function StaffBrokerPage({
  params,
}: {
  params: Promise<{ brokerId: string }>;
}) {
  const { brokerId } = await params;
  return (
    <main className="mx-auto w-full max-w-4xl p-space-lg">
      <RequirePermission permission="approve_listings_and_revisions">
        <StaffBrokerDetailView brokerId={brokerId} />
      </RequirePermission>
    </main>
  );
}
