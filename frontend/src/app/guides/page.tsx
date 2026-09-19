import type { Metadata } from "next";
import Link from "next/link";

import AdSlot from "@/components/content/AdSlot";
import PageBand from "@/components/layout/PageBand";
import { fetchGuides } from "@/lib/api/contentServer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nautical guides",
  description: "Practical guides on buying, selling and maintaining a boat in Spain and Italy.",
  alternates: { canonical: "/guides/" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GuidesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = first(params.page);
  const category = first(params.category);
  const guides = await fetchGuides({ page, category });
  const nextPage = guides.next ? new URL(guides.next).searchParams.get("page") : null;
  const previousPage = guides.previous ? (new URL(guides.previous).searchParams.get("page") ?? "1") : null;
  const href = (target: string) => `/guides/?page=${target}${category ? `&category=${encodeURIComponent(category)}` : ""}`;

  return (
    <main className="w-full bg-surface">
      <PageBand
        eyebrow="Knowledge & advisory"
        title="Guides to buying, selling and maintaining your boat"
        subtitle="Actionable nautical insights, legal guidance and maintenance advice for Spain and Italy."
      />
      <div className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin lg:px-margin-desktop">
        {guides.results.length === 0 ? (
          <p className="font-body-md text-on-surface-variant">No guides have been published yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-space-lg sm:grid-cols-2 lg:grid-cols-3">
            {guides.results.map((guide) => (
              <li key={guide.slug} className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
                <Link href={`/guides/${guide.slug}/`} className="block">
                  {guide.hero_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- editorial image, size unknown
                    <img src={guide.hero_image_url} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                  ) : (
                    <div aria-hidden="true" className="aspect-[16/10] w-full bg-surface-container-high" />
                  )}
                  <div className="p-space-md">
                    {guide.category ? (
                      <span className="font-label-sm uppercase tracking-widest text-secondary">{guide.category}</span>
                    ) : null}
                    <h2 className="mt-1 font-title-lg text-title-lg text-primary">{guide.title}</h2>
                    {guide.excerpt ? <p className="mt-space-xs font-body-md text-on-surface-variant">{guide.excerpt}</p> : null}
                    <p className="mt-space-sm font-label-md text-secondary">Read guide →</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {previousPage || nextPage ? (
          <nav aria-label="Guides pages" className="mt-space-lg flex justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
            {previousPage ? <Link href={href(previousPage)} rel="prev">Previous</Link> : <span />}
            {nextPage ? <Link href={href(nextPage)} rel="next">Next</Link> : null}
          </nav>
        ) : null}

        <div className="mt-space-xl">
          <AdSlot placement="GUIDES" />
        </div>
      </div>
    </main>
  );
}
