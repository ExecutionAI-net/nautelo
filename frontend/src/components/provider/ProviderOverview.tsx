"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchConversations } from "@/lib/api/conversations";
import { fetchProviderProfile, fetchProviderServices, type ProviderProfile } from "@/lib/api/provider";

export default function ProviderOverview() {
  const [state, setState] = useState<{ profile: ProviderProfile | null; services: number; open: number } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchProviderProfile(),
      fetchProviderServices().catch(() => []),
      fetchConversations("ALL").catch(() => ({ count: 0 })),
    ]).then(
      ([profile, services, conversations]) =>
        setState({ profile, services: services.length, open: conversations.count }),
      () => setError(true),
    );
  }, []);

  const cards = state
    ? [
        { label: "Profile status", value: state.profile?.status ?? "Not created", href: "/dashboard/service-provider/profile/" },
        { label: "Services", value: String(state.services), href: "/dashboard/service-provider/services/" },
        { label: "Requests", value: String(state.open), href: "/dashboard/service-provider/requests/" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg text-primary">Provider dashboard</h1>
      {error ? <p role="alert">The dashboard could not be loaded.</p> : null}
      <div className="grid gap-space-md sm:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm hover:shadow-md">
            <p className="font-label-sm uppercase text-on-surface-variant">{card.label}</p>
            <p className="mt-1 font-headline-md text-headline-md text-primary">{card.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
