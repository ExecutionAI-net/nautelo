import Link from "next/link";

type Tab = { href: string; label: string };

const AREAS = {
  seller: {
    eyebrow: "Seller area",
    title: "Your account",
    tabs: [
      { href: "/dashboard/listings/", label: "My listings" },
      { href: "/dashboard/messages/", label: "Enquiries & messages" },
      { href: "/account/", label: "My account" },
    ] as Tab[],
    cta: { href: "/sell/", label: "Create new listing" },
  },
  broker: {
    eyebrow: "Brokerage area",
    title: "Broker workspace",
    tabs: [
      { href: "/dashboard/broker/", label: "Dashboard" },
      { href: "/fleet/", label: "Fleet inventory" },
      { href: "/dashboard/broker/messages/", label: "Leads & messages" },
    ] as Tab[],
    cta: { href: "/fleet/", label: "Add to fleet" },
  },
  staff: {
    eyebrow: "Staff area",
    title: "Platform administration",
    tabs: [
      { href: "/dashboard/staff/", label: "Moderation" },
      { href: "/dashboard/staff/taxonomy/", label: "Brands & models" },
      { href: "/dashboard/staff/entitlements/", label: "Entitlements" },
      { href: "/settings/", label: "Settings" },
    ] as Tab[],
    cta: null,
  },
};

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
    <main className="w-full bg-surface">
      <div className="bg-surface-container-low pt-space-xl">
        <div className="mx-auto max-w-[1440px] px-margin-mobile md:px-margin lg:px-margin-desktop">
          <div className="flex flex-wrap items-end justify-between gap-space-md">
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
          <nav aria-label={`${config.eyebrow} sections`} className="mt-space-lg flex flex-wrap gap-space-xs">
            {config.tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.href === active ? "page" : undefined}
                className={`rounded-t-lg px-space-md py-space-sm font-label-md ${
                  tab.href === active
                    ? "bg-surface text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin lg:px-margin-desktop">
        {children}
      </div>
    </main>
  );
}
