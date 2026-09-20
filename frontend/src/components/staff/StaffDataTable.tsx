"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";

interface Column {
  key: string;
  label: string;
}

interface Page {
  count: number;
  next: string | null;
  previous: string | null;
  results: Record<string, unknown>[];
}

interface Props {
  title: string;
  eyebrow: string;
  endpoint: string;
  columns: Column[];
  statusOptions?: string[];
  /** Base path such as /api/v1/staff/providers/; enables Activate/Suspend per row. */
  statusActionsBase?: string;
}

const FIELD = "rounded-lg bg-surface-container-low px-space-sm py-2 font-body-md focus:outline-none";

const PILL: Record<string, string> = {
  YES: "bg-secondary-container text-on-secondary-container",
  ACTIVE: "bg-secondary-container text-on-secondary-container",
  APPROVED: "bg-secondary-container text-on-secondary-container",
  NO: "bg-error-container text-on-error-container",
  SUSPENDED: "bg-error-container text-on-error-container",
  REJECTED: "bg-error-container text-on-error-container",
  PENDING: "bg-tertiary-fixed text-on-surface",
};

function cell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return String(value);
}

export default function StaffDataTable({ title, eyebrow, endpoint, columns, statusOptions, statusActionsBase }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    try {
      setData(await apiFetch<Page>(`${endpoint}?${params.toString()}`));
      setError(false);
    } catch {
      setError(true);
    }
  }, [endpoint, page, q, status]);

  async function changeStatus(id: unknown, next: "ACTIVE" | "SUSPENDED") {
    try {
      await apiFetch(`${statusActionsBase}${String(id)}/status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial and filter-driven fetch
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-space-lg">
      <div>
        <span className="font-label-sm uppercase tracking-widest text-secondary">{eyebrow}</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{title}</h1>
      </div>
      <div className="grid gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <p className="font-label-sm uppercase text-on-surface-variant">{status ? `${status} records` : "Total records"}</p>
          <p className="mt-1 font-headline-md text-headline-md text-primary">{data ? data.count.toLocaleString("en") : "-"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-space-sm">
        <input
          className={FIELD}
          placeholder="Search"
          aria-label="Search"
          value={q}
          onChange={(event) => {
            setPage(1);
            setQ(event.target.value);
          }}
        />
        {statusOptions ? (
          <div role="group" aria-label="Status" className="flex flex-wrap items-center gap-space-xs">
            {["", ...statusOptions].map((option) => (
              <button
                key={option || "all"}
                type="button"
                aria-pressed={status === option}
                onClick={() => {
                  setPage(1);
                  setStatus(option);
                }}
                className={`rounded-full px-space-md py-1 font-label-md ${
                  status === option ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {option || "All statuses"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {error ? <p role="alert">The list could not be loaded.</p> : null}
      <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
        <table className="w-full text-left font-body-md">
          <thead className="bg-surface-container-low font-label-sm uppercase text-on-surface-variant">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-space-md py-space-sm">
                  {column.label}
                </th>
              ))}
              {statusActionsBase ? <th className="px-space-md py-space-sm">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {data?.results.map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((column, position) => (
                  <td key={column.key} className="px-space-md py-space-sm">
                    {position === 0 ? (
                      <span className="flex items-center gap-space-sm">
                        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-label-sm text-on-primary">
                          {cell(row[column.key]).slice(0, 2).toUpperCase()}
                        </span>
                        {cell(row[column.key])}
                      </span>
                    ) : column.key === "status" || typeof row[column.key] === "boolean" ? (
                      <span className={`rounded-full px-2 py-0.5 font-label-sm ${PILL[cell(row[column.key]).toUpperCase()] ?? "bg-surface-container text-on-surface-variant"}`}>
                        {cell(row[column.key])}
                      </span>
                    ) : (
                      cell(row[column.key])
                    )}
                  </td>
                ))}
                {statusActionsBase ? (
                  <td className="px-space-md py-space-sm">
                    {row.status !== "ACTIVE" ? (
                      <button type="button" className="mr-space-sm text-primary underline" onClick={() => void changeStatus(row.id, "ACTIVE")}>
                        Activate
                      </button>
                    ) : null}
                    {row.status !== "SUSPENDED" ? (
                      <button type="button" className="text-error underline" onClick={() => void changeStatus(row.id, "SUSPENDED")}>
                        Suspend
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
            {data && data.results.length === 0 ? (
              <tr>
                <td className="px-space-md py-space-md text-on-surface-variant" colSpan={columns.length + (statusActionsBase ? 1 : 0)}>
                  No records.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-space-md font-body-md">
        <button type="button" disabled={!data?.previous} className="rounded-lg bg-surface-container px-space-md py-1 text-primary disabled:opacity-40" onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span className="text-on-surface-variant">Page {page}</span>
        <button type="button" disabled={!data?.next} className="rounded-lg bg-surface-container px-space-md py-1 text-primary disabled:opacity-40" onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
