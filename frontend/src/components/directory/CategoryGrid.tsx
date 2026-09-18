import Link from "next/link";

import type { ServiceCategory } from "@/lib/api/directory";
import { type Locale, t } from "@/lib/i18n/directory";

export default function CategoryGrid({
  locale,
  categories,
}: {
  locale: Locale;
  categories: ServiceCategory[];
}) {
  if (categories.length === 0) {
    return (
      <p className="font-body-md text-on-surface-variant">
        {t(locale, "directory.categories.empty")}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            href={`/services/professionals/?category=${encodeURIComponent(category.slug)}`}
            className="block h-full rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md hover:border-secondary"
          >
            <span className="font-title-lg text-title-lg text-primary">{category.name}</span>
            {category.description ? (
              <span className="mt-space-xs block font-body-sm text-on-surface-variant">
                {category.description}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
