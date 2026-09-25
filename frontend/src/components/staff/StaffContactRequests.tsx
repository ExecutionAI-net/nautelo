"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";

export interface ContactRequestRow {
  id: string;
  reference: string;
  topic: string;
  topic_label: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  details: Record<string, unknown>;
  reply_language: string;
  status: "NEW" | "IN_PROGRESS" | "HANDLED";
  notes: string;
  handled_by_email: string | null;
  handled_at: string | null;
  created_at: string;
}

interface Page {
  count: number;
  next: string | null;
  previous: string | null;
  results: ContactRequestRow[];
  facets?: Record<string, number>;
}

const STATUSES: ContactRequestRow["status"][] = ["NEW", "IN_PROGRESS", "HANDLED"];
const STATUS_LABEL: Record<ContactRequestRow["status"], string> = { NEW: "New", IN_PROGRESS: "In progress", HANDLED: "Handled" };
const PILL: Record<ContactRequestRow["status"], string> = {
  NEW: "bg-amber-100 text-amber-900",
  IN_PROGRESS: "bg-secondary-container text-on-secondary-container",
  HANDLED: "bg-emerald-50 text-emerald-800",
};
const TOPICS = ["general", "buying", "selling", "brokers", "services", "financing", "press"];
const CHIP = "px-3 py-1 rounded font-label-md";

function detailLines(details: Record<string, unknown>): string[] {
  return Object.entries(details).map(([key, value]) => {
    const text = value && typeof value === "object" ? Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}=${String(v)}`).join(", ") : String(value);
    return `${key}: ${text}`;
  });
}

/** Every public form submission (contact page, financing study) with the team's notes on what was done. */
export default function StaffContactRequests() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [selected, setSelected] = useState<ContactRequestRow | null>(null);
  const [notes, setNotes] = useState("");
  const [draftStatus, setDraftStatus] = useState<ContactRequestRow["status"]>("NEW");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (topic) params.set("topic", topic);
    try {
      setData(await apiFetch<Page>(`/api/v1/staff/contact-requests/?${params.toString()}`));
      setError(null);
    } catch {
      setError("The list could not be loaded.");
    }
  }, [page, q, status, topic]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial and filter-driven fetch
    void load();
  }, [load]);

  function open(row: ContactRequestRow) {
    setSelected(row);
    setNotes(row.notes);
    setDraftStatus(row.status);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await apiFetch<ContactRequestRow>(`/api/v1/staff/contact-requests/${selected.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: draftStatus, notes }),
      });
      setSelected(updated);
      setError(null);
      await load();
    } catch {
      setError("The change could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const facets = data?.facets ?? {};
  const total = Object.values(facets).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-space-xl">
      <div className="flex flex-col gap-space-xs max-w-3xl">
        <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold bg-surface-container px-2.5 py-1 rounded self-start">Staff / Contact requests</span>
        <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Contact requests</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Everything sent through the contact page and the financing study form. Note what was done so the team does not answer twice.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {[["Total", total], ...STATUSES.map((s) => [STATUS_LABEL[s], facets[s] ?? 0] as const)].map(([label, n]) => (
          <div key={String(label)} className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
            <span className="font-label-md uppercase text-on-surface-variant mb-2">{label}</span>
            <span className="font-headline-md text-headline-md text-primary font-semibold">{data ? Number(n).toLocaleString("en") : "-"}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        <div className={`${selected ? "xl:col-span-7" : "xl:col-span-12"} flex flex-col gap-space-md`}>
          <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col gap-space-md">
            <input
              className="w-full px-4 py-2.5 bg-surface rounded text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-low"
              placeholder="Search name, e-mail, phone or message"
              aria-label="Search"
              value={q}
              onChange={(event) => {
                setPage(1);
                setQ(event.target.value);
              }}
            />
            <div className="flex flex-wrap items-center gap-space-xs text-body-sm">
              <span className="font-label-sm uppercase text-on-surface-variant mr-2">Status:</span>
              {[["", "All"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])].map(([value, label]) => (
                <button
                  key={value || "all"}
                  type="button"
                  aria-pressed={status === value}
                  onClick={() => {
                    setPage(1);
                    setStatus(value);
                  }}
                  className={`${CHIP} ${status === value ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface"}`}
                >
                  {label}
                  {value && data ? ` (${(facets[value] ?? 0).toLocaleString("en")})` : ""}
                </button>
              ))}
              <div className="w-px h-4 bg-outline-variant mx-1 hidden sm:block" />
              <label className="font-label-sm uppercase text-on-surface-variant mr-2" htmlFor="contact-topic">
                Topic:
              </label>
              <select
                id="contact-topic"
                value={topic}
                onChange={(event) => {
                  setPage(1);
                  setTopic(event.target.value);
                }}
                className="rounded bg-surface-container px-3 py-1 font-label-md text-on-surface"
              >
                <option value="">All topics</option>
                {TOPICS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? <p role="alert" className="text-error font-body-sm">{error}</p> : null}

          <div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">From</th>
                    <th className="py-3 px-4">Topic</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Received</th>
                    <th className="py-3 px-4">Handled by</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {data?.results.map((row) => (
                    <tr key={row.id} className={`hover:bg-surface-container-low/50 transition-colors ${selected?.id === row.id ? "bg-tertiary-fixed/30" : ""}`}>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col min-w-0">
                          <span className="font-title-md text-primary font-semibold truncate">{row.name}</span>
                          <span className="text-body-sm text-on-surface-variant truncate">
                            {row.email}
                            {row.phone ? ` · ${row.phone}` : ""}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-on-surface-variant">{row.topic_label}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-medium ${PILL[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-on-surface-variant">{row.created_at.slice(0, 10)}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-on-surface-variant">{row.handled_by_email ?? "-"}</td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button type="button" className="text-secondary hover:text-primary font-title-md text-body-sm px-2 py-1" onClick={() => open(row)}>
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data && data.results.length === 0 ? (
                    <tr>
                      <td className="py-space-md px-4 text-on-surface-variant" colSpan={6}>
                        No requests.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="px-space-md py-space-sm bg-surface-container-low flex items-center justify-between gap-space-sm text-body-sm text-on-surface-variant">
              <span>{data ? `${data.count.toLocaleString("en")} requests` : " "}</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={!data?.previous} className="px-2.5 py-1 rounded bg-surface text-on-surface hover:bg-surface-container-highest disabled:opacity-50" onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span className="w-7 h-7 rounded bg-primary text-on-primary font-semibold flex items-center justify-center">{page}</span>
                <button type="button" disabled={!data?.next} className="px-2.5 py-1 rounded bg-surface text-on-surface hover:bg-surface-container-highest disabled:opacity-50" onClick={() => setPage(page + 1)}>
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {selected ? (
          <aside aria-label="Request details" className="xl:col-span-5 bg-surface-container-lowest rounded shadow-md p-space-lg flex flex-col gap-space-md">
            <div className="flex items-start justify-between bg-surface-container-low -mx-space-lg -mt-space-lg p-space-md">
              <div className="flex flex-col">
                <span className="font-label-sm uppercase tracking-wider text-secondary font-semibold">
                  {selected.reference} · {selected.topic_label}
                </span>
                <h2 className="font-headline-sm text-headline-sm text-primary">{selected.name}</h2>
                <span className="font-body-sm text-on-surface-variant">
                  <a className="underline" href={`mailto:${selected.email}`}>
                    {selected.email}
                  </a>
                  {selected.phone ? (
                    <>
                      {" · "}
                      <a className="underline" href={`tel:${selected.phone.replace(/\s+/g, "")}`}>
                        {selected.phone}
                      </a>
                    </>
                  ) : null}
                  {" · "}
                  {selected.reply_language}
                </span>
              </div>
              <button type="button" aria-label="Close" onClick={() => setSelected(null)} className="w-8 h-8 rounded-full hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            </div>
            <div>
              <span className="font-label-sm uppercase text-on-surface-variant">Message</span>
              <p className="mt-1 whitespace-pre-wrap font-body-md text-on-surface">{selected.message || "-"}</p>
            </div>
            {Object.keys(selected.details).length > 0 ? (
              <div>
                <span className="font-label-sm uppercase text-on-surface-variant">Details</span>
                <ul className="mt-1 font-body-sm text-on-surface-variant">
                  {detailLines(selected.details).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="font-body-sm text-on-surface-variant">
              Received {selected.created_at.slice(0, 10)}
              {selected.handled_at ? ` · handled ${selected.handled_at.slice(0, 10)} by ${selected.handled_by_email ?? "staff"}` : ""}
            </p>
            <label className="font-label-sm uppercase text-on-surface-variant" htmlFor="contact-status">
              Status
              <select id="contact-status" value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as ContactRequestRow["status"])} className="mt-1 block w-full rounded bg-surface px-3 py-2 font-body-md normal-case text-on-surface">
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-label-sm uppercase text-on-surface-variant" htmlFor="contact-notes">
              What was done
              <textarea
                id="contact-notes"
                rows={5}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Calls made, answer sent, next step..."
                className="mt-1 block w-full rounded bg-surface p-space-sm font-body-sm normal-case text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-low"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="w-full bg-primary text-on-primary hover:bg-primary-container disabled:opacity-50 font-title-md text-body-sm py-2.5 rounded transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
