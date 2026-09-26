import RequirePermission from "@/components/auth/RequirePermission";
import AccountSettings from "@/components/auth/AccountSettings";
import AreaShell from "@/components/layout/AreaShell";

// The broker's own login account (name, e-mail, password, language), kept
// inside the brokerage area: a broker account has nothing to do with the
// private seller area.
export default function BrokerAccountPage() {
  return (
    <AreaShell area="broker" active="/dashboard/broker/account/">
      <RequirePermission>
        <AccountSettings />
      </RequirePermission>
    </AreaShell>
  );
}
