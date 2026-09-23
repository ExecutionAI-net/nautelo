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

const INPUT = "ml-space-xs rounded-lg bg-surface-container-low px-space-sm py-2 font-body-md text-primary focus:outline-none";
const CARD = "rounded-xl bg-surface-container-lowest p-space-lg shadow-sm";
const BTN = "rounded-lg bg-primary px-space-md py-2 font-body-md text-on-primary hover:bg-primary-container disabled:opacity-50";
const GHOST = "rounded-lg bg-surface-container px-space-md py-1.5 font-body-sm text-primary hover:bg-surface-container-high";

export default function TaxonomyAdmin() {
  const [brands, setBrands] = useState<StaffBrand[]>([]);
  const [brandId, setBrandId] = useState("");
  const [models, setModels] = useState<StaffModel[]>([]);
  const [newBrand, setNewBrand] = useState("");
  const [brandQuery, setBrandQuery] = useState("");
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
  const needle = brandQuery.trim().toLowerCase();
  const shownBrands = brands.filter((b) => !needle || b.name.toLowerCase().includes(needle) || b.id === brandId);
  const brand = brands.find((b) => b.id === brandId);

  return (
    <section className="flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">Staff / Taxonomy</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Brands and models</h1>
        </div>
        <div className="rounded-xl bg-surface-container-lowest px-space-md py-space-xs shadow-sm">
          <span className="block font-label-sm uppercase text-on-surface-variant">Brands</span>
          <span className="font-spec-num text-spec-num font-semibold text-primary">{brands.length.toLocaleString("en")}</span>
        </div>
      </div>
      {message ? (
        <p role="status" className="mt-space-sm">
          {message}
        </p>
      ) : null}

      <form
        className={`${CARD} flex flex-wrap items-end gap-space-sm`}
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => createBrand(newBrand), "Brand created.");
          setNewBrand("");
        }}
      >
        <label className="font-label-sm uppercase text-on-surface-variant">
          New brand
          <input className={INPUT} value={newBrand} onChange={(e) => setNewBrand(e.target.value)} required />
        </label>
        <button type="submit" className={BTN}>Add brand</button>
      </form>

      <div className={`${CARD} flex flex-wrap items-end gap-space-md`}>
      <label className="font-label-sm uppercase text-on-surface-variant">
        Find brand
        <input className={INPUT} value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} placeholder="Type to narrow the list" />
      </label>
      <label className="font-label-sm uppercase text-on-surface-variant">
        Brand
        <select className={INPUT} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">Select…</option>
          {shownBrands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <span className="font-body-sm text-on-surface-variant">{shownBrands.length.toLocaleString("en")} shown</span>
      </div>
      {brandId ? (
        <>
          <button
            type="button"
            className={`${GHOST} self-start`}
            onClick={() => {
              const brand = brands.find((b) => b.id === brandId);
              if (brand) void run(() => setBrandActive(brand.id, !brand.is_active), "Brand updated.");
            }}
          >
            Toggle brand active
          </button>
          <form
            className={`${CARD} flex flex-wrap items-end gap-space-sm`}
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => createModel(brandId, newModel), "Model created.");
              setNewModel("");
            }}
          >
            <label className="font-label-sm uppercase text-on-surface-variant">
              New model
              <input className={INPUT} value={newModel} onChange={(e) => setNewModel(e.target.value)} required />
            </label>
            <button type="submit" className={BTN}>Add model</button>
          </form>
          <ul className="divide-y divide-surface-container overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
            <li className="bg-surface-container-low px-space-md py-space-sm font-label-sm uppercase tracking-wider text-on-surface-variant">
              {brand?.name} - {visibleModels.length} models
            </li>
            {visibleModels.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-space-sm px-space-md py-space-sm font-body-md">
                <span className={m.is_active ? "text-primary" : "text-on-surface-variant line-through"}>{m.name}</span>
                <button type="button" className={GHOST} onClick={() => void run(() => setModelActive(m.id, !m.is_active), "Model updated.")}>
                  {m.is_active ? "Deactivate" : "Activate"}
                </button>
              </li>
            ))}
          </ul>

          <div className={`${CARD} flex flex-wrap items-end gap-space-sm`}>
            <label className="font-label-sm uppercase text-on-surface-variant">
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
            <label className="font-label-sm uppercase text-on-surface-variant">
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
            <button type="button" className={BTN} disabled={!mergeSource || !mergeTarget} onClick={() => void merge()}>
              Preview and merge
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
