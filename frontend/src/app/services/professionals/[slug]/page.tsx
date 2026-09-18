import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ProfileMonogram from "@/components/directory/ProfileMonogram";
import { fetchProfessional, formatProfessionalLocation } from "@/lib/api/directory";
import { DEFAULT_LOCALE, t } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise. Verify against node_modules/next/dist/docs/
// before changing this signature.
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const professional = await fetchProfessional(slug, DEFAULT_LOCALE);
  if (!professional) {
    return { title: t(DEFAULT_LOCALE, "directory.services_professionals.title") };
  }
  return {
    title: professional.display_name,
    description: professional.short_description || undefined,
    // Spec 1: /services/professionals/<professional-slug>/ is the canonical URL.
    alternates: { canonical: professional.url },
  };
}

export default async function ProfessionalDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const locale = DEFAULT_LOCALE;
  const professional = await fetchProfessional(slug, locale);

  // Unknown slug, DRAFT, PENDING and SUSPENDED all arrive here as null.
  if (!professional) {
    notFound();
  }

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
                {t(locale, "professional.status.active")}
              </p>
            </div>
          </header>

          {professional.description ? (
            <section aria-labelledby="about-heading" className="mt-space-xl">
              <h2 id="about-heading" className="font-title-lg text-title-lg text-primary">
                {t(locale, "professional.about.heading")}
              </h2>
              <p className="mt-space-sm whitespace-pre-line font-body-md text-on-surface">
                {professional.description}
              </p>
            </section>
          ) : null}

          {professional.services.length > 0 ? (
            <section aria-labelledby="services-heading" className="mt-space-xl">
              <h2 id="services-heading" className="font-title-lg text-title-lg text-primary">
                {t(locale, "professional.services.heading")}
              </h2>
              <ul className="mt-space-md space-y-space-md">
                {professional.services.map((service) => (
                  <li
                    key={service.id}
                    className="rounded-xl border border-outline-variant p-space-md"
                  >
                    <h3 className="font-title-lg text-title-lg text-on-surface">
                      {service.title}
                    </h3>
                    <p className="mt-space-xs font-body-sm text-on-surface-variant">
                      {service.category.name}
                    </p>
                    {service.description ? (
                      <p className="mt-space-sm font-body-md text-on-surface">
                        {service.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {professional.service_area.length > 0 ? (
            <section aria-labelledby="area-heading" className="mt-space-xl">
              <h2 id="area-heading" className="font-title-lg text-title-lg text-primary">
                {t(locale, "professional.service_area.heading")}
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

          {/* PHASE 6 SEAM — the shared InquiryForm mounts here.
              Spec 14.2 requires a shared inquiry form on this page and spec
              15.1/39 forbid a professional-specific copy, so Phase 6 renders
              <InquiryForm context={{ type: "PROFESSIONAL", id: professional.id }} />
              at this position. Nothing is rendered in the meantime: a
              non-functional form would be the visual-only implementation
              spec 39 prohibits. */}
        </div>

        <aside>
          {/* PHASE 7 SEAM — the contact panel governed by ContactAccessService
              mounts here, as <ContactPanel targetType="PROFESSIONAL"
              targetId={professional.id} />. It is not rendered now and no
              contact data reaches this page: public_email, public_phone and
              website_url are absent from the API payload by design, so there is
              nothing to blur and nothing to leak (spec 1, spec 39). */}

          {/* Portfolio/gallery is absent: spec 14.2 permits it "only when real
              backend records exist" and no media model exists yet (Phase 15). */}

          {professional.related.length > 0 ? (
            <section aria-labelledby="related-heading">
              <h2 id="related-heading" className="font-title-lg text-title-lg text-primary">
                {t(locale, "professional.related.heading")}
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
