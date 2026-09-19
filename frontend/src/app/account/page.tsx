import RequirePermission from "@/components/auth/RequirePermission";
import AccountSettings from "@/components/auth/AccountSettings";

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-margin-mobile py-space-xl md:px-margin-desktop">
      <RequirePermission>
        <AccountSettings />
      </RequirePermission>
    </main>
  );
}
