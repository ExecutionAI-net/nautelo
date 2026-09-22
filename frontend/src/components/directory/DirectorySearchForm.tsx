import type { CategoryRef } from "@/lib/api/directory";
import type { Translate } from "@/i18n";
import type { Locale } from "@/lib/i18n/directory";

export interface DirectoryFilters {
  q?: string;
  category?: string;
  location?: string;
  sort?: string;
}

export default function DirectorySearchForm({
  t,
  categories,
  current,
}: {
  locale: Locale;
  t: Translate;
  categories: CategoryRef[];
  current: DirectoryFilters;
}) {
  // A native GET form: every filter lands in the query string, so the URL is
  // shareable and the Back button restores the previous result set without
  // any client-side state (spec 29.4).
  return (
    <form
      method="get"
      action="/services/professionals/"
      className="grid grid-cols-1 gap-space-sm md:grid-cols-5"
    >
      <label className="flex flex-col gap-space-xs font-body-sm text-on-surface-variant md:col-span-2">
        {t("directory.search.text")}
        <input
          type="search"
          name="q"
          defaultValue={current.q ?? ""}
          className="rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs font-body-md text-on-surface"
        />
      </label>
      <label className="flex flex-col gap-space-xs font-body-sm text-on-surface-variant">
        {t("directory.search.category")}
        <select
          name="category"
          defaultValue={current.category ?? ""}
          className="rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs font-body-md text-on-surface"
        >
          <option value="">{t("directory.search.category.all")}</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-space-xs font-body-sm text-on-surface-variant">
        {t("directory.search.location")}
        <input
          type="text"
          name="location"
          defaultValue={current.location ?? ""}
          className="rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs font-body-md text-on-surface"
        />
      </label>
      <label className="flex flex-col gap-space-xs font-body-sm text-on-surface-variant">
        {t("directory.search.sort")}
        <select
          name="sort"
          defaultValue={current.sort ?? "recommended"}
          className="rounded-lg border border-outline-variant bg-surface px-space-sm py-space-xs font-body-md text-on-surface"
        >
          <option value="recommended">{t("directory.sort.recommended")}</option>
          <option value="alphabetical">{t("directory.sort.alphabetical")}</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-primary px-space-md py-space-sm font-label-md text-label-md text-on-primary md:col-span-5 md:justify-self-start"
      >
        {t("directory.search.submit")}
      </button>
    </form>
  );
}
