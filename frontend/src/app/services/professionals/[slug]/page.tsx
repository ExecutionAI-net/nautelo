import { getT } from "@/i18n/server";
import { getRequestLocale } from "@/lib/i18n/requestLocale";
import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";
import { notFound } from "next/navigation";

import ContactPanel from "@/components/contact/ContactPanel";
import InquiryForm from "@/components/inquiry/InquiryForm";
import ProfileMonogram from "@/components/directory/ProfileMonogram";
import { fetchProfessional, formatProfessionalLocation } from "@/lib/api/directory";
import { fetchInquiryConfig } from "@/lib/api/inquiry-config";
import { formatPrice } from "@/lib/api/plans";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise. Verify against node_modules/next/dist/docs/
// before changing this signature.
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const professional = await fetchProfessional(slug, DEFAULT_LOCALE);
  if (!professional) {
    return { title: (await getT())("directory.services_professionals.title") };
  }
  return {
    title: professional.display_name,
    description: professional.short_description || undefined,
    // Spec 1: /services/professionals/<professional-slug>/ is the canonical URL.
  };
}

// The API speaks in enum values; the page speaks to visitors.
const TEAM_ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", MANAGER: "Manager", AGENT: "Agent", VIEWER: "Viewer" };

export default async function ProfessionalDetailPage({ params }: { params: Params }) {
  const t = await getT();
  const { slug } = await params;
  const locale = await getRequestLocale();
  const professional = await fetchProfessional(slug, locale);

  // Unknown slug, DRAFT, PENDING and SUSPENDED all arrive here as null.
  if (!professional) {
    notFound();
  }

  // Spec 35.1: the flag gates frontend exposure too; null means the API is unreachable, so render without the form.
  const inquiryConfig = await fetchInquiryConfig();

  const location = formatProfessionalLocation(professional);

  return (
    <main className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin-desktop">
      <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <header className="flex items-start gap-space-md">
            <ProfileMonogram name={professional.display_name} />
            <div>
              <h1 className="font-headline-md text-headline-md text-primary">
                {professional.display_name}
              </h1>
              {professional.categories.length > 0 ? (
                <ul className="mt-space-xs flex flex-wrap gap-space-xs">
                  {professional.categories.map((category) => (
                    <li
                      key={category.slug}
                      className="rounded-lg bg-secondary-container px-space-sm py-space-xs font-body-sm text-on-secondary-container"
                    >
                      <Link
                        href={`/services/professionals/?category=${encodeURIComponent(category.slug)}`}
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {location ? (
                <p className="mt-space-xs font-body-md text-on-surface-variant">{location}</p>
              ) : null}
              {/* The one-line summary is rendered, not metadata-only: it is in
                  the payload and spec 2.1 wants every real field a visitor
                  would expect to see on the page, not just in <head>. */}
              {professional.short_description ? (
                <p className="mt-space-sm max-w-xl font-body-md text-on-surface">
                  {professional.short_description}
                </p>
              ) : null}
              <p className="mt-space-sm max-w-xl font-body-sm text-on-surface-variant">
                {t("professional.status.active")}
              </p>
            </div>
          </header>

          {professional.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
            <img alt="" src={professional.logo_url} className="mt-space-md h-20 w-20 rounded-lg object-cover" />
          ) : null}

          {professional.description ? (
            <section aria-labelledby="about-heading" className="mt-space-xl">
              <h2 id="about-heading" className="font-title-lg text-title-lg text-primary">
                {t("professional.about.heading")}
              </h2>
              <p className="mt-space-sm whitespace-pre-line font-body-md text-on-surface">
                {professional.description}
              </p>
            </section>
          ) : null}

          {professional.team?.length > 0 ? (
            <section aria-labelledby="team-heading" className="mt-space-xl">
              <h2 id="team-heading" className="font-title-lg text-title-lg text-primary">
                {t("professional.team.heading")}
              </h2>
              <ul className="mt-space-sm grid gap-space-sm sm:grid-cols-2">
                {professional.team.map((member, index) => (
                  <li key={`${member.name}-${index}`} className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
                    <p className="font-title-md text-primary">{member.name}</p>
                    <p className="font-label-md text-on-surface-variant">{TEAM_ROLE_LABEL[member.role] ?? member.role}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {professional.services.length > 0 ? (
            <section aria-labelledby="services-heading" className="mt-space-xl">
              <h2 id="services-heading" className="font-title-lg text-title-lg text-primary">
                {t("professional.services.heading")}
              </h2>
              <ul className="mt-space-md space-y-space-md">
                {professional.services.map((service) => (
                  <li
                    key={service.id}
                    className="flex gap-space-md rounded-xl border border-outline-variant p-space-md"
                  >
                    {service.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                      <img alt="" src={service.photo_url} className="h-20 w-28 shrink-0 rounded-lg object-cover" />
                    ) : null}
                    <div>
                    <h3 className="font-title-lg text-title-lg text-on-surface">
                      {service.title}
                    </h3>
                    <p className="mt-space-xs font-body-sm text-on-surface-variant">
                      {service.category.name}
                    </p>
                    <p className="mt-space-xs font-body-sm font-semibold text-primary">
                      {service.price_from
                        ? `${t("professional.services.price_from")} ${formatPrice(service.price_from, service.currency || "EUR")}${service.pricing_note ? ` ${service.pricing_note}` : ""}`
                        : t("professional.services.quote_on_request")}
                    </p>
                    {service.description ? (
                      <p className="mt-space-sm font-body-md text-on-surface">
                        {service.description}
                      </p>
                    ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {professional.service_area.length > 0 ? (
            <section aria-labelledby="area-heading" className="mt-space-xl">
              <h2 id="area-heading" className="font-title-lg text-title-lg text-primary">
                {t("professional.service_area.heading")}
              </h2>
              <ul className="mt-space-sm flex flex-wrap gap-space-xs">
                {professional.service_area.map((area) => (
                  <li
                    key={area}
                    className="rounded-lg border border-outline-variant px-space-sm py-space-xs font-body-sm text-on-surface-variant"
                  >
                    {area}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

        </div>

        <aside className="flex flex-col gap-space-lg">
          {/* Spec 14.2's contact panel. A client component that fetches
              GET /api/v1/contacts/professional/<id>/ after mount, so this
              server-rendered HTML contains no contact value at all, masked or
              otherwise (spec 16). */}
          <ContactPanel
            targetType="professional"
            targetId={professional.id}
            locale={locale}
          />

          {inquiryConfig?.enabled ? (
            <InquiryForm
              context={{
                type: "PROFESSIONAL",
                id: professional.id,
                label: professional.display_name,
              }}
              config={inquiryConfig}
              locale={locale}
            />
          ) : null}

          {/* Portfolio/gallery is absent: spec 14.2 permits it "only when real
              backend records exist" and no media model exists yet (Phase 15). */}

          {professional.related.length > 0 ? (
            <section aria-labelledby="related-heading">
              <h2 id="related-heading" className="font-title-lg text-title-lg text-primary">
                {t("professional.related.heading")}
              </h2>
              <ul className="mt-space-md space-y-space-sm">
                {professional.related.map((peer) => (
                  <li
                    key={peer.slug}
                    className="rounded-xl border border-outline-variant p-space-md"
                  >
                    <Link
                      href={peer.url}
                      className="font-body-md text-secondary underline"
                    >
                      {peer.display_name}
                    </Link>
                    {peer.city ? (
                      <p className="mt-space-xs font-body-sm text-on-surface-variant">
                        {peer.city}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
