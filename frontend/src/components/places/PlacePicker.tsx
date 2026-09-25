"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api/client";

export interface PickedPlace {
  placeId: number | null;
  city: string;
  region: string;
}

interface CityHit {
  id: number;
  name: string;
  region: string;
}
interface RegionHit {
  id: number;
  name: string;
}

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-space-xs";
const LABEL = "flex flex-col gap-1 font-label-md text-on-surface";

/**
 * Region and city chosen from reference data (GeoNames) instead of typed text, so the
 * database stays clean and filters match. If the reference data is not loaded yet the
 * two boxes fall back to plain text so nobody is blocked.
 */
export default function PlacePicker({
  country,
  value,
  onChange,
  locale = "en",
  labels,
}: {
  country: string;
  value: PickedPlace;
  onChange: (next: PickedPlace) => void;
  locale?: string;
  labels: { region: string; city: string; hint: string };
}) {
  const code = country.trim().toUpperCase();
  const [regions, setRegions] = useState<RegionHit[]>([]);
  const [regionId, setRegionId] = useState("");
  const [available, setAvailable] = useState(true);
  const [query, setQuery] = useState(value.city);
  const [hits, setHits] = useState<CityHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  // The native form check blocks submit until a city was picked from the list.
  useEffect(() => {
    input.current?.setCustomValidity(value.placeId === null ? labels.hint : "");
  });

  useEffect(() => {
    if (code.length !== 2) return;
    let cancelled = false;
    apiFetch<RegionHit[]>(`/api/v1/places/regions/?country=${code}&locale=${locale}`).then(
      (rows) => {
        if (cancelled) return;
        setRegions(rows);
        setAvailable(rows.length > 0);
      },
      () => {
        if (!cancelled) setAvailable(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code, locale]);

  function search(text: string, region: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams({ country: code, q: text, locale });
      if (region) params.set("region", region);
      apiFetch<CityHit[]>(`/api/v1/places/cities/?${params}`).then(setHits, () => setHits([]));
    }, 200);
  }

  if (!available) {
    return (
      <>
        <label className={LABEL}>
          {labels.region}
          <input className={FIELD} value={value.region} onChange={(e) => onChange({ ...value, placeId: null, region: e.target.value })} />
        </label>
        <label className={LABEL}>
          {labels.city}
          <input className={FIELD} value={value.city} required onChange={(e) => onChange({ ...value, placeId: null, city: e.target.value })} />
        </label>
      </>
    );
  }

  return (
    <>
      <label className={LABEL}>
        {labels.region}
        <select
          className={FIELD}
          value={regionId}
          onChange={(e) => {
            setRegionId(e.target.value);
            setQuery("");
            onChange({ placeId: null, city: "", region: "" });
            search("", e.target.value);
          }}
        >
          <option value="" />
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className={`${LABEL} relative`}>
        {labels.city}
        <input
          className={FIELD}
          ref={input}
          value={query}
          required
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="place-listbox"
          aria-autocomplete="list"
          onFocus={() => {
            setOpen(true);
            search(query, regionId);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onChange({ placeId: null, city: "", region: value.region });
            search(e.target.value, regionId);
          }}
        />
        {value.placeId === null && query ? <span className="font-body-sm text-on-surface-variant">{labels.hint}</span> : null}
        {open && hits.length > 0 ? (
          <ul id="place-listbox" role="listbox" className="absolute left-0 right-0 top-full z-20 max-h-64 overflow-auto rounded-lg bg-surface-container-lowest shadow-lg">
            {hits.map((hit) => (
              <li key={hit.id} role="option" aria-selected={value.placeId === hit.id}>
                <button
                  type="button"
                  className="block w-full px-space-sm py-space-xs text-left hover:bg-surface-container-low"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery(hit.name);
                    setOpen(false);
                    onChange({ placeId: hit.id, city: hit.name, region: hit.region });
                  }}
                >
                  {hit.name}
                  {hit.region ? <span className="text-on-surface-variant"> - {hit.region}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </label>
    </>
  );
}
