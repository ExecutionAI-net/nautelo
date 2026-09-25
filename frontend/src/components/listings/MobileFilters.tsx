"use client";

import { useState } from "react";

/** On a phone the filters fold away behind one button so the boats come first; from the large breakpoint up they are always open. */
export default function MobileFilters({ children, label }: { children: React.ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="boat-filters"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-xl bg-surface-container-lowest px-space-md py-space-sm font-title-md text-primary shadow-sm lg:hidden"
      >
        <span>{label}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div id="boat-filters" className={`${open ? "mt-space-sm block" : "hidden"} lg:mt-0 lg:block`}>
        {children}
      </div>
    </div>
  );
}
