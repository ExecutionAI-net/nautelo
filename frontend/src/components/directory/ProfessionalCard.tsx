import Link from "next/link";

import type { ProfessionalCard } from "@/lib/api/directory";
import type { Locale } from "@/lib/i18n/directory";

export default function ProfessionalResultCard({
  professional,
}: {
  locale: Locale;
  professional: ProfessionalCard;
}) {
  // No contact details are rendered because none are in the payload: contact
  // data is Phase 7's ContactAccessService (spec 1, spec 14.2).
  const location = [professional.city, professional.region].filter(Boolean).join(", ");

  return (
    <article className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md">
      <h3 className="font-title-lg text-title-lg text-primary">
        <Link href={professional.url}>{professional.display_name}</Link>
      </h3>
      {location ? (
        <p
          data-testid="professional-location"
          className="mt-space-xs font-body-sm text-on-surface-variant"
        >
          {location}
        </p>
      ) : null}
      {professional.short_description ? (
        <p className="mt-space-sm font-body-md text-on-surface">
          {professional.short_description}
        </p>
      ) : null}
      {professional.categories.length > 0 ? (
        <ul className="mt-space-sm flex flex-wrap gap-space-xs">
          {professional.categories.map((category) => (
            <li
              key={category.slug}
              className="rounded-lg bg-secondary-container px-space-sm py-space-xs font-body-sm text-on-secondary-container"
            >
              {category.name}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
