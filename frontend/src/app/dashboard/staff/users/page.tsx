import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import StaffDataTable from "@/components/staff/StaffDataTable";

// What each role can do, in the words a staff member needs: the permission matrix lives in accounts/selectors.py.
const ROLES: [string, string][] = [
  ["Private seller", "Sells their own boat: one free listing per year, paid listings beyond that. Can enquire about boats, brokers and services."],
  ["Yacht broker", "Member of a brokerage: lists boats for the organisation within its plan's limits, answers leads, manages the team."],
  ["Professional", "Service provider (surveyor, transport, insurance...): listed in the directory while the membership is paid; receives service requests."],
  ["Admin / Staff", "Nautelo team. Staff admins moderate listings, manage users, brokers, plans, prices and content; every action is audited."],
];

function RoleLegend() {
  return (
    <details className="rounded-lg bg-surface-container-low p-space-sm font-body-sm text-on-surface">
      <summary className="cursor-pointer font-label-md text-primary">What the roles mean</summary>
      <dl className="mt-space-sm grid gap-space-xs sm:grid-cols-[max-content_1fr] sm:gap-x-space-md">
        {ROLES.map(([role, text]) => (
          <div key={role} className="contents">
            <dt className="font-title-sm text-primary">{role}</dt>
            <dd className="text-on-surface-variant">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-space-sm text-on-surface-variant">Status: Active = verified and signed in normally · Unverified = has not confirmed the e-mail address yet · Suspended = frozen by staff, cannot sign in.</p>
    </details>
  );
}

export const dynamic = "force-dynamic";

export default function StaffUsersPage() {
  return (
    <AreaShell area="staff" active="/dashboard/staff/users/">
      <RequirePermission permission="configure_products_and_settings">
        <StaffDataTable
          title="Users"
          eyebrow="Staff / Users"
          description="Review accounts across private sellers, brokers, service providers and staff, and freeze or re-activate them."
          legend={<RoleLegend />}
          totalLabel="Total registered users"
          endpoint="/api/v1/staff/users/"
          statusActionsBase="/api/v1/staff/users/"
          searchPlaceholder="Search by name or e-mail"
          columns={[
            { key: "full_name", label: "User", sortable: true },
            { key: "email", label: "Email" },
            { key: "primary_role", label: "Role", sortable: true },
            { key: "account_state", label: "Status" },
            { key: "date_joined_at", label: "Registered", sortable: true },
            { key: "email_verified_at", label: "E-mail verified", panelOnly: true },
          ]}
          groups={[
            {
              param: "role",
              label: "Role",
              facets: true,
              options: [
                { value: "PRIVATE_SELLER", label: "Private sellers" },
                { value: "BROKER", label: "Yacht brokers" },
                { value: "PROFESSIONAL", label: "Professionals" },
                { value: "STAFF", label: "Admin / Staff" },
              ],
            },
            {
              param: "state",
              label: "Status",
              options: [
                { value: "active", label: "Active" },
                { value: "unverified", label: "Unverified" },
                { value: "suspended", label: "Suspended" },
              ],
            },
          ]}
        />
      </RequirePermission>
    </AreaShell>
  );
}
