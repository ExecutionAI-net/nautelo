"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";

interface Report {
  users: number;
  brokers: number;
  providers: number;
  listings: number;
  conversations: number;
  entitlements: number;
  users_by_role: Record<string, number>;
  listings_by_status: Record<string, number>;
  listings_by_seller_type: Record<string, number>;
  brokers_by_status: Record<string, number>;
  providers_by_status: Record<string, number>;
  monthly: { month: string; users: number; listings: number; conversations: number }[];
  new_users_30d: number;
  new_users_prev_30d: number;
  new_listings_30d: number;
  new_conversations_30d: number;
  suspended_users: number;
  unverified_users: number;
}

const SERIES = [
  { key: "users", label: "New users", fill: "#001520", dot: "bg-primary" },
  { key: "listings", label: "New listings", fill: "#00696e", dot: "bg-secondary" },
  { key: "conversations", label: "Conversations", fill: "#496171", dot: "bg-surface-tint" },
] as const;
const DONUT = ["#001520", "#00696e", "#496171", "#e3c286"];
const DOT = ["bg-primary", "bg-secondary", "bg-surface-tint", "bg-tertiary-fixed-dim"];

function growth(now: number, before: number): string {
  if (before === 0) return now > 0 ? "new" : "0%";
  const pct = ((now - before) / before) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function monthLabel(key: string): string {
  return new Date(`${key}-01T00:00:00`).toLocaleString("en", { month: "short", year: "numeric" });
}

function label(key: string): string {
  return key.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function StaffReports() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch<Report>("/api/v1/staff/reports/").then(setReport, () => setError(true));
  }, []);

  if (error) return <p role="alert">The report could not be loaded.</p>;
  if (!report) return <p className="font-body-md text-on-surface-variant">Loading report…</p>;

  const kpis = [
    { title: "Registered users", value: report.users, delta: growth(report.new_users_30d, report.new_users_prev_30d), note: `${report.new_users_30d} joined in the last 30 days`, icon: "group" },
    { title: "Boat listings", value: report.listings, delta: `+${report.new_listings_30d} / 30d`, note: `${report.listings_by_status.PUBLISHED ?? 0} published`, icon: "anchor" },
    { title: "Conversations", value: report.conversations, delta: `+${report.new_conversations_30d} / 30d`, note: "Buyer enquiries and messages", icon: "mail" },
    { title: "Directory", value: report.brokers + report.providers, delta: `${report.brokers} brokers`, note: `${report.providers} service providers`, icon: "storefront" },
  ];

  const maxBar = Math.max(1, ...report.monthly.flatMap((m) => [m.users, m.listings, m.conversations]));
  const sellerTotal = Object.values(report.listings_by_seller_type).reduce((a, b) => a + b, 0) || 1;
  const sellerRows = Object.entries(report.listings_by_seller_type).sort((a, b) => b[1] - a[1]);
  const arcs = sellerRows.map(([key, value], index) => ({
    key,
    length: (value / sellerTotal) * 377,
    start: sellerRows.slice(0, index).reduce((sum, [, n]) => sum + (n / sellerTotal) * 377, 0),
  }));

  const tables: [string, Record<string, number>][] = [
    ["Users by role", report.users_by_role],
    ["Listings by status", report.listings_by_status],
    ["Brokers by status", report.brokers_by_status],
    ["Service providers by status", report.providers_by_status],
  ];

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="relative overflow-hidden bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl shadow-sm">
        <div className="absolute -right-20 -top-24 w-96 h-96 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
          <div className="max-w-3xl flex flex-col gap-space-xs">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">Staff / Reports</span>
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Reports</h1>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Supervise registrations, listing inventory, enquiry volume and account health across the platform.
            </p>
          </div>
          <div className="bg-surface-container-low rounded-lg p-space-md flex items-center gap-space-md shrink-0 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-secondary-fixed-dim text-on-secondary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">verified_user</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Account health</span>
              <span className="font-title-md text-title-md text-primary font-semibold">{report.suspended_users} suspended</span>
              <span className="font-body-sm text-body-sm text-secondary font-medium">{report.unverified_users} unverified</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">{kpi.title}</span>
              <span className="p-1.5 rounded-full bg-surface-container text-primary material-symbols-outlined text-[18px]" aria-hidden="true">{kpi.icon}</span>
            </div>
            <div className="my-space-sm flex flex-col">
              <div className="flex items-baseline gap-space-xs">
                <span className="font-headline-lg text-headline-lg text-primary tracking-tight">{kpi.value.toLocaleString("en")}</span>
                <span className="font-label-md text-label-md text-secondary font-medium">{kpi.delta}</span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{kpi.note}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
          <div className="mb-space-md">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
              <h2 className="font-headline-sm text-headline-sm text-primary">Activity (last 6 months)</h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">New users, new listings and conversations per month</p>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-space-lg">
            {SERIES.map((serie) => (
              <div key={serie.key} className="bg-surface-container-low p-2.5 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${serie.dot}`} />
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{serie.label}</span>
                </div>
                <span className="font-spec-num text-spec-num text-primary font-semibold block mt-0.5">
                  {report.monthly.reduce((sum, m) => sum + m[serie.key], 0).toLocaleString("en")}
                </span>
              </div>
            ))}
          </div>
          <div className="w-full h-72 relative flex items-end">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 740 240" role="img" aria-label="Monthly activity">
              {[40, 100, 160, 220].map((y) => (
                <line key={y} x1="0" x2="740" y1={y} y2={y} stroke="#e4e2dd" strokeWidth="1" />
              ))}
              {report.monthly.map((m, index) => (
                <g key={m.month} transform={`translate(${30 + index * 118}, 0)`}>
                  {SERIES.map((serie, position) => {
                    const height = (m[serie.key] / maxBar) * 190;
                    return <rect key={serie.key} x={position * 30} y={220 - height} width="26" height={height} rx="3" fill={serie.fill} />;
                  })}
                </g>
              ))}
            </svg>
          </div>
          <div className="grid grid-cols-6 pt-space-xs text-center font-label-md text-label-md text-on-surface-variant font-medium">
            {report.monthly.map((m, index) => (
              <span key={m.month} className={index === report.monthly.length - 1 ? "text-primary font-bold" : ""}>
                {monthLabel(m.month)}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">Inventory mix</span>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]" aria-hidden="true">public</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-primary">Listings by seller type</h2>
          </div>
          <div className="relative w-48 h-48 mx-auto my-space-md flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160" role="img" aria-label="Listings by seller type">
              {arcs.map((arc, index) => (
                <circle key={arc.key} cx="80" cy="80" r="60" fill="transparent" stroke={DONUT[index % DONUT.length]} strokeWidth="20" strokeDasharray={`${arc.length} 377`} strokeDashoffset={-arc.start} />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="font-spec-num text-spec-num font-bold text-primary">{report.listings.toLocaleString("en")}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Listings</span>
            </div>
          </div>
          <div className="flex flex-col gap-space-xs">
            {sellerRows.map(([key, value], index) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${DOT[index % DOT.length]}`} />
                  <span className="font-body-sm text-body-sm text-primary font-medium">{label(key)}</span>
                </div>
                <div className="text-right">
                  <span className="font-spec-num text-spec-num font-semibold text-primary">{Math.round((value / sellerTotal) * 100)}%</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant block">{value.toLocaleString("en")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
        {tables.map(([title, rows]) => (
          <div key={title} className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
            <h2 className="p-space-md font-headline-sm text-headline-sm text-primary">{title}</h2>
            <table className="w-full text-left text-body-sm">
              <thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {Object.entries(rows).map(([key, value]) => (
                  <tr key={key} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-4 text-primary font-medium">{label(key)}</td>
                    <td className="py-3 px-4 text-right font-spec-num font-semibold text-primary">{value.toLocaleString("en")}</td>
                  </tr>
                ))}
                {Object.keys(rows).length === 0 ? (
                  <tr>
                    <td className="py-3 px-4 text-on-surface-variant" colSpan={2}>No data yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
