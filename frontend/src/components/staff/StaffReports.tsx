"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";

const LABELS: Record<string, string> = {
  users: "Users",
  brokers: "Brokers",
  providers: "Service providers",
  listings: "Boat listings",
  conversations: "Conversations",
  entitlements: "Entitlements",
};

export default function StaffReports() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch<Record<string, number>>("/api/v1/staff/reports/").then(setCounts, () => setError(true));
  }, []);

  return (
    <div className="flex flex-col gap-space-lg">
      <div>
        <span className="font-label-sm uppercase tracking-widest text-secondary">Staff Admin</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">Reports</h1>
      </div>
      {error ? <p role="alert">The report could not be loaded.</p> : null}
      <div className="grid gap-space-md sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(counts ?? {}).map(([key, value]) => (
          <div key={key} className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <p className="font-label-sm uppercase text-on-surface-variant">{LABELS[key] ?? key}</p>
            <p className="mt-1 font-headline-lg text-headline-lg text-primary">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
