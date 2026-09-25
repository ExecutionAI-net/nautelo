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
  searchCountry: string;
  city: string;
  allCities: string;
  chooseCountry: string;
  searchCity: string;
}

const ENGLISH: LocationFacetLabels = {
  country: "Country",
  allCountries: "All countries",
  searchCountry: "Search country…",
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
 * Country, then a searchable city box: both fields are the same shape as data
 * entry's PlacePicker.tsx (a search box on top, matches below), and both show
 * a real "(N results)" count next to each match WHILE the dropdown is open —
 * the count disappears from the field itself once something is picked, so a
 * chosen "Croatia" reads as "Croatia", not the country's grand total sitting
 * next to a since-narrowed result list.
 *
 * Reads from already-loaded facet rows instead of calling the places API
 * live, so it can show those real counts without a network round-trip per
 * keystroke.
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
  const initialCountry = (initial.country ?? "").toUpperCase();
  const [country, setCountry] = useState(initialCountry);
  const [countryQuery, setCountryQuery] = useState(initialCountry ? countryName(initialCountry) : "");
  const [countryOpen, setCountryOpen] = useState(false);
  const countryBlur = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const countryHits = countries
    .filter((code) => countryName(code).toLowerCase().includes(countryQuery.trim().toLowerCase()))
    .sort((a, b) => countryName(a).localeCompare(countryName(b)));

  const cities = locations
    .filter((row) => row.country === country && row.place_id !== null)
    .filter((row) => row.city.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.city.localeCompare(b.city));

  function pickCountry(code: string) {
    setCountry(code);
    setCountryQuery(code ? countryName(code) : "");
    setCountryOpen(false);
    setPlace("");
    setQuery("");
  }

  return (
    <>
      <div className={`${wrapperClass} relative`}>
        <label className={labelClass} htmlFor={`${idPrefix}-country`}>
          {l.country}
        </label>
        <input type="hidden" name="country" value={country} />
        <input
          id={`${idPrefix}-country`}
          className={fieldClass}
          value={countryQuery}
          autoComplete="off"
          role="combobox"
          aria-expanded={countryOpen}
          aria-controls={`${idPrefix}-country-listbox`}
          aria-autocomplete="list"
          placeholder={l.searchCountry}
          onFocus={() => setCountryOpen(true)}
          onBlur={() => {
            if (countryBlur.current) clearTimeout(countryBlur.current);
            countryBlur.current = setTimeout(() => setCountryOpen(false), 150);
          }}
          onChange={(event) => {
            setCountryQuery(event.target.value);
            setCountry("");
            setPlace("");
            setQuery("");
            setCountryOpen(true);
          }}
        />
        {countryOpen && (countryHits.length > 0 || countryQuery) ? (
          <ul
            id={`${idPrefix}-country-listbox`}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 max-h-64 overflow-auto rounded-lg bg-surface-container-lowest shadow-lg"
          >
            <li role="option" aria-selected={country === ""}>
              <button
                type="button"
                className="block w-full px-space-sm py-space-xs text-left hover:bg-surface-container-low"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickCountry("")}
              >
                {l.allCountries}
              </button>
            </li>
            {countryHits.map((code) => (
              <li key={code} role="option" aria-selected={country === code}>
                <button
                  type="button"
                  className="block w-full px-space-sm py-space-xs text-left hover:bg-surface-container-low"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickCountry(code)}
                >
                  {countryName(code)} ({countryTotal(code)})
                </button>
              </li>
            ))}
          </ul>
        ) : null}
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
