"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";

interface Column {
  key: string;
  label: string;
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
  endpoint: string;
  columns: Column[];
  statusOptions?: string[];
  /** When the row carries this key, the details panel links to `base + value` (e.g. the revision review screen). */
  reviewLink?: { key: string; base: string; label: string };
  groups?: ChipGroup[];
  /** Base path such as /api/v1/staff/providers/; enables Activate/Suspend in the side panel. */
  statusActionsBase?: string;
  /** Total-card label, e.g. "Total registered users". */
  totalLabel?: string;
}

const PILL: Record<string, string> = {
  YES: "bg-emerald-50 text-emerald-800",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  APPROVED: "bg-emerald-50 text-emerald-800",
  PUBLISHED: "bg-emerald-50 text-emerald-800",
  NO: "bg-error-container text-on-error-container",
  SUSPENDED: "bg-error-container text-on-error-container",
  REJECTED: "bg-error-container text-on-error-container",
  PENDING: "bg-amber-100 text-amber-900",
  PENDING_REVIEW: "bg-amber-100 text-amber-900",
};

function cell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
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

const CHIP = "px-3 py-1 rounded font-label-md";

export default function StaffDataTable({ title, eyebrow, description, endpoint, columns, statusOptions, groups, statusActionsBase, totalLabel, reviewLink }: Props) {
  const chipGroups: ChipGroup[] = groups ?? (statusOptions ? [{ param: "status", label: "Status", options: statusOptions.map((value) => ({ value, label: value })), facets: true }] : []);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (q.trim()) params.set("q", q.trim());
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    try {
      setData(await apiFetch<Page>(`${endpoint}?${params.toString()}`));
      setError(false);
    } catch {
      setError(true);
    }
  }, [endpoint, page, q, filters]);

  async function changeStatus(id: unknown, next: "ACTIVE" | "SUSPENDED") {
    try {
      await apiFetch(`${statusActionsBase}${String(id)}/status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setSelected(null);
      await load();
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial and filter-driven fetch
    void load();
  }, [load]);

  const facets = data?.facets ?? {};
  const facetTotal = Object.values(facets).reduce((sum, n) => sum + n, 0);
  const pageSize = data?.results.length ?? 0;
  const from = data && data.count > 0 ? (page - 1) * 25 + 1 : 0;
  const state = selected ? rowState(selected) : null;
  const [primary, secondary, ...rest] = columns;

  return (
    <div className="flex flex-col gap-space-xl">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
        <div className="flex flex-col gap-space-xs max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold bg-surface-container px-2.5 py-1 rounded">{eyebrow}</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{title}</h1>
          {description ? <p className="font-body-lg text-body-lg text-on-surface-variant">{description}</p> : null}
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
                placeholder="Search"
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
                    {[{ value: "", label: `All ${group.label.toLowerCase()}s` }, ...group.options].map((option) => {
                      const active = (filters[group.param] ?? "") === option.value;
                      const count = group.facets ? (option.value ? facets[option.value] : facetTotal) : undefined;
                      return (
                        <button
                          key={option.value || "all"}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setPage(1);
                            setFilters((current) => ({ ...current, [group.param]: option.value }));
                          }}
                          className={`${CHIP} ${active ? "bg-primary text-on-primary" : "bg-surface-container hover:bg-surface-container-high text-on-surface"}`}
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

          {error ? <p role="alert">The list could not be loaded.</p> : null}

          <div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">{primary?.label}</th>
                    {rest.map((column) => (
                      <th key={column.key} className="py-3 px-4">
                        {column.label}
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
                        const text = cell(row[column.key]);
                        const pill = column.key === "status" || column.key === "state" || typeof row[column.key] === "boolean";
                        return (
                          <td key={column.key} className="py-3.5 px-4 whitespace-nowrap text-on-surface-variant">
                            {pill ? (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-medium ${PILL[text.toUpperCase().replace(/\s+/g, "_")] ?? "bg-surface-container text-on-surface-variant"}`}>
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
                      <td className="py-space-md px-4 text-on-surface-variant" colSpan={columns.length + 1}>
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
          <aside aria-label="Details" className="xl:col-span-4 bg-surface-container-lowest rounded shadow-md p-space-lg flex flex-col gap-space-lg">
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
              {rest.map((column) => (
                <div key={column.key} className="flex items-center justify-between gap-space-md border-b border-surface-container pb-space-xs">
                  <dt className="font-label-sm uppercase text-on-surface-variant">{column.label}</dt>
                  <dd className="font-body-md text-primary">{cell(selected[column.key])}</dd>
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
            {statusActionsBase ? (
              <div className="grid grid-cols-2 gap-space-sm">
                {state !== "ACTIVE" ? (
                  <button type="button" className="w-full bg-primary text-on-primary hover:bg-primary-container font-title-md text-body-sm py-2.5 rounded transition-colors flex items-center justify-center gap-1" onClick={() => void changeStatus(selected.id, "ACTIVE")}>
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">verified</span>
                    Activate
                  </button>
                ) : null}
                {state !== "SUSPENDED" ? (
                  <button type="button" className="w-full bg-error-container text-error hover:bg-error hover:text-white font-title-md text-body-sm py-2.5 rounded transition-colors flex items-center justify-center gap-1" onClick={() => void changeStatus(selected.id, "SUSPENDED")}>
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">flag</span>
                    Suspend
                  </button>
                ) : null}
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
