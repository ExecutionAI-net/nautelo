"use client";

import { useEffect, useRef, useState } from "react";

import { combinePhoneNumber, PHONE_COUNTRIES, splitPhoneNumber, type PhoneCountry } from "@/lib/phoneCountries";

// Native <select> can't render an <img>/<svg> inside its options, and emoji
// flag glyphs (the two-codepoint regional indicators used to before) don't
// compose into a flag on Windows - they fall back to the two letters, which
// is what customers were seeing instead of a flag. This renders real SVG
// flag icons (from the MIT-licensed flag-icons project, public/flags/) in a
// small custom dropdown instead.
function flagSrc(code: string) {
  return `/flags/${code.toLowerCase()}.svg`;
}

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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = PHONE_COUNTRIES.find((entry) => entry.code === country) ?? PHONE_COUNTRIES[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function update(nextCountry: string, nextNational: string) {
    setCountry(nextCountry);
    setNational(nextNational);
    onChange(combinePhoneNumber(nextCountry, nextNational));
  }

  function selectCountry(entry: PhoneCountry) {
    update(entry.code, national);
    setOpen(false);
  }

  return (
    <div className="flex gap-space-sm">
      <div className="relative w-2/5" ref={containerRef}>
        <label className={labelClassName}>
          {countryLabel}
          <button
            type="button"
            className={`mt-space-xs flex w-full items-center gap-2 ${selectClassName}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <img src={flagSrc(selected.code)} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover" />
            <span>+{selected.dial}</span>
          </button>
        </label>
        {open ? (
          <ul
            role="listbox"
            aria-label={countryLabel}
            className="absolute z-10 mt-1 max-h-64 w-max min-w-full overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg"
          >
            {PHONE_COUNTRIES.map((entry) => (
              <li key={entry.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={entry.code === country}
                  className="flex w-full items-center gap-2 whitespace-nowrap px-space-sm py-space-xs text-left font-body-md hover:bg-surface-container-high"
                  onClick={() => selectCountry(entry)}
                >
                  <img src={flagSrc(entry.code)} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover" />
                  <span className="flex-1">{entry.name}</span>
                  <span className="text-on-surface-variant">+{entry.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
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
