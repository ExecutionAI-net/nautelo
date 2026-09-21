"use client";

import { useEffect, useMemo, useState } from "react";

import PlacePicker from "@/components/places/PlacePicker";
import { fetchFormOptions } from "@/lib/api/listingForm";

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-space-xs";
const LABEL = "flex flex-col gap-1 font-label-md text-on-surface";

export interface OrgLocation {
  country_code: string;
  city: string;
  region: string;
  place_id: number | null;
}

/** Country select plus the region/city picker used by broker and professional profiles. */
export default function OrgLocationFields({
  value,
  onChange,
  withRegion = false,
}: {
  value: OrgLocation;
  onChange: (next: OrgLocation) => void;
  withRegion?: boolean;
}) {
  const [codes, setCodes] = useState<string[]>([]);

  useEffect(() => {
    fetchFormOptions().then(
      (options) => setCodes(options.countries ?? []),
      () => setCodes([]),
    );
  }, []);

  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      return null;
    }
  }, []);
  const list = value.country_code && !codes.includes(value.country_code.toUpperCase()) ? [value.country_code.toUpperCase(), ...codes] : codes;

  return (
    <>
      <label className={LABEL}>
        Country
        <select
          className={FIELD}
          required
          value={value.country_code.toUpperCase()}
          onChange={(e) => onChange({ country_code: e.target.value, city: "", region: "", place_id: null })}
        >
          <option value="" />
          {list.map((code) => (
            <option key={code} value={code}>
              {names?.of(code) ?? code}
            </option>
          ))}
        </select>
      </label>
      <PlacePicker
        country={value.country_code}
        value={{ placeId: value.place_id, city: value.city, region: value.region }}
        onChange={(next) => onChange({ ...value, place_id: next.placeId, city: next.city, region: withRegion ? next.region : value.region })}
        labels={{ region: "Region", city: "City", hint: "Choose your city from the list." }}
      />
    </>
  );
}
