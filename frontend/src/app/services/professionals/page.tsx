import { getRequestLocale } from "@/lib/i18n/requestLocale";
import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";
import { notFound } from "next/navigation";

import { fetchProfessionals, fetchServiceCategories, formatProfessionalLocation } from "@/lib/api/directory";
import { DEFAULT_LOCALE, t } from "@/lib/i18n/directory";

import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";

// Spec 1: canonical combined URL.
const CANONICAL_PATH = "/services/professionals/";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("directory.services_professionals.title"),
    description: t("directory.intro"),
  };
}

// Next 16: searchParams is a Promise. Verify against
// node_modules/next/dist/docs/ before changing this signature.
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// The API's `next`/`previous` are absolute API URLs (http://api-host/api/v1/...)
// and must never be rendered as hrefs — they would send the visitor off the
// site. They are used only as the truthy/falsy signal for "another page
// exists"; the href is rebuilt against this page's own canonical URL, carrying
// the active filters so paging does not silently reset the search.
function pageHref(
  filters: { q?: string; category?: string; location?: string; sort?: string },
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      search.set(key, value);
    }
  }
  // Page 1 is the bare URL: ?page=1 would make the first page reachable at two
  // different URLs, which is the duplicate-content signal spec 32.2 avoids.
  if (page > 1) {
    search.set("page", String(page));
  }
  const serialized = search.toString();
  return serialized ? `${CANONICAL_PATH}?${serialized}` : CANONICAL_PATH;
}

const PAGINATION_LINK_CLASS =
  "rounded-lg border border-outline-variant px-space-md py-space-sm font-label-md text-label-md text-primary";

const DESIGN_PHOTOS = ["/design/e4d0158cd3.jpg", "/design/6e536ead8f.jpg", "/design/018863299d.jpg", "/design/1b4bad5160.jpg", "/design/22fe9bf3e3.jpg", "/design/24fcaabe59.jpg"];

export default async function CombinedDirectoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const t = await getT();
  const filters = {
    q: first(params.q),
    category: first(params.category),
    location: first(params.location),
    sort: first(params.sort),
    page: first(params.page),
  };

  const [categories, results] = await Promise.all([
    fetchServiceCategories(locale),
    fetchProfessionals(filters, locale),
  ]);

  // Spec 35.1: the flag gates frontend exposure, not just the API. Either
  // endpoint answering 404 means combined_services_professionals is off, so
  // the whole page stops existing — exactly what the detail page and the six
  // SEO pages already do, and what Task 6's CombinedDirectoryEnabled docstring
  // assumes ("the Next.js pages already handle 404"). An empty array here is a
  // different thing entirely and still renders the real empty state below.
  if (categories === null || results === null) {
    notFound();
  }

  // A junk or absent ?page= falls back to 1: the API already ignores it the
  // same way, and NaN here would produce "?page=NaN" links.
  const parsedPage = Number.parseInt(filters.page ?? "", 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const linkFilters = {
    q: filters.q,
    category: filters.category,
    location: filters.location,
    sort: filters.sort,
  };

  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="w-full max-w-7xl mx-auto px-margin-mobile lg:px-margin-desktop pt-space-md pb-space-sm">
<nav aria-label="Breadcrumb" className="flex items-center gap-space-xs text-on-surface-variant font-label-md text-label-md">
<Link href="/" className="hover:text-primary transition-colors flex items-center gap-1" >
<span className="material-symbols-outlined text-[16px]">home</span>
<span>Home</span>
</Link>
<span className="material-symbols-outlined text-[14px] text-outline-variant">chevron_right</span>
<span className="text-primary font-semibold">Services &amp; Nautical Professionals</span>
</nav>
</section>

<section className="w-full max-w-7xl mx-auto px-margin-mobile lg:px-margin-desktop pt-space-md pb-space-xl">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-end mb-space-xl">
<div className="lg:col-span-8 space-y-space-sm">
<div className="inline-flex items-center gap-space-xs bg-surface-container-high px-space-sm py-space-xs rounded-full">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase">Boat services and specialists</span>
</div>
<h1 className="font-display-hero text-display-hero text-primary tracking-tight">
          Services and specialists for your boat
        </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl leading-relaxed">
          Find surveyors, lawyers, insurers, engineers and delivery skippers for buying, selling or looking after a boat in Spain and Italy.
        </p>
</div>

<div className="lg:col-span-4 flex flex-col justify-end">
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
<div>
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest block">Where we work</span>
<span className="font-headline-md text-headline-md text-primary font-spec-num">ES · IT</span>
<span className="font-body-sm text-body-sm text-secondary block">Spain and Italy</span>
</div>
<div className="h-10 w-px bg-surface-container-high"></div>
<div>
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest block">Languages</span>
<span className="font-headline-md text-headline-md text-primary font-spec-num">EN · IT · ES</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block">Pages and messages</span>
</div>
</div>
</div>
</div>

</section>

<section className="w-full max-w-7xl mx-auto px-margin-mobile lg:px-margin-desktop py-space-xl" id="directory-section">
<div className="flex flex-col md:flex-row md:items-end justify-between mb-space-lg gap-space-sm">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-space-xs font-semibold">Professionals</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">Find a professional</h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
        Contact surveyors, lawyers and other specialists directly. NAUTA does not take a commission on their work.
      </p>
</div>

<form action="/services/professionals/" method="get" className="bg-surface-container-low p-space-md rounded-xl mb-space-xl">
{filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
<div className="grid grid-cols-1 md:grid-cols-4 gap-space-md items-end">
<div>
<label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-space-xs" htmlFor="locationFilter">Port / Region</label>
<input id="locationFilter" name="location" defaultValue={filters.location ?? ""} placeholder="e.g. Palma, Genoa" className="w-full bg-surface-container-lowest px-space-md py-space-sm rounded text-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary" />
</div>
<div>
<label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-space-xs" htmlFor="categoryFilter">Specialization</label>
<select id="categoryFilter" name="category" defaultValue={filters.category ?? ""} className="w-full bg-surface-container-lowest px-space-md py-space-sm rounded text-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary">
<option value="">All Specializations</option>
{categories.map((category) => (
<option key={category.slug} value={category.slug}>{category.name}</option>
))}
</select>
</div>
<div>
<label className="block font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-space-xs" htmlFor="sortFilter">Sort</label>
<select id="sortFilter" name="sort" defaultValue={filters.sort ?? ""} className="w-full bg-surface-container-lowest px-space-md py-space-sm rounded text-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary">
<option value="">Recommended</option>
<option value="name">Name</option>
<option value="newest">Newest</option>
</select>
</div>
<button type="submit" className="w-full px-space-xl py-space-sm bg-primary text-on-primary rounded font-title-md text-title-md hover:bg-primary-container transition-colors">Update directory</button>
</div>
</form>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-desktop" id="professionalsGrid">

{results.results.length === 0 ? (
<p className="font-body-md text-on-surface-variant md:col-span-2 lg:col-span-3">{t("directory.results.empty")}</p>
) : results.results.map((professional, index) => {
const place = formatProfessionalLocation(professional);
const photo = DESIGN_PHOTOS[index % DESIGN_PHOTOS.length];
return (
<article key={professional.id} className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="h-48 w-full overflow-hidden relative">
{/* eslint-disable-next-line @next/next/no-img-element -- decorative design photo */}
<img alt="" className="w-full h-full object-cover" src={photo} />
{place ? (
<div data-testid="professional-location" className="absolute top-space-sm left-space-sm bg-surface-container-lowest/90 backdrop-blur px-space-sm py-0.5 rounded-full font-label-sm text-label-sm text-primary flex items-center gap-1">
<span className="material-symbols-outlined text-[14px] text-secondary">location_on</span>
<span>{place}</span>
</div>
) : null}
</div>
<div className="p-space-lg">
{professional.categories.length > 0 ? (
<div className="flex items-center gap-space-xs mb-space-xs">
<span className="font-label-sm text-label-sm text-secondary font-semibold uppercase">{professional.categories.map((category) => category.name).join(" · ")}</span>
</div>
) : null}
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">{professional.display_name}</h3>
{professional.short_description ? (
<p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">{professional.short_description}</p>
) : null}
{professional.service_area.length > 0 ? (
<div className="flex items-center gap-space-xs text-on-surface-variant font-label-md text-label-md">
<span className="material-symbols-outlined text-[16px] text-outline">anchor</span>
<span>Service area: {professional.service_area.join(", ")}</span>
</div>
) : null}
</div>
</div>
<div className="p-space-lg pt-0">
<Link href={professional.url} className="w-full inline-flex items-center justify-center gap-space-xs py-space-sm bg-primary text-on-primary rounded font-title-md text-title-md hover:bg-primary-container transition-colors">
<span>View Profile &amp; Request Quote</span>
<span className="material-symbols-outlined text-[16px]">chevron_right</span>
</Link>
</div>
</article>
);
})}

{results.previous || results.next ? (
<nav aria-label={t("directory.results.heading")} className="flex gap-space-md md:col-span-2 lg:col-span-3">
{results.previous ? (
<Link href={pageHref(linkFilters, currentPage - 1)} rel="prev" className={PAGINATION_LINK_CLASS}>{t("directory.pagination.previous")}</Link>
) : null}
{results.next ? (
<Link href={pageHref(linkFilters, currentPage + 1)} rel="next" className={PAGINATION_LINK_CLASS}>{t("directory.pagination.next")}</Link>
) : null}
</nav>
) : null}
</div>
</section>

<section className="w-full max-w-7xl mx-auto px-margin-mobile lg:px-margin-desktop py-space-lg">
<div className="bg-surface-container-low rounded-xl p-space-lg lg:p-space-xl relative overflow-hidden">

<div className="flex items-center justify-between mb-space-md">
<span className="font-label-sm text-label-sm text-outline uppercase tracking-widest bg-surface-container px-space-sm py-0.5 rounded">
          Advertisement
        </span>
<span className="font-label-sm text-label-sm text-outline">Partner Notice</span>
</div>
<div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-center">
<div className="lg:col-span-8 space-y-space-xs">
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-semibold">Tirreno Marine Chronometers &amp; Bridge Systems</span>
<h3 className="font-headline-md text-headline-md text-primary tracking-tight">
            Precision Marine Horology for Mediterranean Blue-Water Navigation
          </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Engineered in La Spezia for naval navigators and yacht skippers demanding Swiss mechanical escapements, magnetic shielding, and barometric logging.
          </p>
<div className="pt-space-sm">
<Link href="/services/professionals/" className="inline-flex items-center gap-space-xs font-title-md text-title-md text-secondary hover:text-primary transition-colors" >
<span>Explore the 2026 Coastal Navigational Edition</span>
<span className="material-symbols-outlined text-[16px]">arrow_outward</span>
</Link>
</div>
</div>
<div className="lg:col-span-4 flex justify-end">
<div className="h-32 w-full lg:w-48 bg-surface-container rounded-lg flex items-center justify-center p-space-md text-center">
<div>
<span className="material-symbols-outlined text-[36px] text-outline mb-1">watch</span>
<p className="font-label-sm text-label-sm text-on-surface-variant font-semibold">TIRRENO NAUTICA</p>
<span className="font-label-sm text-label-sm text-outline block">La Spezia · 1954</span>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full max-w-7xl mx-auto px-margin-mobile lg:px-margin-desktop py-space-2xl">
<div className="bg-primary text-on-primary rounded-xl p-space-xl lg:p-space-2xl relative overflow-hidden shadow-xl">

<div className="absolute right-space-xl top-space-xl opacity-10 pointer-events-none hidden lg:block">
<span className="material-symbols-outlined text-[180px]">sailing</span>
</div>
<div className="max-w-2xl space-y-space-md relative z-10">
<div className="inline-flex items-center gap-space-xs bg-surface-container-low/10 px-space-sm py-space-xs rounded-full">
<span className="w-2 h-2 rounded-full bg-secondary-fixed"></span>
<span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">Independent Professional Membership</span>
</div>
<h2 className="font-headline-lg text-headline-lg text-on-primary tracking-tight">
          Are you a nautical service provider or marine surveyor in the Mediterranean?
        </h2>
<p className="font-body-lg text-body-lg text-surface-container-highest leading-relaxed">
          List your firm in the NAUTA professional index. Connect directly with yacht purchasers, skippers, and private boat owners across Spain, Italy, and coastal yacht havens with complete independence.
        </p>
<div className="pt-space-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md">
<Link href="/register/" className="inline-flex items-center justify-center gap-space-xs px-space-xl py-space-md bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed rounded font-title-md text-title-md transition-colors shadow-sm" >
<span className="material-symbols-outlined text-[18px]">verified</span>
<span>Join the Directory as a Professional</span>
</Link>
<Link href="#directory-section" className="inline-flex items-center justify-center gap-space-xs px-space-lg py-space-md text-on-primary hover:text-secondary-fixed rounded font-title-md text-title-md transition-colors" >
<span>Learn About Directory Standards</span>
<span className="material-symbols-outlined text-[18px]">arrow_downward</span>
</Link>
</div>
</div>
</div>
</section>

<section className="w-full max-w-7xl mx-auto px-margin-mobile lg:px-margin-desktop pb-space-lg">
<div className="bg-surface-container-low rounded-lg p-space-md text-center">
<p className="font-body-sm text-body-sm text-on-surface-variant max-w-4xl mx-auto leading-relaxed">
        NAUTA is an independent discovery marketplace. All services shown are provided directly by independent professionals, and all identities and examples are fictional demonstration content.
      </p>
</div>
</section>
</div>


    </main>
  );
}
