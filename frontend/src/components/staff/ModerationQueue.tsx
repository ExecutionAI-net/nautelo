"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  QUEUE_TABS,
  fetchModerationQueue,
  setSuspension,
  type QueueResponse,
  type QueueRow,
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
  const [reload, setReload] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

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
  }, [tab, reload]);

  async function toggleSuspension(row: QueueRow) {
    const suspend = row.listing_status !== "SUSPENDED";
    const reason = window.prompt(suspend ? "Reason for suspension" : "Reason for reinstating");
    if (!reason?.trim()) return;
    setActionError(null);
    try {
      await setSuspension(row.listing_id, suspend ? "suspend" : "unsuspend", reason);
      setReload((n) => n + 1);
    } catch {
      setActionError("The change could not be saved.");
    }
  }

  const current = data?.tab === tab ? data.body : null;
  const counts = data?.body.counts;

  return (
    <section>
      <span className="font-label-sm uppercase tracking-widest text-secondary">Moderation / Registry control</span>
      <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">Moderation queue</h1>
      {counts ? (
        <dl className="mt-space-md grid grid-cols-2 gap-space-md lg:grid-cols-5" aria-label="Queue totals">
          {QUEUE_TABS.map((key) => (
            <div key={key} className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
              <dt className="font-label-sm uppercase tracking-wider text-on-surface-variant">{TAB_LABEL[key]}</dt>
              <dd className="mt-space-xs font-headline-lg text-headline-lg text-primary">{counts[key]}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-space-md">
        <Link href="/dashboard/staff/taxonomy/" className="font-body-md text-primary underline">
          Other-model queue
        </Link>
        {" · "}
        <Link href="/dashboard/staff/entitlements/" className="font-body-md text-primary underline">
          Entitlement ledger
        </Link>
      </p>
      <div role="tablist" aria-label="Queue tabs" className="mt-space-md flex flex-wrap gap-space-sm">
        {QUEUE_TABS.map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-space-md py-space-xs font-label-md ${
              tab === key ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
            }`}
          >
            {TAB_LABEL[key]}
            {counts ? ` (${counts[key]})` : ""}
          </button>
        ))}
      </div>

      {actionError ? (
        <p role="alert" className="mt-space-sm">
          {actionError}
        </p>
      ) : null}
      {failed === tab && !current ? (
        <p role="alert" className="mt-space-md font-body-md">
          The queue could not be loaded.
        </p>
      ) : !current ? (
        <p className="mt-space-md font-body-md text-on-surface-variant">Loading…</p>
      ) : current.results.length === 0 ? (
        <p className="mt-space-md font-body-md text-on-surface-variant">Nothing in this queue.</p>
      ) : (
        <ul className="mt-space-md flex flex-col divide-y divide-outline-variant overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
          {current.results.map((row) => (
            <li
              key={`${row.kind}-${row.id}`}
              className="flex flex-wrap items-center justify-between gap-space-sm p-space-md hover:bg-surface-container-low"
            >
              <div>
              <p className="font-title-sm text-title-sm text-on-surface">
                {row.year} {row.brand} {row.is_other_model ? row.custom_model_name || "Other" : row.model}
              </p>
              <p className="font-body-sm text-on-surface-variant">
                {row.seller} · {row.seller_type}
                {row.waiting_seconds !== null ? ` · waiting ${waitLabel(row.waiting_seconds)}` : ""}
                {row.is_other_model ? " · Other model" : ""}
              </p>
              </div>
              {row.kind === "revision" ? (
                <Link
                  href={`/dashboard/staff/revisions/${row.id}/`}
                  className="font-body-md text-primary underline"
                >
                  Review
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void toggleSuspension(row)}
                  className="font-body-md text-primary underline"
                >
                  {row.listing_status === "SUSPENDED" ? "Reinstate" : "Suspend"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
