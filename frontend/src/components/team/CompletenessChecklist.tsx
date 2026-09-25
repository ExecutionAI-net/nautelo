import Link from "@/components/layout/LocaleLink";

export interface Completeness {
  percent: number;
  missing: string[];
}

const LABELS: Record<string, string> = {
  display_name: "Business name",
  short_description: "Short description",
  description: "Full description (at least 50 characters)",
  contact: "Public email and phone",
  city: "City",
  country_code: "Country",
  service_area: "Service area",
  services: "At least one service (Services page)",
  tagline: "Tagline",
  about: "About your company (at least 50 characters)",
  specialties: "At least one specialty",
};

/** Progress bar and the list of what is still missing before review. */
export default function CompletenessChecklist({
  completeness,
  servicesHref,
}: {
  completeness: Completeness | undefined;
  servicesHref?: string;
}) {
  if (!completeness) return null;
  return (
    <div className="mt-space-sm rounded-lg bg-surface-container-low p-space-sm" aria-label="Profile completeness">
      <div className="flex items-center gap-space-sm">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuenow={completeness.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-secondary" style={{ width: `${completeness.percent}%` }} />
        </div>
        <span className="font-label-md font-semibold">{completeness.percent}%</span>
      </div>
      {completeness.missing.length > 0 ? (
        <ul className="mt-space-xs list-disc pl-space-md font-body-sm text-on-surface-variant">
          {completeness.missing.map((key) => (
            <li key={key}>
              {key === "services" && servicesHref ? <Link className="text-secondary underline" href={servicesHref}>{LABELS[key]}</Link> : LABELS[key] ?? key}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-space-xs font-body-sm text-on-surface-variant">Everything needed for review is filled in.</p>
      )}
    </div>
  );
}
