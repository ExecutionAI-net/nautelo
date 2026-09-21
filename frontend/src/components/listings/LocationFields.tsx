"use client";

import { useState } from "react";

import type { FacetLocation } from "@/lib/api/listings";

const HOME_LABEL = "font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider";
const FIELD =
  "w-full bg-surface-container-low rounded-lg px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

const FIRST = ["ES", "IT"];

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

/**
 * Country, then city: each list holds only what belongs to the choice above it.
 * The selects are named country / place, so the surrounding GET form sends them as they are.
 */
export default function LocationFields({
  locations,
  idPrefix,
  initial = {},
  labelClass = HOME_LABEL,
  wrapperClass = "flex flex-col gap-1",
}: {
  locations: FacetLocation[];
  idPrefix: string;
  initial?: { country?: string; place?: string };
  labelClass?: string;
  wrapperClass?: string;
}) {
  const [country, setCountry] = useState((initial.country ?? "").toUpperCase());
  const [place, setPlace] = useState(initial.place ?? "");

  const countries = [...new Set(locations.map((row) => row.country))].sort((a, b) => {
    const rank = (code: string) => (FIRST.includes(code) ? FIRST.indexOf(code) : FIRST.length);
    return rank(a) - rank(b) || countryName(a).localeCompare(countryName(b));
  });
  const inCountry = locations.filter((row) => row.country === country);
  const cities = inCountry.filter((row) => row.place_id !== null).sort((a, b) => a.city.localeCompare(b.city));
  const boatsIn = (rows: FacetLocation[]) => rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <div className={wrapperClass}>
        <label className={labelClass} htmlFor={`${idPrefix}-country`}>Country</label>
        <select
          id={`${idPrefix}-country`}
          name="country"
          value={country}
          onChange={(event) => {
            setCountry(event.target.value);
            setPlace("");
          }}
          className={FIELD}
        >
          <option value="">All countries</option>
          {countries.map((code) => (
            <option key={code} value={code}>
              {countryName(code)} ({boatsIn(locations.filter((row) => row.country === code))})
            </option>
          ))}
        </select>
      </div>
      <div className={wrapperClass}>
        <label className={labelClass} htmlFor={`${idPrefix}-place`}>City</label>
        <select
          id={`${idPrefix}-place`}
          name="place"
          value={place}
          disabled={!country}
          onChange={(event) => setPlace(event.target.value)}
          className={FIELD}
        >
          <option value="">{country ? "All cities" : "Choose a country first"}</option>
          {cities.map((row) => (
            <option key={row.place_id} value={String(row.place_id)}>
              {row.city} ({row.count})
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
