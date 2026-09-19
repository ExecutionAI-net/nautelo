"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

const FIELD =
  "mt-space-xs flex w-full items-center justify-between rounded-lg bg-surface-container-low px-space-sm py-2.5 text-left font-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60";

/**
 * A dropdown with a search box pinned at the top of the list.
 * Local mode filters `options` itself; pass `onSearch` to filter on the server
 * instead (the parent then swaps `options` as results arrive).
 */
export default function SearchSelect({
  label,
  value,
  options,
  onChange,
  onSearch,
  placeholder,
  searchPlaceholder,
  emptyText,
  selectedLabel,
  disabled,
  required,
  labelClassName,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onSearch?: (query: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  /** Shown when `value` is not in the current (possibly filtered) options. */
  selectedLabel?: string;
  disabled?: boolean;
  required?: boolean;
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const uid = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const visible = useMemo(() => {
    if (onSearch || !query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query, onSearch]);

  const current = options.find((option) => option.value === value)?.label ?? (value ? (selectedLabel ?? value) : "");

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
    onSearch?.("");
  }

  return (
    <div ref={root} className="relative">
      <span id={`${uid}-label`} className={labelClassName}>
        {label}
      </span>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-labelledby={`${uid}-label`}
        aria-required={required || undefined}
        disabled={disabled}
        className={FIELD}
        onClick={() => setOpen((state) => !state)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span className={current ? "" : "text-on-surface-variant"}>{current || placeholder}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {required ? (
        <input tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute h-0 w-0 opacity-0" value={value} onChange={() => {}} required />
      ) : null}
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-lg bg-surface-container-lowest p-space-xs shadow-lg ring-1 ring-outline-variant">
          <input
            autoFocus
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              onSearch?.(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter") {
                event.preventDefault();
                if (visible[0]) choose(visible[0].value);
              }
            }}
            className="w-full rounded-md bg-surface-container-low px-space-sm py-2 font-body-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <ul id={`${uid}-list`} role="listbox" aria-labelledby={`${uid}-label`} className="mt-space-xs max-h-60 overflow-auto">
            {visible.length === 0 ? <li className="px-space-sm py-2 font-body-sm text-on-surface-variant">{emptyText}</li> : null}
            {visible.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                tabIndex={0}
                onClick={() => choose(option.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    choose(option.value);
                  }
                }}
                className={`cursor-pointer rounded-md px-space-sm py-2 text-left font-body-md hover:bg-surface-container ${option.value === value ? "bg-surface-container font-semibold" : ""}`}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
