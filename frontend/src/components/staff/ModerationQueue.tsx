"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  QUEUE_TABS,
  fetchModerationQueue,
  type QueueResponse,
  type QueueTab,
} from "@/lib/api/staffModeration";

const TAB_LABEL: Record<QueueTab, string> = {
  initial: "Initial",
  revisions: "Revisions",
  other_model: "Other model",
  suspended: "Suspended",
  expiring: "Expiring",
};

export function waitLabel(seconds: number | null): string {
  if (seconds === null) return "";
  const hours = Math.floor(seconds / 3600);
  if (hours < 1) return `${Math.max(1, Math.floor(seconds / 60))} min`;
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export default function ModerationQueue() {
  const [tab, setTab] = useState<QueueTab>("initial");
  const [data, setData] = useState<{ tab: QueueTab; body: QueueResponse } | null>(null);
  const [failed, setFailed] = useState<QueueTab | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchModerationQueue(tab)
      .then((body) => {
        if (!cancelled) setData({ tab, body });
      })
      .catch(() => {
        if (!cancelled) setFailed(tab);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const current = data?.tab === tab ? data.body : null;
  const counts = data?.body.counts;

  return (
    <section>
      <h1 className="font-headline-md text-headline-md text-primary">Moderation queue</h1>
      <div role="tablist" aria-label="Queue tabs" className="mt-space-md flex flex-wrap gap-space-sm">
        {QUEUE_TABS.map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg border border-outline-variant px-space-sm py-space-xs font-body-md ${
              tab === key ? "bg-primary text-on-primary" : "text-primary"
            }`}
          >
            {TAB_LABEL[key]}
            {counts ? ` (${counts[key]})` : ""}
          </button>
        ))}
      </div>

      {failed === tab && !current ? (
        <p role="alert" className="mt-space-md font-body-md">
          The queue could not be loaded.
        </p>
      ) : !current ? (
        <p className="mt-space-md font-body-md text-on-surface-variant">Loading…</p>
      ) : current.results.length === 0 ? (
        <p className="mt-space-md font-body-md text-on-surface-variant">Nothing in this queue.</p>
      ) : (
        <ul className="mt-space-md flex flex-col gap-space-sm">
          {current.results.map((row) => (
            <li
              key={`${row.kind}-${row.id}`}
              className="rounded-lg border border-outline-variant p-space-sm"
            >
              <p className="font-title-sm text-title-sm text-on-surface">
                {row.year} {row.brand} {row.is_other_model ? row.custom_model_name || "Other" : row.model}
              </p>
              <p className="font-body-sm text-on-surface-variant">
                {row.seller} · {row.seller_type}
                {row.waiting_seconds !== null ? ` · waiting ${waitLabel(row.waiting_seconds)}` : ""}
                {row.is_other_model ? " · Other model" : ""}
              </p>
              {row.kind === "revision" ? (
                <Link
                  href={`/dashboard/staff/revisions/${row.id}/`}
                  className="font-body-md text-primary underline"
                >
                  Review
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
