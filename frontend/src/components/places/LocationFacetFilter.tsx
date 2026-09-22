"use client";

import { useRef, useState } from "react";

/** One place results exist in, with how many. Region is deliberately not part
 * of this shape: none of the three directories (boats, brokers, professionals)
 * need it to filter, and the wider `FacetLocation` (which does carry a region)
 * satisfies this type structurally, so boats' own facet rows pass through
 * unchanged. */
export interface LocationFacetRow {
  country: string;
  place_id: number | null;
  city: string;
  count: number;
}

const FIRST = ["ES", "IT"];

export interface LocationFacetLabels {
  country: string;
  allCountries: string;
  city: string;
  allCities: string;
  chooseCountry: string;
  searchCity: string;
}

const ENGLISH: LocationFacetLabels = {
  country: "Country",
  allCountries: "All countries",
  city: "City",
  allCities: "All cities",
  chooseCountry: "Choose a country first",
  searchCity: "Search city…",
};

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

/**
 * Country, then a searchable city box: the same two-step, search-on-top shape
 * data entry already uses (places/PlacePicker.tsx), so browsing a directory and
 * filling in a listing or profile speak the same location language. Unlike
 * PlacePicker this reads from already-loaded facet rows instead of calling the
 * places API live, so every option keeps showing its real "(N results)" count
 * — the thing a plain free-text box could never do.
 *
 * Shared by /boats/, /brokers/ and /services/professionals/: each page fetches
 * its own `locations` facet from its own list endpoint and renders this once.
 */
export default function LocationFacetFilter({
  locations,
  idPrefix,
  initial = {},
  labelClass = "flex flex-col gap-1 font-label-md text-on-surface",
  fieldClass = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  wrapperClass = "flex flex-col gap-1",
  labels,
}: {
  locations: LocationFacetRow[];
  idPrefix: string;
  initial?: { country?: string; place?: string };
  labelClass?: string;
  fieldClass?: string;
  wrapperClass?: string;
  labels?: Partial<LocationFacetLabels>;
}) {
  const l: LocationFacetLabels = { ...ENGLISH, ...labels };
  const [country, setCountry] = useState((initial.country ?? "").toUpperCase());
  const [place, setPlace] = useState(initial.place ?? "");
  const [query, setQuery] = useState(
    () => locations.find((row) => row.place_id !== null && String(row.place_id) === initial.place)?.city ?? "",
  );
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const countries = [...new Set(locations.map((row) => row.country))].sort((a, b) => {
    const rank = (code: string) => (FIRST.includes(code) ? FIRST.indexOf(code) : FIRST.length);
    return rank(a) - rank(b) || countryName(a).localeCompare(countryName(b));
  });
  const countryTotal = (code: string) =>
    locations.filter((row) => row.country === code).reduce((sum, row) => sum + row.count, 0);
  const cities = locations
    .filter((row) => row.country === country && row.place_id !== null)
    .filter((row) => row.city.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.city.localeCompare(b.city));

  return (
    <>
      <div className={wrapperClass}>
        <label className={labelClass} htmlFor={`${idPrefix}-country`}>
          {l.country}
        </label>
        <select
          id={`${idPrefix}-country`}
          name="country"
          value={country}
          onChange={(event) => {
            setCountry(event.target.value);
            setPlace("");
            setQuery("");
          }}
          className={`${fieldClass} cursor-pointer`}
        >
          <option value="">{l.allCountries}</option>
          {countries.map((code) => (
            <option key={code} value={code}>
              {countryName(code)} ({countryTotal(code)})
            </option>
          ))}
        </select>
      </div>
      <div className={`${wrapperClass} relative`}>
        <label className={labelClass} htmlFor={`${idPrefix}-place`}>
          {l.city}
        </label>
        <input type="hidden" name="place" value={place} />
        <input
          id={`${idPrefix}-place`}
          className={fieldClass}
          value={query}
          disabled={!country}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${idPrefix}-place-listbox`}
          aria-autocomplete="list"
          placeholder={country ? l.searchCity : l.chooseCountry}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setPlace("");
            setOpen(true);
          }}
        />
        {open && country && (cities.length > 0 || query) ? (
          <ul
            id={`${idPrefix}-place-listbox`}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 max-h-64 overflow-auto rounded-lg bg-surface-container-lowest shadow-lg"
          >
            <li role="option" aria-selected={place === ""}>
              <button
                type="button"
                className="block w-full px-space-sm py-space-xs text-left hover:bg-surface-container-low"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setPlace("");
                  setQuery("");
                  setOpen(false);
                }}
              >
                {l.allCities}
              </button>
            </li>
            {cities.map((row) => (
              <li key={row.place_id} role="option" aria-selected={place === String(row.place_id)}>
                <button
                  type="button"
                  className="block w-full px-space-sm py-space-xs text-left hover:bg-surface-container-low"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setPlace(String(row.place_id));
                    setQuery(row.city);
                    setOpen(false);
                  }}
                >
                  {row.city} ({row.count})
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}
