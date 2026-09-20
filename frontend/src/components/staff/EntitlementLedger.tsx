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
    <section className="flex flex-col gap-space-lg">
      <div>
        <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">Staff Admin / Sales</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Entitlement ledger</h1>
        <p className="mt-space-xs font-body-md text-on-surface-variant">Listing rights and media upgrades: grant, revoke and restore with an audited reason.</p>
      </div>
      <label className="block rounded-xl bg-surface-container-lowest p-space-md shadow-sm font-label-sm uppercase text-on-surface-variant">
        Filter by user id
        <input
          className="ml-space-xs rounded-lg bg-surface-container-low px-space-sm py-2 font-body-md text-primary focus:outline-none"
          value={userFilter}
          onChange={(event) => setUserFilter(event.target.value)}
        />
      </label>

      <form
        className="flex flex-wrap items-end gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void act(() =>
            grantEntitlement({ user_id: grantUser, entitlement_type: grantType, reason: grantReason }),
          );
        }}
      >
        <label className="font-label-sm uppercase text-on-surface-variant">
          User id
          <input className="ml-space-xs rounded-lg bg-surface-container-low px-space-sm py-2 font-body-md text-primary focus:outline-none" value={grantUser} onChange={(e) => setGrantUser(e.target.value)} required />
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant">
          Type
          <select className="ml-space-xs rounded-lg bg-surface-container-low px-space-sm py-2 font-body-md text-primary focus:outline-none" value={grantType} onChange={(e) => setGrantType(e.target.value)}>
            <option value="PAID_LISTING">Paid listing</option>
            <option value="MEDIA_UPGRADE">Media upgrade</option>
          </select>
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant">
          Reason
          <input className="ml-space-xs rounded-lg bg-surface-container-low px-space-sm py-2 font-body-md text-primary focus:outline-none" value={grantReason} onChange={(e) => setGrantReason(e.target.value)} required />
        </label>
        <button type="submit" className="rounded-lg bg-primary px-space-md py-2 font-body-md text-on-primary hover:bg-primary-container">Grant</button>
      </form>

      {error ? (
        <p role="alert" className="mt-space-sm">
          {error}
        </p>
      ) : null}
      {rows === null ? (
        <p className="mt-space-md text-on-surface-variant">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
              <tr>
                <th scope="col" className="py-3 px-4">User</th>
                <th scope="col" className="py-3 px-4">Type</th>
                <th scope="col" className="py-3 px-4">Source</th>
                <th scope="col" className="py-3 px-4">State</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-3.5 px-4 font-spec-num text-primary">{row.user_id}</td>
                  <td className="py-3.5 px-4">{row.entitlement_type}</td>
                  <td className="py-3.5 px-4">{row.source}</td>
                  <td className="py-3.5 px-4">{row.state}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex justify-end gap-space-sm">
                      {row.state === "AVAILABLE" ? (
                        <button type="button" className="text-error font-title-md text-body-sm px-2 py-1" onClick={() => change(row, "revoke")}>
                          Revoke
                        </button>
                      ) : null}
                      {row.state === "CONSUMED" ? (
                        <button type="button" className="text-secondary font-title-md text-body-sm px-2 py-1" onClick={() => change(row, "restore")}>
                          Restore
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
