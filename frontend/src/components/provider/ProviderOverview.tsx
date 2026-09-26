"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useState } from "react";

import { fetchConversations, type ConversationRow } from "@/lib/api/conversations";
import { fetchProviderProfile, fetchProviderServices, type ProviderProfile, type ProviderService } from "@/lib/api/provider";
import UnpaidNotice from "@/components/provider/UnpaidNotice";

interface State {
  profile: ProviderProfile | null;
  services: ProviderService[];
  requests: ConversationRow[];
  total: number;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-secondary-container/40 text-on-secondary-container",
  PENDING: "bg-amber-100 text-amber-900",
  DRAFT: "bg-surface-container-highest text-primary",
  SUSPENDED: "bg-error-container text-on-error-container",
};

export default function ProviderOverview() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchProviderProfile(),
      fetchProviderServices().catch(() => [] as ProviderService[]),
      fetchConversations("ALL").catch(() => ({ count: 0, results: [] as ConversationRow[] })),
    ]).then(
      ([profile, services, conversations]) =>
        setState({ profile, services, requests: conversations.results.slice(0, 4), total: conversations.count }),
      () => setError(true),
    );
  }, []);

  const unread = state?.requests.reduce((sum, row) => sum + row.unread_count, 0) ?? 0;
  const activeServices = state?.services.filter((service) => service.is_active).length ?? 0;
  const status = state?.profile?.status ?? "DRAFT";

  const kpis = state
    ? [
        { label: "Profile status", value: state.profile ? status : "Not created", note: "Visible to buyers once active", icon: "verified", href: "/dashboard/service-provider/profile/" },
        { label: "Active services", value: String(activeServices), note: `${state.services.length} services on file`, icon: "handyman", href: "/dashboard/service-provider/services/" },
        { label: "Inbound requests", value: String(state.total), note: `${unread} unread`, icon: "assignment_turned_in", href: "/dashboard/service-provider/requests/" },
        { label: "Service area", value: String(state.profile?.service_area.length ?? 0), note: (state.profile?.service_area ?? []).slice(0, 3).join(", ") || "Not set", icon: "location_on", href: "/dashboard/service-provider/profile/" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-space-xl">
      {error ? <p role="alert">The dashboard could not be loaded.</p> : null}
      <UnpaidNotice status={state?.profile?.status} />

      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
        <div className="max-w-3xl flex flex-col gap-space-xs">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Service provider / Dashboard</span>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Dashboard</h1>
          {state?.profile?.display_name ? <p className="font-body-md text-on-surface-variant">{state.profile.display_name}</p> : null}
          {state?.profile?.short_description ? (
            <p className="font-body-lg text-body-lg text-on-surface-variant">{state.profile.short_description}</p>
          ) : null}
          {state?.profile ? (
            <div className="flex flex-wrap items-center gap-space-sm mt-space-xs">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-label-md text-label-md ${STATUS_STYLE[status] ?? STATUS_STYLE.DRAFT}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                {status}
              </span>
              {state.profile.city ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-highest text-primary font-label-md text-label-md">
                  <span className="material-symbols-outlined text-[16px] text-secondary" aria-hidden="true">location_on</span>
                  {[state.profile.city, state.profile.country_code].filter(Boolean).join(", ")}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-space-sm shrink-0">
          <Link href="/dashboard/service-provider/services/" className="px-space-lg py-space-sm bg-primary-container text-on-primary hover:bg-primary font-body-md text-body-md rounded-lg shadow-md transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add_circle</span>
            Add a service
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between gap-space-md hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">{kpi.label}</span>
              <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{kpi.icon}</span>
              </div>
            </div>
            <div>
              <span className="font-headline-lg text-headline-lg text-primary">{kpi.value}</span>
              <p className="font-body-sm text-body-sm text-secondary font-medium mt-1">{kpi.note}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
        <section className="lg:col-span-8 flex flex-col gap-space-md" aria-labelledby="rfq-heading">
          <div className="flex items-center justify-between">
            <h2 id="rfq-heading" className="font-headline-sm text-headline-sm text-primary">Inbound requests</h2>
            <Link href="/dashboard/service-provider/requests/" className="font-label-md text-secondary hover:underline">
              Open inbox
            </Link>
          </div>
          {state && state.requests.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm font-body-md text-on-surface-variant">No requests yet.</div>
          ) : null}
          {(state?.requests ?? []).map((row) => (
            <Link
              key={row.id}
              href={`/dashboard/service-provider/requests/${row.id}/`}
              className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-shadow flex items-start justify-between gap-space-md"
            >
              <span className="min-w-0">
                <span className="block font-title-md text-title-md text-primary">{row.counterparty_name || row.subject}</span>
                <span className="block font-body-sm text-on-surface-variant truncate">{row.last_message_excerpt || row.subject}</span>
              </span>
              {row.unread_count > 0 ? <span className="rounded-full bg-secondary px-2 py-0.5 font-label-sm text-on-secondary">{row.unread_count} new</span> : null}
            </Link>
          ))}
        </section>

        <aside className="lg:col-span-4 flex flex-col gap-space-md" aria-labelledby="catalogue-heading">
          <div className="flex items-center justify-between">
            <h2 id="catalogue-heading" className="font-headline-sm text-headline-sm text-primary">Service catalogue</h2>
            <Link href="/dashboard/service-provider/services/" className="font-label-md text-secondary hover:underline">
              Manage
            </Link>
          </div>
          <ul className="bg-surface-container-lowest rounded-xl shadow-sm divide-y divide-surface-container">
            {(state?.services ?? []).slice(0, 6).map((service) => (
              <li key={service.id} className="flex items-center justify-between gap-space-sm p-space-md">
                <span className="font-body-md text-primary truncate">{service.title_en}</span>
                <span className={`px-2 py-0.5 rounded-full font-label-sm ${service.is_active ? "bg-emerald-50 text-emerald-800" : "bg-surface-container text-on-surface-variant"}`}>
                  {service.is_active ? "Active" : "Hidden"}
                </span>
              </li>
            ))}
            {state && state.services.length === 0 ? <li className="p-space-md font-body-md text-on-surface-variant">No services yet.</li> : null}
          </ul>
        </aside>
      </div>
    </div>
  );
}
