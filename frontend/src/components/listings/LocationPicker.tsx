"use client";

import { useState } from "react";

export interface PlaceOption {
  value: string;
  label: string;
  kind: string;
}

const FIELD =
  "w-full bg-surface-container-low rounded-lg px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none placeholder:text-outline";

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A searchable list: the visitor types a few letters instead of scrolling every country and city. */
export default function LocationPicker({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: PlaceOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);
  const wanted = fold(query.trim());
  const shown = options.filter((option) => !wanted || fold(option.label).includes(wanted));
  const rows: PlaceOption[] = [{ value: "", label: "All countries", kind: "" }, ...shown];

  function choose(option: PlaceOption) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (rows[active]) choose(rows[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={selected ? selected.label : "Search country or city"}
        value={open ? query : (selected?.label ?? "")}
        onFocus={() => {
          setQuery("");
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(1);
          setOpen(true);
        }}
        onKeyDown={onKey}
        className={FIELD}
      />
      {open ? (
        <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg bg-surface-container-lowest py-1 shadow-lg">
          {rows.map((option, index) => (
            <li
              key={option.value || "all"}
              role="option"
              aria-selected={option.value === value}
              // mousedown, not click: the input's blur would close the list before a click lands.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center justify-between px-space-sm py-2 font-body-md ${index === active ? "bg-surface-container-low" : ""}`}
            >
              <span>{option.label}</span>
              {option.kind ? <span className="font-label-sm text-on-surface-variant">{option.kind}</span> : null}
            </li>
          ))}
          {shown.length === 0 ? <li className="px-space-sm py-2 font-body-sm text-on-surface-variant">No match</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
