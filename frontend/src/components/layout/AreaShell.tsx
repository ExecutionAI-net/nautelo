import Link from "next/link";

import DashboardSidebar, { type MenuGroup } from "@/components/layout/DashboardSidebar";

type Tab = { href: string; label: string };

const AREAS = {
  seller: {
    eyebrow: "Seller area",
    title: "Your account",
    tabs: [
      { href: "/dashboard/private-seller/", label: "Overview" },
      { href: "/dashboard/private-seller/listings/", label: "My listings" },
      { href: "/dashboard/private-seller/messages/", label: "Enquiries & messages" },
      { href: "/dashboard/private-seller/services/", label: "Services" },
      { href: "/dashboard/private-seller/account/", label: "My account" },
    ] as Tab[],
    cta: { href: "/sell/create/", label: "Create new listing" },
  },
  broker: {
    eyebrow: "Brokerage area",
    title: "Broker workspace",
    tabs: [
      { href: "/dashboard/broker/", label: "Dashboard" },
      { href: "/dashboard/broker/fleet/", label: "Fleet" },
      { href: "/dashboard/broker/leads/", label: "Leads" },
      { href: "/dashboard/broker/messages/", label: "Messages" },
      { href: "/dashboard/broker/team/", label: "Team" },
      { href: "/dashboard/broker/profile/", label: "Profile" },
      { href: "/dashboard/broker/subscription/", label: "Subscription" },
    ] as Tab[],
    cta: { href: "/dashboard/broker/fleet/", label: "Add to fleet" },
  },
  provider: {
    eyebrow: "Service provider area",
    title: "Provider workspace",
    tabs: [
      { href: "/dashboard/service-provider/", label: "Dashboard" },
      { href: "/dashboard/service-provider/requests/", label: "Requests" },
      { href: "/dashboard/service-provider/services/", label: "Services" },
      { href: "/dashboard/service-provider/profile/", label: "Profile" },
    ] as Tab[],
    cta: null,
  },
  staff: {
    eyebrow: "Staff area",
    title: "Platform administration",
    tabs: [
      { href: "/dashboard/staff/", label: "Moderation" },
      { href: "/dashboard/staff/boats/", label: "Boats" },
      { href: "/dashboard/staff/users/", label: "Users" },
      { href: "/dashboard/staff/brokers/", label: "Brokers" },
      { href: "/dashboard/staff/providers/", label: "Providers" },
      { href: "/dashboard/staff/leads/", label: "Leads" },
      { href: "/dashboard/staff/service-requests/", label: "Service requests" },
      { href: "/dashboard/staff/subscriptions/", label: "Subscriptions" },
      { href: "/dashboard/staff/entitlements/", label: "Entitlements" },
      { href: "/dashboard/staff/taxonomy/", label: "Taxonomy" },
      { href: "/dashboard/staff/advertising/", label: "Advertising" },
      { href: "/dashboard/staff/content/", label: "Content" },
      { href: "/dashboard/staff/reports/", label: "Reports" },
      { href: "/dashboard/staff/settings/", label: "Settings" },
    ] as Tab[],
    cta: null,
  },
};


// Menu sections per area; each entry names a tab above by its label.
const GROUPS: Record<string, [string, string[]][]> = {
  seller: [["Portfolio", ["Overview", "My listings"]], ["Communication", ["Enquiries & messages"]], ["Account", ["Services", "My account"]]],
  broker: [["Workspace", ["Dashboard", "Fleet", "Leads"]], ["Communication", ["Messages"]], ["Organisation", ["Team", "Profile", "Subscription"]]],
  provider: [["Work", ["Dashboard", "Requests"]], ["Business", ["Services", "Profile"]]],
  staff: [["Moderation", ["Moderation", "Boats"]], ["People", ["Users", "Brokers", "Providers"]], ["Sales", ["Leads", "Service requests", "Subscriptions", "Entitlements"]], ["Content", ["Taxonomy", "Advertising", "Content"]], ["System", ["Reports", "Settings"]]],
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
        <div className="bg-surface-container-low py-space-lg">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-space-md px-margin-mobile md:px-margin">
            <div>
              <span className="font-label-sm uppercase tracking-widest text-secondary">{config.eyebrow}</span>
              <p className="mt-1 font-headline-lg text-headline-lg text-primary">{config.title}</p>
            </div>
            {config.cta ? (
              <Link
                href={config.cta.href}
                className="inline-flex items-center rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary hover:bg-primary-container"
              >
                {config.cta.label}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="mx-auto max-w-[1200px] px-margin-mobile py-space-xl md:px-margin">{children}</div>
      </main>
    </div>
  );
}
