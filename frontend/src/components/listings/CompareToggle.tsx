"use client";

import { useSyncExternalStore } from "react";

import Link from "@/components/layout/LocaleLink";
import { COMPARE_MAX, comparePath, readCompareIds, serverCompareIds, subscribeCompare, writeCompareIds } from "@/lib/compare";

export interface CompareToggleLabels {
  add: string;
  added: string;
  remove: string;
  /** "Compare {count} boats" with the placeholder already filled by the caller. */
  open: (count: number) => string;
  full: string;
}

/** "Add to compare" on a boat page: keeps a shortlist in the browser and links to /boats/compare/ with it. */
export default function CompareToggle({ listingId, labels }: { listingId: string; labels: CompareToggleLabels }) {
  // The shortlist lives in localStorage, which the server render cannot see: it renders empty there.
  const ids = useSyncExternalStore(subscribeCompare, readCompareIds, serverCompareIds);

  const included = ids.includes(listingId.toLowerCase());
  const full = !included && ids.length >= COMPARE_MAX;

  function toggle() {
    const id = listingId.toLowerCase();
    const next = included ? ids.filter((item) => item !== id) : [...ids, id];
    writeCompareIds(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-space-xs md:justify-end">
      <button
        type="button"
        onClick={toggle}
        disabled={full}
        aria-pressed={included}
        title={full ? labels.full : undefined}
        className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-space-sm py-1 font-label-md text-primary hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          {included ? "check" : "compare_arrows"}
        </span>
        {included ? labels.remove : full ? labels.full : labels.add}
      </button>
      {ids.length > 0 ? (
        <Link href={comparePath(ids)} className="font-label-md text-primary underline-offset-2 hover:underline">
          {labels.open(ids.length)}
        </Link>
      ) : null}
      {included ? (
        <span role="status" className="sr-only">
          {labels.added}
        </span>
      ) : null}
    </div>
  );
}
