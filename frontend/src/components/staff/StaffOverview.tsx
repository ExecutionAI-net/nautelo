"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";

interface Summary {
  users: number;
  brokers: number;
  providers: number;
  listings: number;
  listings_by_status: Record<string, number>;
  brokers_by_status: Record<string, number>;
  providers_by_status: Record<string, number>;
  suspended_users: number;
  unverified_users: number;
}

const MODULES = [
  { href: "/dashboard/staff/boats/", icon: "directions_boat", title: "Boats", text: "Listing submissions, status and seller details." },
  { href: "/dashboard/staff/users/", icon: "person", title: "Users", text: "Accounts, roles, verification and freezes." },
  { href: "/dashboard/staff/brokers/", icon: "handshake", title: "Brokers", text: "Broker organisations, approval policy and audit history." },
  { href: "/dashboard/staff/providers/", icon: "handyman", title: "Service providers", text: "Professional profiles and activation." },
  { href: "/dashboard/staff/service-requests/", icon: "assignment", title: "Requests", text: "Service enquiries sent to professionals." },
  { href: "/dashboard/staff/leads/", icon: "trending_up", title: "Leads", text: "Buyer enquiries across listings and brokers." },
  { href: "/dashboard/staff/subscriptions/", icon: "payments", title: "Subscriptions", text: "Listing rights and entitlements." },
  { href: "/dashboard/staff/advertising/", icon: "campaign", title: "Advertising", text: "Sponsored placements and creatives." },
  { href: "/dashboard/staff/content/", icon: "article", title: "Guides", text: "Editorial guides and publishing." },
  { href: "/dashboard/staff/taxonomy/", icon: "category", title: "Taxonomy", text: "Brands, models and the other-model queue." },
  { href: "/dashboard/staff/reports/", icon: "analytics", title: "Reports", text: "Growth and inventory analytics." },
  { href: "/dashboard/staff/settings/", icon: "tune", title: "Settings", text: "Listing rules, media allowances and pricing." },
];

export default function StaffOverview({ pending }: { pending: number | null }) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    apiFetch<Summary>("/api/v1/staff/reports/").then(setSummary, () => setSummary(null));
  }, []);

  const published = summary?.listings_by_status.PUBLISHED ?? 0;
  const ribbon = summary
    ? [
        {
          href: "/dashboard/staff/boats/",
          label: "Boats for moderation",
          badge: pending !== null ? `${pending} pending` : null,
          value: summary.listings,
          unit: "Total listings",
          lines: [`${published} published`, `${summary.listings_by_status.PENDING_APPROVAL ?? 0} awaiting approval`],
        },
        {
          href: "/dashboard/staff/users/",
          label: "Registered users",
          badge: null,
          value: summary.users,
          unit: "",
          lines: [`${summary.unverified_users} unverified`, `${summary.suspended_users} suspended`],
        },
        {
          href: "/dashboard/staff/brokers/",
          label: "Brokers & dealerships",
          badge: summary.brokers_by_status.PENDING ? `${summary.brokers_by_status.PENDING} in queue` : null,
          value: summary.brokers,
          unit: "Brokers",
          lines: [`${summary.brokers_by_status.ACTIVE ?? 0} active partners`, `${summary.brokers_by_status.SUSPENDED ?? 0} suspended`],
        },
        {
          href: "/dashboard/staff/providers/",
          label: "Service providers",
          badge: summary.providers_by_status.PENDING ? `${summary.providers_by_status.PENDING} in queue` : null,
          value: summary.providers,
          unit: "",
          lines: [`${summary.providers_by_status.ACTIVE ?? 0} active`, `${summary.providers_by_status.SUSPENDED ?? 0} suspended`],
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-space-xl">
      <section className="bg-surface-container-lowest shadow-sm rounded-xl p-space-xl flex flex-col gap-space-lg">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg">
          <div className="flex flex-col gap-space-xs max-w-4xl">
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">
              <span>Staff Administration</span>
              <span className="text-outline-variant">/</span>
              <span>Marketplace Moderation</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Nauta Staff Dashboard</h1>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Review vessel listings and revisions, and jump to every staff module: users, brokers, service providers, leads, subscriptions and advertising.
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <Link href="/dashboard/staff/reports/" className="inline-flex items-center gap-space-xs bg-surface-container text-primary hover:bg-surface-container-high font-body-md text-body-md px-space-md py-space-sm rounded transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">analytics</span>
              Platform Reports
            </Link>
            <Link href="/dashboard/staff/settings/" className="inline-flex items-center gap-space-xs bg-primary-container text-on-primary hover:bg-primary font-body-md text-body-md px-space-md py-space-sm rounded transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">tune</span>
              Dashboard Settings
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-low p-space-md rounded-lg">
          <div className="flex flex-wrap items-center gap-space-lg text-on-surface-variant font-label-md text-label-md">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
              <span className="font-medium text-primary">Moderation queue online</span>
            </div>
            {pending !== null ? (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[16px]" aria-hidden="true">pending_actions</span>
                <span>
                  Items pending review: <strong className="text-primary font-semibold">{pending}</strong>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {ribbon.length > 0 ? (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md" aria-label="Platform totals">
          {ribbon.map((card) => (
            <Link key={card.label} href={card.href} className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm flex flex-col justify-between gap-space-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant group-hover:text-secondary transition-colors">{card.label}</span>
                {card.badge ? <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">{card.badge}</span> : null}
              </div>
              <div className="flex items-baseline gap-space-xs">
                <span className="font-headline-lg text-headline-lg text-primary">{card.value.toLocaleString("en")}</span>
                {card.unit ? <span className="font-body-md text-body-md text-on-surface-variant">{card.unit}</span> : null}
              </div>
              <div className="text-on-surface-variant font-body-sm text-body-sm flex flex-col gap-0.5">
                <span>{card.lines[0]}</span>
                <span className="text-secondary font-medium">{card.lines[1]}</span>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden flex flex-col">
        <div className="p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-b border-surface-container">
          <div>
            <div className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Overview &amp; Management</div>
            <h2 className="font-headline-sm text-headline-sm text-primary">Staff Management Modules</h2>
          </div>
        </div>
        <div className="p-space-lg grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-space-md">
          {MODULES.map((module) => (
            <Link key={module.href} href={module.href} className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col gap-1">
              <span className="material-symbols-outlined text-secondary text-[22px]" aria-hidden="true">{module.icon}</span>
              <span className="font-title-lg text-title-lg text-primary mt-1">{module.title}</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{module.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
