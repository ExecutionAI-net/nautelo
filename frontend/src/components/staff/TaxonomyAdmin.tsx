"use client";

import { useEffect, useState } from "react";

import {
  createBrand,
  createModel,
  fetchBrandModels,
  fetchBrands,
  mergeModels,
  mergePreview,
  setBrandActive,
  setModelActive,
  type StaffBrand,
  type StaffModel,
} from "@/lib/api/staffTaxonomy";

const INPUT = "ml-space-xs rounded border border-outline-variant p-space-xs";

export default function TaxonomyAdmin() {
  const [brands, setBrands] = useState<StaffBrand[]>([]);
  const [brandId, setBrandId] = useState("");
  const [models, setModels] = useState<StaffModel[]>([]);
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchBrands()
      .then((rows) => {
        if (!cancelled) setBrands(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    fetchBrandModels(brandId)
      .then((rows) => {
        if (!cancelled) setModels(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brandId, tick]);

  async function run(action: () => Promise<unknown>, done: string) {
    setMessage(null);
    try {
      await action();
      setMessage(done);
      setTick((n) => n + 1);
    } catch {
      setMessage("The change could not be saved (a duplicate name is refused).");
    }
  }

  async function merge() {
    if (!mergeSource || !mergeTarget) return;
    try {
      const preview = await mergePreview(mergeSource, mergeTarget);
      if (!window.confirm(`This re-maps ${preview.affected_count} listing(s). Continue?`)) return;
      await run(() => mergeModels(mergeSource, mergeTarget, "Duplicate model merge"), "Models merged.");
    } catch {
      setMessage("The merge could not be previewed.");
    }
  }

  const visibleModels = models.filter((m) => !m.is_other_placeholder);

  return (
    <section>
      <h1 className="font-headline-md text-headline-md text-primary">Brands and models</h1>
      {message ? (
        <p role="status" className="mt-space-sm">
          {message}
        </p>
      ) : null}

      <form
        className="mt-space-md flex gap-space-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => createBrand(newBrand), "Brand created.");
          setNewBrand("");
        }}
      >
        <label className="font-body-sm">
          New brand
          <input className={INPUT} value={newBrand} onChange={(e) => setNewBrand(e.target.value)} required />
        </label>
        <button type="submit">Add brand</button>
      </form>

      <label className="mt-space-md block font-body-md">
        Brand
        <select className={INPUT} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">Select…</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {brandId ? (
        <>
          <button
            type="button"
            className="mt-space-xs"
            onClick={() => {
              const brand = brands.find((b) => b.id === brandId);
              if (brand) void run(() => setBrandActive(brand.id, !brand.is_active), "Brand updated.");
            }}
          >
            Toggle brand active
          </button>
          <form
            className="mt-space-md flex gap-space-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => createModel(brandId, newModel), "Model created.");
              setNewModel("");
            }}
          >
            <label className="font-body-sm">
              New model
              <input className={INPUT} value={newModel} onChange={(e) => setNewModel(e.target.value)} required />
            </label>
            <button type="submit">Add model</button>
          </form>
          <ul className="mt-space-md flex flex-col gap-space-xs">
            {visibleModels.map((m) => (
              <li key={m.id} className="flex items-center gap-space-sm font-body-md">
                <span>{m.name}</span>
                <button type="button" onClick={() => void run(() => setModelActive(m.id, !m.is_active), "Model updated.")}>
                  {m.is_active ? "Deactivate" : "Activate"}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-space-lg flex flex-wrap items-end gap-space-sm">
            <label className="font-body-sm">
              Merge model
              <select className={INPUT} value={mergeSource} onChange={(e) => setMergeSource(e.target.value)}>
                <option value="">Select…</option>
                {visibleModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-body-sm">
              into
              <select className={INPUT} value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
                <option value="">Select…</option>
                {visibleModels
                  .filter((m) => m.id !== mergeSource)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <button type="button" disabled={!mergeSource || !mergeTarget} onClick={() => void merge()}>
              Preview and merge
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
