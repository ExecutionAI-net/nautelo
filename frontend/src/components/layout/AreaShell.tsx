
import VerifyEmailBanner from "@/components/auth/VerifyEmailBanner";
import DashboardSidebar, { type MenuGroup } from "@/components/layout/DashboardSidebar";

type Tab = { href: string; label: string };

const AREAS = {
  seller: {
    eyebrow: "Seller area",
    tabs: [
      { href: "/dashboard/private-seller/", label: "Overview" },
      { href: "/dashboard/private-seller/listings/", label: "My listings" },
      { href: "/dashboard/private-seller/messages/", label: "Enquiries & messages" },
      { href: "/dashboard/private-seller/services/", label: "Services" },
      { href: "/dashboard/private-seller/account/", label: "My account" },
    ] as Tab[],
  },
  broker: {
    eyebrow: "Brokerage area",
    tabs: [
      { href: "/dashboard/broker/", label: "Dashboard" },
      { href: "/dashboard/broker/fleet/", label: "Fleet" },
      { href: "/dashboard/broker/leads/", label: "Leads" },
      { href: "/dashboard/broker/messages/", label: "Messages" },
      { href: "/dashboard/broker/team/", label: "Team" },
      { href: "/dashboard/broker/profile/", label: "Profile" },
      { href: "/dashboard/broker/subscription/", label: "My plan" },
    ] as Tab[],
  },
  provider: {
    eyebrow: "Service provider area",
    tabs: [
      { href: "/dashboard/service-provider/", label: "Dashboard" },
      { href: "/dashboard/service-provider/requests/", label: "Requests" },
      { href: "/dashboard/service-provider/services/", label: "Services" },
      { href: "/dashboard/service-provider/profile/", label: "Profile" },
      { href: "/dashboard/service-provider/team/", label: "Team" },
      { href: "/dashboard/service-provider/membership/", label: "My plan" },
    ] as Tab[],
  },
  staff: {
    eyebrow: "Staff area",
    tabs: [
      { href: "/dashboard/staff/", label: "Moderation" },
      { href: "/dashboard/staff/boats/", label: "Boats" },
      { href: "/dashboard/staff/users/", label: "Users" },
      { href: "/dashboard/staff/brokers/", label: "Brokers" },
      { href: "/dashboard/staff/providers/", label: "Providers" },
      { href: "/dashboard/staff/leads/", label: "Leads" },
      { href: "/dashboard/staff/service-requests/", label: "Service requests" },
      { href: "/dashboard/staff/subscriptions/", label: "Subscriptions" },
      { href: "/dashboard/staff/purchases/", label: "Purchases" },
      { href: "/dashboard/staff/entitlements/", label: "Entitlements" },
      { href: "/dashboard/staff/contact-grants/", label: "Contact grants" },
      { href: "/dashboard/staff/taxonomy/", label: "Taxonomy" },
      { href: "/dashboard/staff/advertising/", label: "Advertising" },
      { href: "/dashboard/staff/content/", label: "Content" },
      { href: "/dashboard/staff/email-templates/", label: "Email templates" },
      { href: "/dashboard/staff/reports/", label: "Reports" },
      { href: "/dashboard/staff/settings/", label: "Settings" },
    ] as Tab[],
  },
};


// Menu sections per area; each entry names a tab above by its label.
const GROUPS: Record<string, [string, string[]][]> = {
  seller: [["Portfolio", ["Overview", "My listings"]], ["Communication", ["Enquiries & messages"]], ["Account", ["Services", "My account"]]],
  broker: [["Workspace", ["Dashboard", "Fleet", "Leads"]], ["Communication", ["Messages"]], ["Organisation", ["Team", "Profile", "My plan"]]],
  provider: [["Work", ["Dashboard", "Requests"]], ["Business", ["Services", "Profile"]], ["Organisation", ["Team", "My plan"]]],
  staff: [["Moderation", ["Moderation", "Boats", "Contact grants"]], ["People", ["Users", "Brokers", "Providers"]], ["Sales", ["Leads", "Service requests", "Subscriptions", "Purchases", "Entitlements"]], ["Content", ["Taxonomy", "Advertising", "Content", "Email templates"]], ["System", ["Reports", "Settings"]]],
};

function menuGroups(area: string, tabs: Tab[]): MenuGroup[] {
  return (GROUPS[area] ?? []).map(([title, labels]) => ({
    title,
    items: labels.flatMap((label) => tabs.filter((tab) => tab.label === label)),
  }));
}

export type AreaKey = keyof typeof AREAS;

export default function AreaShell({
  area,
  active,
  children,
}: {
  area: AreaKey;
  active: string;
  children: React.ReactNode;
}) {
  const config = AREAS[area];
  return (
    <div className="flex w-full flex-col bg-surface lg:min-h-screen lg:flex-row">
      <DashboardSidebar eyebrow={config.eyebrow} groups={menuGroups(area, config.tabs)} active={active} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1200px] px-margin-mobile py-space-xl md:px-margin">
          <VerifyEmailBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
