"use client";

import { useState } from "react";

import { combinePhoneNumber, PHONE_COUNTRIES, splitPhoneNumber } from "@/lib/phoneCountries";

/** Two-field phone number input: a country-code selector (flag + dial prefix)
 * plus the national number. `value`/`onChange` still deal in the single
 * "+<dial><national>" string the backend stores, so callers don't change.
 *
 * The selected country is kept in local state, seeded once from `value` at
 * mount. It must NOT be re-derived from `value` on every render: once the
 * national number is empty, `combinePhoneNumber` reports "" (there's no
 * phone number to submit yet), and re-parsing "" would silently snap the
 * country back to the default the instant a user picks one before typing
 * any digits. */
export default function PhoneNumberField({
  value,
  onChange,
  countryLabel,
  numberLabel,
  required,
  selectClassName,
  inputClassName,
  labelClassName = "block font-label-md text-label-md",
}: {
  value: string;
  onChange: (value: string) => void;
  countryLabel: string;
  numberLabel: string;
  required?: boolean;
  selectClassName: string;
  inputClassName: string;
  labelClassName?: string;
}) {
  const initial = splitPhoneNumber(value);
  const [country, setCountry] = useState(initial.country);
  const [national, setNational] = useState(initial.national);

  function update(nextCountry: string, nextNational: string) {
    setCountry(nextCountry);
    setNational(nextNational);
    onChange(combinePhoneNumber(nextCountry, nextNational));
  }

  return (
    <div className="flex gap-space-sm">
      <label className={`w-2/5 ${labelClassName}`}>
        {countryLabel}
        <select
          className={selectClassName}
          value={country}
          onChange={(event) => update(event.target.value, national)}
        >
          {PHONE_COUNTRIES.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.flag} +{entry.dial}
            </option>
          ))}
        </select>
      </label>
      <label className={`flex-1 ${labelClassName}`}>
        {numberLabel}
        <input
          className={inputClassName}
          type="tel"
          autoComplete="tel-national"
          required={required}
          value={national}
          onChange={(event) => update(country, event.target.value)}
        />
      </label>
    </div>
  );
}
