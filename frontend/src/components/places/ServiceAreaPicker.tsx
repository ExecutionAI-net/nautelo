"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import { fetchFormOptions } from "@/lib/api/listingForm";

interface RegionHit {
  id: number;
  name: string;
}
interface CityHit {
  id: number;
  name: string;
  region: string;
}

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md focus:outline-none";

/**
 * Adds one or more country/region/city areas to a `service_area` list, backed
 * by the same GeoNames reference data as PlacePicker. Unlike PlacePicker this
 * is multi-select: each pick is appended as a removable chip rather than
 * replacing a single value, and a country alone (no region/city) is a valid,
 * broader area.
 */
export default function ServiceAreaPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [codes, setCodes] = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [regions, setRegions] = useState<RegionHit[]>([]);
  const [regionId, setRegionId] = useState("");
  const [regionName, setRegionName] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CityHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchFormOptions().then(
      (options) => setCodes(options.countries ?? []),
      () => setCodes([]),
    );
  }, []);

  useEffect(() => {
    if (country.length !== 2) return;
    let cancelled = false;
    apiFetch<RegionHit[]>(`/api/v1/places/regions/?country=${country}&locale=en`).then(
      (rows) => {
        if (!cancelled) setRegions(rows);
      },
      () => {
        if (!cancelled) setRegions([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [country]);

  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      return null;
    }
  }, []);

  function search(text: string) {
    if (timer.current) clearTimeout(timer.current);
    if (!country) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(() => {
      const params = new URLSearchParams({ country, q: text, locale: "en" });
      if (regionId) params.set("region", regionId);
      apiFetch<CityHit[]>(`/api/v1/places/cities/?${params}`).then(setHits, () => setHits([]));
    }, 200);
  }

  function reset() {
    setCountry("");
    setRegions([]);
    setRegionId("");
    setRegionName("");
    setQuery("");
    setHits([]);
    setOpen(false);
  }

  function addArea(city?: string, cityRegion?: string) {
    const countryName = names?.of(country) ?? country;
    const label = [city, cityRegion || regionName, countryName].filter(Boolean).join(", ");
    if (!label || value.includes(label)) return;
    onChange([...value, label]);
    reset();
  }

  function remove(entry: string) {
    onChange(value.filter((item) => item !== entry));
  }

  return (
    <div className="flex flex-col gap-space-xs">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-space-xs">
          {value.map((entry) => (
            <li key={entry} className="flex items-center gap-1.5 rounded-full bg-secondary-container px-space-sm py-1 font-label-md text-on-secondary-container">
              {entry}
              <button type="button" aria-label={`Remove ${entry}`} onClick={() => remove(entry)} className="material-symbols-outlined text-[14px] leading-none">
                close
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-1 gap-space-xs sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select
          className={FIELD}
          aria-label="Country"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setRegions([]);
            setRegionId("");
            setRegionName("");
            setQuery("");
            setHits([]);
          }}
        >
          <option value="">Country...</option>
          {codes.map((code) => (
            <option key={code} value={code}>
              {names?.of(code) ?? code}
            </option>
          ))}
        </select>
        <select
          className={FIELD}
          aria-label="Region"
          disabled={!country || regions.length === 0}
          value={regionId}
          onChange={(e) => {
            const id = e.target.value;
            setRegionId(id);
            setRegionName(regions.find((r) => String(r.id) === id)?.name ?? "");
            setQuery("");
            search("");
          }}
        >
          <option value="">{regions.length === 0 ? "Any region" : "Any region"}</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <div className="relative">
          <input
            className={FIELD}
            aria-label="City"
            disabled={!country}
            placeholder={country ? "Search a city (optional)" : "Choose a country first"}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              search(e.target.value);
            }}
            onFocus={() => {
              setOpen(true);
              search(query);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && hits.length > 0 ? (
            <ul className="absolute left-0 right-0 top-full z-20 max-h-64 overflow-auto rounded-lg bg-surface-container-lowest shadow-lg">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addArea(hit.name, hit.region)}
                    className="block w-full px-space-sm py-space-xs text-left hover:bg-surface-container-low"
                  >
                    {hit.name}
                    {hit.region ? <span className="text-on-surface-variant"> - {hit.region}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!country}
          onClick={() => addArea()}
          className="rounded-lg border border-primary px-space-md py-2.5 font-body-md text-primary disabled:opacity-50"
        >
          Add area
        </button>
      </div>
    </div>
  );
}
