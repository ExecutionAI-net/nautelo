"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchBrandModels,
  fetchOtherQueue,
  mapListing,
  type OtherQueueRow,
  type StaffModel,
} from "@/lib/api/staffTaxonomy";

function MapRow({ row, onDone }: { row: OtherQueueRow; onDone: () => void }) {
  const [models, setModels] = useState<StaffModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [newName, setNewName] = useState(row.custom_model_name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchBrandModels(row.brand_id)
      .then((rows) => {
        if (!cancelled) setModels(rows.filter((m) => !m.is_other_placeholder && m.is_active));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [row.brand_id]);

  async function run(target: { model_id: string } | { new_model_name: string }) {
    setBusy(true);
    setError(null);
    try {
      await mapListing(row.listing_id, target, "Mapped from the Other queue");
      onDone();
    } catch {
      setError("The mapping could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-outline-variant p-space-sm">
      <p className="font-title-sm text-title-sm">
        {row.brand} — “{row.custom_model_name}”
      </p>
      <p className="font-body-sm text-on-surface-variant">
        {row.owner} · {row.seller_type} · {row.status}
      </p>
      <div className="mt-space-sm flex flex-wrap items-end gap-space-sm">
        <label className="font-body-sm">
          Existing model
          <select
            className="ml-space-xs rounded border border-outline-variant p-space-xs"
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
          >
            <option value="">Select…</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy || !modelId} onClick={() => void run({ model_id: modelId })}>
          Map
        </button>
        <label className="font-body-sm">
          New model
          <input
            className="ml-space-xs rounded border border-outline-variant p-space-xs"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy || newName.trim().length < 2}
          onClick={() => void run({ new_model_name: newName })}
        >
          Create and map
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-space-xs text-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export default function OtherModelQueue() {
  const [rows, setRows] = useState<OtherQueueRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await fetchOtherQueue());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <section>
      <h1 className="font-headline-md text-headline-md text-primary">Other-model queue</h1>
      {failed ? (
        <p role="alert" className="mt-space-md">
          The queue could not be loaded.
        </p>
      ) : rows === null ? (
        <p className="mt-space-md text-on-surface-variant">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-space-md text-on-surface-variant">No listings use the Other model.</p>
      ) : (
        <ul className="mt-space-md flex flex-col gap-space-sm">
          {rows.map((row) => (
            <MapRow key={row.listing_id} row={row} onDone={() => void load()} />
          ))}
        </ul>
      )}
    </section>
  );
}
