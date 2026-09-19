"use client";

import { useEffect, useState } from "react";

import {
  changeEntitlement,
  fetchEntitlements,
  grantEntitlement,
  type EntitlementRow,
} from "@/lib/api/staffEntitlements";

export default function EntitlementLedger() {
  const [userFilter, setUserFilter] = useState("");
  const [rows, setRows] = useState<EntitlementRow[] | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [grantUser, setGrantUser] = useState("");
  const [grantType, setGrantType] = useState("PAID_LISTING");
  const [grantReason, setGrantReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchEntitlements({ user: userFilter.trim() || undefined })
      .then((page) => {
        if (!cancelled) setRows(page.results);
      })
      .catch(() => {
        if (!cancelled) setError("The ledger could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [userFilter, reload]);

  async function act(run: () => Promise<unknown>) {
    setError(null);
    try {
      await run();
      setReload((n) => n + 1);
    } catch {
      setError("The change could not be saved. A reason is required.");
    }
  }

  function change(row: EntitlementRow, action: "revoke" | "restore") {
    const reason = window.prompt(`Reason to ${action} this entitlement`);
    if (!reason?.trim()) return;
    void act(() => changeEntitlement(row.id, action, reason));
  }

  return (
    <section>
      <h1 className="font-headline-md text-headline-md text-primary">Entitlement ledger</h1>
      <label className="mt-space-md block font-body-md">
        Filter by user id
        <input
          className="ml-space-xs rounded border border-outline-variant p-space-xs"
          value={userFilter}
          onChange={(event) => setUserFilter(event.target.value)}
        />
      </label>

      <form
        className="mt-space-md flex flex-wrap items-end gap-space-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void act(() =>
            grantEntitlement({ user_id: grantUser, entitlement_type: grantType, reason: grantReason }),
          );
        }}
      >
        <label className="font-body-sm">
          User id
          <input className="ml-space-xs rounded border border-outline-variant p-space-xs" value={grantUser} onChange={(e) => setGrantUser(e.target.value)} required />
        </label>
        <label className="font-body-sm">
          Type
          <select className="ml-space-xs rounded border border-outline-variant p-space-xs" value={grantType} onChange={(e) => setGrantType(e.target.value)}>
            <option value="PAID_LISTING">Paid listing</option>
            <option value="MEDIA_UPGRADE">Media upgrade</option>
          </select>
        </label>
        <label className="font-body-sm">
          Reason
          <input className="ml-space-xs rounded border border-outline-variant p-space-xs" value={grantReason} onChange={(e) => setGrantReason(e.target.value)} required />
        </label>
        <button type="submit">Grant</button>
      </form>

      {error ? (
        <p role="alert" className="mt-space-sm">
          {error}
        </p>
      ) : null}
      {rows === null ? (
        <p className="mt-space-md text-on-surface-variant">Loading…</p>
      ) : (
        <table className="mt-space-md w-full text-left font-body-sm">
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Type</th>
              <th scope="col">Source</th>
              <th scope="col">State</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.user_id}</td>
                <td>{row.entitlement_type}</td>
                <td>{row.source}</td>
                <td>{row.state}</td>
                <td className="flex gap-space-sm">
                  {row.state === "AVAILABLE" ? (
                    <button type="button" onClick={() => change(row, "revoke")}>
                      Revoke
                    </button>
                  ) : null}
                  {row.state === "CONSUMED" ? (
                    <button type="button" onClick={() => change(row, "restore")}>
                      Restore
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
