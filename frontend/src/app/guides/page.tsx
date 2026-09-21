import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";

import AdSlot from "@/components/content/AdSlot";
import { fetchGuides } from "@/lib/api/contentServer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nautical guides",
  description: "Practical guides on buying, selling and maintaining a boat in Spain and Italy.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GuidesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = first(params.page);
  const category = first(params.category) ?? "";
  const guides = await fetchGuides({ page, category });
  const nextPage = guides.next ? new URL(guides.next).searchParams.get("page") : null;
  const previousPage = guides.previous ? (new URL(guides.previous).searchParams.get("page") ?? "1") : null;
  const href = (target: string) => `/guides/?page=${target}${category ? `&category=${encodeURIComponent(category)}` : ""}`;

  const categories = guides.categories ?? [];
  const featured = !category && !previousPage ? guides.results[0] : undefined;
  const rest = featured ? guides.results.slice(1) : guides.results;
  const pill = (active: boolean) =>
    `px-4 py-2 rounded-lg font-title-md text-title-md shadow-sm transition-all duration-150 ${
      active ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container"
    }`;
  const dateOf = (value: string | null) => (value ? new Date(value).toLocaleDateString("en", { month: "long", year: "numeric" }) : "");

  return (
    <main className="w-full bg-surface">
      <section className="w-full bg-surface-container-low py-space-xl">
        <div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
          <div className="flex flex-col gap-space-sm max-w-4xl">
            <div className="flex items-center gap-space-xs font-label-md text-label-md text-secondary tracking-wider uppercase">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">menu_book</span>
              <span>Editorial intelligence &amp; maritime advisory</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Nautical guides</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl leading-relaxed">
              Practical guides on buying, selling and maintaining a boat, with legal and maintenance advice for owners and sailors in Spain and Italy.
            </p>
          </div>
          {categories.length > 0 ? (
            <nav aria-label="Guides category filter" className="mt-space-lg flex flex-wrap items-center gap-space-xs">
              <Link href="/guides/" className={pill(!category)} aria-current={!category ? "true" : undefined}>
                All guides
              </Link>
              {categories.map((name) => (
                <Link key={name} href={`/guides/?category=${encodeURIComponent(name)}`} className={pill(category.toLowerCase() === name.toLowerCase())}>
                  {name}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </section>
      <div className="mx-auto max-w-[1440px] px-margin-mobile py-space-xl md:px-margin lg:px-margin-desktop flex flex-col gap-space-2xl">
        {guides.results.length === 0 ? (
          <p className="font-body-md text-on-surface-variant">No guides have been published yet.</p>
        ) : null}

        {featured ? (
          <article className="w-full bg-surface-container-lowest rounded-xl shadow-md overflow-hidden transition-all duration-200 hover:shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
              <div className="lg:col-span-7 relative min-h-[260px] lg:min-h-full bg-surface-container-high">
                {featured.hero_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- editorial image, size unknown
                  <img src={featured.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
                <div className="absolute top-space-md left-space-md">
                  <span className="px-3 py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-full font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider shadow-sm">Featured</span>
                </div>
              </div>
              <div className="lg:col-span-5 p-space-lg lg:p-space-xl flex flex-col justify-between bg-surface-container-lowest">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between gap-space-sm">
                    {featured.category ? (
                      <span className="px-3 py-1 bg-surface-container-high rounded-full font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider">{featured.category}</span>
                    ) : <span />}
                    <span className="font-label-md text-label-md text-outline">{dateOf(featured.published_at)}</span>
                  </div>
                  <h2 className="font-headline-md text-headline-md text-primary pt-space-xs leading-snug">
                    <Link href={`/guides/${featured.slug}/`} className="hover:text-secondary transition-colors">{featured.title}</Link>
                  </h2>
                  {featured.excerpt ? <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{featured.excerpt}</p> : null}
                </div>
                <div className="pt-space-lg mt-space-sm flex items-center justify-between gap-space-md">
                  {featured.author_name ? <span className="font-title-md text-title-md text-primary font-medium">{featured.author_name}</span> : <span />}
                  <Link href={`/guides/${featured.slug}/`} className="inline-flex items-center gap-space-xs bg-primary text-on-primary hover:bg-primary-container px-space-md py-space-sm rounded-lg font-title-md text-title-md transition-colors shadow-sm">
                    Read guide
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ) : null}

        {rest.length > 0 ? (
          <ul className="grid grid-cols-1 gap-space-lg sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((guide) => (
              <li key={guide.slug} className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
                <Link href={`/guides/${guide.slug}/`} className="block h-full">
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
        ) : null}

        <AdSlot placement="GUIDES" />

        {previousPage || nextPage ? (
          <nav aria-label="Guides pages" className="flex items-center justify-center gap-space-sm">
            {previousPage ? <Link href={href(previousPage)} rel="prev" className="px-space-md py-space-sm rounded bg-surface-container-lowest text-primary shadow-sm">Previous</Link> : null}
            {nextPage ? <Link href={href(nextPage)} rel="next" className="px-space-md py-space-sm rounded bg-surface-container-lowest text-primary shadow-sm">Next</Link> : null}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
