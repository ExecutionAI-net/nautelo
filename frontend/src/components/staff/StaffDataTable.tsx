"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api/client";

export interface Column {
  key: string;
  label: string;
  /** Sends `?ordering=<sortKey ?? key>` when the header is clicked; the API must whitelist the field. */
  sortable?: boolean;
  sortKey?: string;
  /** Kept out of the table and shown in the details panel only (long identifiers, secondary e-mails). */
  panelOnly?: boolean;
}

/** A row of filter chips; `facets` shows the server-side counts next to each option. */
export interface ChipGroup {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  facets?: boolean;
}

interface Page {
  count: number;
  next: string | null;
  previous: string | null;
  results: Record<string, unknown>[];
  facets?: Record<string, number>;
}

interface Props {
  title: string;
  eyebrow: string;
  description?: string;
  /** Extra explanation under the description, e.g. what each role means. */
  legend?: React.ReactNode;
  endpoint: string;
  columns: Column[];
  statusOptions?: string[];
  /** When the row carries this key, the details panel links to `base + value` (e.g. the revision review screen). */
  reviewLink?: { key: string; base: string; label: string };
  /** A link to the public page of the row, shown when `when(row)` holds (default: always, if the key has a value). */
  publicLink?: { key: string; base: string; label: string; when?: (row: Record<string, unknown>) => boolean };
  groups?: ChipGroup[];
  /** Base path such as /api/v1/staff/providers/; enables Activate/Suspend in the side panel. */
  statusActionsBase?: string;
  /** Base path such as /api/v1/staff/contact-grants/; posts {reason} to `${base}${id}/revoke/` for a row whose status is ACTIVE. One-way: no un-revoke. */
  revokeAction?: { base: string; label?: string; reasonPlaceholder?: string };
  /** Total-card label, e.g. "Total registered users". */
  totalLabel?: string;
  searchPlaceholder?: string;
}

const PILL: Record<string, string> = {
  YES: "bg-emerald-50 text-emerald-800",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  APPROVED: "bg-emerald-50 text-emerald-800",
  PUBLISHED: "bg-emerald-50 text-emerald-800",
  FULFILLED: "bg-emerald-50 text-emerald-800",
  PAID: "bg-emerald-50 text-emerald-800",
  HANDLED: "bg-emerald-50 text-emerald-800",
  OPEN: "bg-emerald-50 text-emerald-800",
  NO: "bg-error-container text-on-error-container",
  SUSPENDED: "bg-error-container text-on-error-container",
  REJECTED: "bg-error-container text-on-error-container",
  FAILED: "bg-error-container text-on-error-container",
  DISPUTED: "bg-error-container text-on-error-container",
  PAST_DUE: "bg-error-container text-on-error-container",
  BLOCKED: "bg-error-container text-on-error-container",
  PENDING: "bg-amber-100 text-amber-900",
  PENDING_APPROVAL: "bg-amber-100 text-amber-900",
  PENDING_REVIEW: "bg-amber-100 text-amber-900",
  UNVERIFIED: "bg-amber-100 text-amber-900",
  TRIALING: "bg-amber-100 text-amber-900",
  IN_PROGRESS: "bg-amber-100 text-amber-900",
  NEW: "bg-amber-100 text-amber-900",
  REVIEW: "bg-amber-100 text-amber-900",
  CHECKOUT_OPEN: "bg-amber-100 text-amber-900",
};

const STATE_KEYS = new Set(["status", "state", "account_state"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;
const ENUM = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$|^[A-Z]{4,}$/;

/** "PENDING_APPROVAL" -> "Pending approval"; short codes such as EUR are left alone. */
export function humanize(value: string): string {
  if (!ENUM.test(value)) return value;
  const words = value.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const DATE_TIME = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function formatDate(value: string, withTime: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return withTime && value.includes("T") ? DATE_TIME.format(date) : DATE.format(date);
}

/** How a value reads in the table; `detail` adds the time to timestamps. */
export function cell(value: unknown, detail = false): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && ISO_DATE.test(value)) return formatDate(value, detail);
  if (typeof value === "string") return humanize(value);
  return String(value);
}

function initials(text: string): string {
  return text
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function rowState(row: Record<string, unknown>): string | null {
  if (typeof row.status === "string") return row.status;
  if (typeof row.is_active === "boolean") return row.is_active ? "ACTIVE" : "SUSPENDED";
  return null;
}

function rowName(row: Record<string, unknown>, primary: Column | undefined): string {
  const value = primary ? row[primary.key] : undefined;
  return typeof value === "string" && value ? value : "this record";
}

const CHIP = "px-3 py-1 rounded font-label-md";

export default function StaffDataTable({
  title,
  eyebrow,
  description,
  legend,
  endpoint,
  columns,
  statusOptions,
  groups,
  statusActionsBase,
  revokeAction,
  totalLabel,
  reviewLink,
  publicLink,
  searchPlaceholder,
}: Props) {
  const chipGroups: ChipGroup[] =
    groups ?? (statusOptions ? [{ param: "status", label: "Status", options: statusOptions.map((value) => ({ value, label: humanize(value) })), facets: true }] : []);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [ordering, setOrdering] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const panelRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (q.trim()) params.set("q", q.trim());
    if (ordering) params.set("ordering", ordering);
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    try {
      setData(await apiFetch<Page>(`${endpoint}?${params.toString()}`));
      setError(null);
    } catch {
      setError("The list could not be loaded.");
    }
  }, [endpoint, page, q, filters, ordering]);

  async function changeStatus(row: Record<string, unknown>, next: "ACTIVE" | "SUSPENDED") {
    const name = rowName(row, columns[0]);
    const question = next === "ACTIVE" ? `Activate ${name}?` : `Suspend ${name}? They lose access until re-activated.`;
    if (!window.confirm(question)) return;
    try {
      await apiFetch(`${statusActionsBase}${String(row.id)}/status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setSelected(null);
      setNotice(`${name} ${next === "ACTIVE" ? "activated" : "suspended"}.`);
      await load();
    } catch {
      setError("The change could not be saved.");
    }
  }

  async function revoke(id: unknown) {
    if (!revokeAction || !reason.trim()) return;
    try {
      await apiFetch(`${revokeAction.base}${String(id)}/revoke/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setSelected(null);
      setReason("");
      setNotice("Access revoked.");
      await load();
    } catch {
      setError("The change could not be saved.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial and filter-driven fetch
    void load();
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear a stale reason when the panel switches rows
    setReason("");
    // Below the xl breakpoint the panel renders under the table: bring it into view so the click visibly did something.
    if (selected && panelRef.current && window.innerWidth < 1280 && typeof panelRef.current.scrollIntoView === "function") {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selected]);

  function toggleSort(column: Column) {
    const key = column.sortKey ?? column.key;
    setPage(1);
    setOrdering((current) => (current === key ? `-${key}` : current === `-${key}` ? "" : key));
  }

  const facets = data?.facets ?? {};
  const facetTotal = Object.values(facets).reduce((sum, n) => sum + n, 0);
  const pageSize = data?.results.length ?? 0;
  const from = data && data.count > 0 ? (page - 1) * 25 + 1 : 0;
  const state = selected ? rowState(selected) : null;
  const tableColumns = columns.filter((column) => !column.panelOnly);
  const [primary, secondary, ...rest] = tableColumns;
  const panelColumns = columns.filter((column) => column !== primary && column !== secondary);
  const showPublic = selected && publicLink && typeof selected[publicLink.key] === "string" && selected[publicLink.key] && (publicLink.when ? publicLink.when(selected) : true);

  function header(column: Column) {
    if (!column.sortable) return column.label;
    const key = column.sortKey ?? column.key;
    const dir = ordering === key ? "asc" : ordering === `-${key}` ? "desc" : null;
    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        aria-label={`Sort by ${column.label}${dir === "asc" ? ", ascending" : dir === "desc" ? ", descending" : ""}`}
        className={`inline-flex items-center gap-0.5 uppercase hover:text-primary ${dir ? "text-primary" : ""}`}
      >
        {column.label}
        {/* normal-case: the header is uppercase, and an uppercased ligature name renders as text ("UNFOLD_MORE"). */}
        <span className="material-symbols-outlined text-[16px] normal-case tracking-normal" aria-hidden="true">
          {dir === "asc" ? "arrow_upward" : dir === "desc" ? "arrow_downward" : "unfold_more"}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-space-xl">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
        <div className="flex flex-col gap-space-xs max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold bg-surface-container px-2.5 py-1 rounded">{eyebrow}</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{title}</h1>
          {description ? <p className="font-body-lg text-body-lg text-on-surface-variant">{description}</p> : null}
          {legend}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        <div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="font-label-md uppercase text-on-surface-variant">{totalLabel ?? "Total records"}</span>
            <div className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[18px]">group</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline-md text-headline-md text-primary font-semibold">{data ? (facetTotal || data.count).toLocaleString("en") : "-"}</span>
          </div>
        </div>
        {chipGroups
          .filter((group) => group.facets)
          .flatMap((group) => group.options.filter((option) => option.value && facets[option.value] !== undefined).slice(0, 3))
          .map((option) => (
            <div key={option.value} className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
              <span className="font-label-md uppercase text-on-surface-variant mb-2">{option.label}</span>
              <span className="font-headline-md text-headline-md text-primary font-semibold">{(facets[option.value] ?? 0).toLocaleString("en")}</span>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        <div className={`${selected ? "xl:col-span-8" : "xl:col-span-12"} flex flex-col gap-space-md`}>
          <div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col gap-space-md">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true">search</span>
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-surface rounded text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-low"
                placeholder={searchPlaceholder ?? "Search"}
                aria-label="Search"
                type="text"
                value={q}
                onChange={(event) => {
                  setPage(1);
                  setQ(event.target.value);
                }}
              />
            </div>
            {chipGroups.length > 0 ? (
              <div className="flex flex-wrap items-center gap-space-xs text-body-sm pt-1">
                {chipGroups.map((group, index) => (
                  <div key={group.param} role="group" aria-label={group.label} className="flex flex-wrap items-center gap-space-xs">
                    {index > 0 ? <div className="w-px h-4 bg-outline-variant mx-1 hidden sm:block" /> : null}
                    <span className="font-label-sm uppercase text-on-surface-variant mr-2">{group.label}:</span>
                    {[{ value: "", label: `All ${group.label.toLowerCase()}${/s$/i.test(group.label) ? "es" : "s"}` }, ...group.options].map((option) => {
                      const active = (filters[group.param] ?? "") === option.value;
                      const count = group.facets ? (option.value ? facets[option.value] : facetTotal) : undefined;
                      const empty = group.facets && option.value !== "" && data !== null && !count;
                      return (
                        <button
                          key={option.value || "all"}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setPage(1);
                            setFilters((current) => ({ ...current, [group.param]: option.value }));
                          }}
                          className={`${CHIP} ${active ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface"} ${empty && !active ? "opacity-50" : ""}`}
                        >
                          {option.label}
                          {count !== undefined && data ? ` (${(count ?? 0).toLocaleString("en")})` : ""}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {error ? <p role="alert" className="font-body-sm text-error">{error}</p> : null}
          {notice ? <p role="status" className="font-body-sm text-primary">{notice}</p> : null}

          <div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{primary ? header(primary) : null}</th>
                    {rest.map((column) => (
                      <th key={column.key} className="py-3 px-4">
                        {header(column)}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {data?.results.map((row, index) => (
                    <tr key={String(row.id ?? index)} className={`hover:bg-surface-container-low/50 transition-colors ${selected?.id === row.id ? "bg-tertiary-fixed/30" : ""}`}>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div aria-hidden="true" className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-title-md text-body-sm shrink-0">
                            {initials(cell(row[primary.key]))}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-title-md text-primary font-semibold truncate">{cell(row[primary.key])}</span>
                            {secondary ? <span className="text-body-sm text-on-surface-variant truncate">{cell(row[secondary.key])}</span> : null}
                          </div>
                        </div>
                      </td>
                      {rest.map((column) => {
                        const raw = row[column.key];
                        const text = cell(raw);
                        const pill = STATE_KEYS.has(column.key) || typeof raw === "boolean";
                        const pillKey = typeof raw === "string" ? raw.toUpperCase() : text.toUpperCase();
                        return (
                          <td key={column.key} className="py-3.5 px-4 whitespace-nowrap text-on-surface-variant">
                            {pill ? (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-medium ${PILL[pillKey] ?? "bg-surface-container text-on-surface-variant"}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                                {text}
                              </span>
                            ) : (
                              text
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button type="button" className="text-secondary hover:text-primary font-title-md text-body-sm px-2 py-1" onClick={() => setSelected(row)}>
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data && data.results.length === 0 ? (
                    <tr>
                      <td className="py-space-md px-4 text-on-surface-variant" colSpan={tableColumns.length + 1}>
                        No records.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="px-space-md py-space-sm bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm text-body-sm text-on-surface-variant">
              <span>{data ? `Showing ${from}-${from + Math.max(pageSize - 1, 0)} of ${data.count.toLocaleString("en")}` : " "}</span>
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
          <aside ref={panelRef} aria-label="Details" className="xl:col-span-4 bg-surface-container-lowest rounded shadow-md p-space-lg flex flex-col gap-space-lg">
            <div className="flex items-start justify-between bg-surface-container-low -mx-space-lg -mt-space-lg p-space-md">
              <div className="flex flex-col">
                <span className="font-label-sm uppercase tracking-wider text-secondary font-semibold">{eyebrow}</span>
                <h2 className="font-headline-sm text-headline-sm text-primary">{cell(selected[primary.key])}</h2>
                {secondary ? <span className="font-body-sm text-on-surface-variant">{cell(selected[secondary.key])}</span> : null}
              </div>
              <button type="button" title="Close" aria-label="Close" onClick={() => setSelected(null)} className="w-8 h-8 rounded-full hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            </div>
            <dl className="flex flex-col gap-space-sm">
              {panelColumns.map((column) => (
                <div key={column.key} className="flex items-center justify-between gap-space-md border-b border-surface-container pb-space-xs">
                  <dt className="font-label-sm uppercase text-on-surface-variant">{column.label}</dt>
                  <dd className="font-body-md text-primary text-right break-all">{cell(selected[column.key], true)}</dd>
                </div>
              ))}
            </dl>
            {reviewLink && typeof selected[reviewLink.key] === "string" ? (
              <a
                href={`${reviewLink.base}${selected[reviewLink.key]}/`}
                className="w-full bg-primary text-on-primary hover:bg-primary-container font-title-md text-body-sm py-2.5 rounded transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">fact_check</span>
                {reviewLink.label}
              </a>
            ) : null}
            {showPublic && publicLink ? (
              <a
                href={`${publicLink.base}${selected[publicLink.key]}/`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-surface-container text-primary hover:bg-surface-container-high font-title-md text-body-sm py-2.5 rounded transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">open_in_new</span>
                {publicLink.label}
              </a>
            ) : null}
            {statusActionsBase ? (
              <div className="grid grid-cols-2 gap-space-sm">
                {state !== "ACTIVE" ? (
                  <button type="button" className="w-full bg-primary text-on-primary hover:bg-primary-container font-title-md text-body-sm py-2.5 rounded transition-colors flex items-center justify-center gap-1" onClick={() => void changeStatus(selected, "ACTIVE")}>
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">verified</span>
                    Activate
                  </button>
                ) : null}
                {state !== "SUSPENDED" ? (
                  <button type="button" className="w-full bg-error-container text-error hover:bg-error hover:text-white font-title-md text-body-sm py-2.5 rounded transition-colors flex items-center justify-center gap-1" onClick={() => void changeStatus(selected, "SUSPENDED")}>
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">flag</span>
                    Suspend
                  </button>
                ) : null}
              </div>
            ) : null}
            {revokeAction && state === "ACTIVE" ? (
              <div className="flex flex-col gap-space-sm">
                <label className="font-label-sm uppercase text-on-surface-variant" htmlFor="revoke-reason">
                  Reason for revoking
                </label>
                <textarea
                  id="revoke-reason"
                  className="w-full rounded bg-surface p-space-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-low"
                  rows={3}
                  placeholder={revokeAction.reasonPlaceholder ?? "Required - shown in the audit log"}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <button
                  type="button"
                  disabled={!reason.trim()}
                  className="w-full bg-error-container text-error hover:bg-error hover:text-white disabled:opacity-50 font-title-md text-body-sm py-2.5 rounded transition-colors flex items-center justify-center gap-1"
                  onClick={() => void revoke(selected.id)}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">block</span>
                  {revokeAction.label ?? "Revoke access"}
                </button>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
