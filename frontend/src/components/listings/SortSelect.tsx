"use client";

/**
 * Always-visible sort control next to the results count. A GET form of its own so it can carry
 * every other active filter as hidden fields and submit the instant the visitor picks an option —
 * it must never make them find and press the sidebar's "Apply filters" button just to re-sort.
 */
export default function SortSelect({
  action,
  hidden,
  value,
  label,
  options,
}: {
  action: string;
  hidden: Record<string, string>;
  value: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <form action={action} method="get" className="flex items-center gap-space-xs">
      {Object.entries(hidden).map(([key, fieldValue]) => (
        <input key={key} type="hidden" name={key} value={fieldValue} />
      ))}
      <label htmlFor="results-sort" className="font-label-sm uppercase tracking-wider text-on-surface-variant">
        {label}
      </label>
      <select
        id="results-sort"
        name="sort"
        defaultValue={value}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-lg bg-surface-container-low px-space-sm py-2 font-body-sm text-on-surface focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}
