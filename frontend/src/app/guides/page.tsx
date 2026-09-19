import Link from "next/link";

export default function GuidesPage() {
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="w-full bg-surface-container-low py-space-xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col gap-space-sm max-w-4xl">
<div className="flex items-center gap-space-xs font-label-md text-label-md text-secondary tracking-wider uppercase">
<span className="material-symbols-outlined text-[16px]">menu_book</span>
<span>Editorial Intelligence &amp; Maritime Advisory</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Nautical guides</h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl leading-relaxed">
          In-depth editorial resources, legal frameworks, maintenance protocols, and maritime purchase advice for yacht owners and sailors in Spain and Italy.
        </p>
</div>

<div className="mt-space-lg flex flex-wrap items-center justify-between gap-space-md pt-space-md">
<nav aria-label="Guides category filter" className="flex flex-wrap items-center gap-space-xs" id="category-filter-nav">
<button className="category-pill active px-4 py-2 rounded-lg font-title-md text-title-md bg-primary text-on-primary shadow-sm transition-all duration-150" data-category="all" type="button">
            All guides
          </button>
<button className="category-pill px-4 py-2 rounded-lg font-title-md text-title-md bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all duration-150 shadow-sm" data-category="buying" type="button">
            Buying
          </button>
<button className="category-pill px-4 py-2 rounded-lg font-title-md text-title-md bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all duration-150 shadow-sm" data-category="selling" type="button">
            Selling
          </button>
<button className="category-pill px-4 py-2 rounded-lg font-title-md text-title-md bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all duration-150 shadow-sm" data-category="maintenance" type="button">
            Maintenance
          </button>
<button className="category-pill px-4 py-2 rounded-lg font-title-md text-title-md bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all duration-150 shadow-sm" data-category="insurance" type="button">
            Insurance
          </button>
<button className="category-pill px-4 py-2 rounded-lg font-title-md text-title-md bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all duration-150 shadow-sm" data-category="legal-and-tax" type="button">
            Legal and tax
          </button>
<button className="category-pill px-4 py-2 rounded-lg font-title-md text-title-md bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all duration-150 shadow-sm" data-category="financing" type="button">
            Financing
          </button>
</nav>
<div className="hidden lg:flex items-center gap-space-xs font-label-md text-label-md text-outline">
<span>Showing verified Spanish &amp; Italian naval guides</span>
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
</div>
</div>
</div>
</section>

<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl w-full flex flex-col gap-space-2xl">

<article className="w-full bg-surface-container-lowest rounded-xl shadow-md overflow-hidden transition-all duration-200 hover:shadow-xl">
<div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">

<div className="lg:col-span-7 relative min-h-[320px] lg:min-h-full">
<img alt="" className="absolute inset-0 w-full h-full object-cover" src="/design/3c22acc6af.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-primary/60 via-primary/20 to-transparent"></div>
<div className="absolute top-space-md left-space-md flex items-center gap-space-xs">
<span className="px-3 py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-full font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider shadow-sm">
              Featured Analysis
            </span>
</div>
</div>

<div className="lg:col-span-5 p-space-lg lg:p-space-xl flex flex-col justify-between bg-surface-container-lowest">
<div className="flex flex-col gap-space-sm">
<div className="flex items-center justify-between gap-space-sm">
<span className="px-3 py-1 bg-surface-container-high rounded-full font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider">
                Legal and tax
              </span>
<span className="font-label-md text-label-md text-outline flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">schedule</span>
                8 min read · October 2025
              </span>
</div>
<h2 className="font-headline-md text-headline-md text-primary pt-space-xs leading-snug">
<Link href="#" className="hover:text-secondary transition-colors" >
                Navigating Spanish Matriculación (IEDMT) and Italian Maritime Taxation for Cross-Border Vessel Purchases
              </Link>
</h2>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              A comprehensive analysis of bilateral tax exposure when importing, flagging, or mooring private pleasure crafts exceeding 8m LOA across the Balearics and Ligurian coast.
            </p>
</div>
<div className="pt-space-lg mt-space-sm flex items-center justify-between gap-space-md">
<div className="flex items-center gap-space-sm">
<div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[20px]">gavel</span>
</div>
<div className="flex flex-col">
<span className="font-title-md text-title-md text-primary font-medium">Nauta Maritime Legal Desk</span>
<span className="font-body-sm text-body-sm text-outline">Valencia · Genoa Chambers</span>
</div>
</div>
<Link href="#" className="inline-flex items-center gap-space-xs bg-primary text-on-primary hover:bg-primary-container px-space-md py-space-sm rounded-lg font-title-md text-title-md transition-colors shadow-sm" >
<span>Read guide</span>
<span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
</div>
</div>
</div>
</article>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
<div className="relative w-full aspect-[16/10] bg-surface-container-high overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="/design/2690a5e9b1.jpg"/>
<div className="absolute top-space-sm left-space-sm">
<span className="px-2.5 py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-full font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider shadow-sm">
              Buying
            </span>
</div>
</div>
<div className="p-space-lg flex-1 flex flex-col justify-between">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center gap-1 font-label-sm text-label-sm text-outline mb-space-xs">
<span>6 min read</span>
<span>·</span>
<span>September 2025</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
<Link href="#" >Essential Pre-Purchase Hull &amp; Engine Survey Checklist for Mediterranean Motor Yachts</Link>
</h3>
<p className="font-body-md text-body-md text-on-surface-variant line-clamp-3 mt-space-xs">
              From hydrostatic moisture checks on fiberglass hulls to oil spectroscopy reports for twin MAN or Volvo Penta installations prior to signing binding deeds.
            </p>
</div>
<div className="pt-space-md flex items-center justify-between text-secondary font-title-md text-title-md">
<span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Explore checklist <span className="material-symbols-outlined text-[18px]">east</span>
</span>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
<div className="relative w-full aspect-[16/10] bg-surface-container-high overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="/design/50fb51f676.jpg"/>
<div className="absolute top-space-sm left-space-sm">
<span className="px-2.5 py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-full font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider shadow-sm">
              Maintenance
            </span>
</div>
</div>
<div className="p-space-lg flex-1 flex flex-col justify-between">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center gap-1 font-label-sm text-label-sm text-outline mb-space-xs">
<span>10 min read</span>
<span>·</span>
<span>September 2025</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
<Link href="#" >Winterisation Protocols: Raw-Water Flushing, Sacrificial Anodes, and Engine Layup Schedules</Link>
</h3>
<p className="font-body-md text-body-md text-on-surface-variant line-clamp-3 mt-space-xs">
              Safeguard your power plant against salinity corrosion, bilge humidity, and heat exchanger crystallization during winter berths along Costa Brava and Sardinia.
            </p>
</div>
<div className="pt-space-md flex items-center justify-between text-secondary font-title-md text-title-md">
<span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Review protocol <span className="material-symbols-outlined text-[18px]">east</span>
</span>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
<div className="relative w-full aspect-[16/10] bg-surface-container-high overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="/design/9bb9f59ce0.jpg"/>
<div className="absolute top-space-sm left-space-sm">
<span className="px-2.5 py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-full font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider shadow-sm">
              Insurance
            </span>
</div>
</div>
<div className="p-space-lg flex-1 flex flex-col justify-between">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center gap-1 font-label-sm text-label-sm text-outline mb-space-xs">
<span>7 min read</span>
<span>·</span>
<span>August 2025</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
<Link href="#" >Agreed Fixed Value vs. Actual Cash Value: Structuring All-Risk Mediterranean Marine Cover</Link>
</h3>
<p className="font-body-md text-body-md text-on-surface-variant line-clamp-3 mt-space-xs">
              Critical policy stipulations concerning total constructive loss, salvage rights in international straits, and machinery breakdown endorsements.
            </p>
</div>
<div className="pt-space-md flex items-center justify-between text-secondary font-title-md text-title-md">
<span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Policy guidance <span className="material-symbols-outlined text-[18px]">east</span>
</span>
</div>
</div>
</article>
</div>

<aside className="w-full bg-surface-container-high rounded-xl p-space-md md:p-space-lg shadow-sm relative overflow-hidden">
<div className="flex flex-col lg:flex-row items-center justify-between gap-space-lg">

<div className="flex flex-col gap-space-xs z-10 max-w-2xl">
<div className="flex items-center gap-space-sm">
<span className="font-label-sm text-label-sm tracking-widest text-outline uppercase font-semibold bg-surface-container-lowest px-2 py-0.5 rounded">
              ADVERTISEMENT
            </span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Sponsored Mooring Advisory</span>
</div>
<h4 className="font-headline-sm text-headline-sm text-primary tracking-tight">
            Marina di Portofino — Berthing Inquiries &amp; Winter Mooring Reserves
          </h4>
<p className="font-body-md text-body-md text-on-surface-variant">
            Guaranteed berths for pleasure craft from 14m to 45m LOA. Secured shore power, sheltered deep-water berths, and 24/7 technical surveillance in the heart of the Italian Riviera.
          </p>
</div>

<div className="flex items-center gap-space-lg shrink-0 z-10 w-full lg:w-auto justify-between lg:justify-end">
<div className="hidden sm:flex flex-col text-right">
<span className="font-label-sm text-label-sm text-outline uppercase">Winter Term 2025/2026</span>
<span className="font-title-md text-title-md text-primary font-bold">Limited Slip Availability</span>
</div>
<Link href="#" className="px-space-md py-space-sm bg-primary text-on-primary hover:bg-primary-container rounded-lg font-title-md text-title-md shadow-sm transition-colors flex items-center gap-2" >
<span>Reserve Berth</span>
<span className="material-symbols-outlined text-[18px]">anchor</span>
</Link>
</div>
</div>

<div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none bg-gradient-to-l from-primary to-transparent hidden md:block"></div>
</aside>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
<div className="relative w-full aspect-[16/10] bg-surface-container-high overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="/design/f8438f5a43.jpg"/>
<div className="absolute top-space-sm left-space-sm">
<span className="px-2.5 py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-full font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider shadow-sm">
              Selling
            </span>
</div>
</div>
<div className="p-space-lg flex-1 flex flex-col justify-between">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center gap-1 font-label-sm text-label-sm text-outline mb-space-xs">
<span>5 min read</span>
<span>·</span>
<span>August 2025</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
<Link href="#" >Preparing Your Yacht for Brokerage: Staging, Inventory Inventories, and Sea-Trial Readiness</Link>
</h3>
<p className="font-body-md text-body-md text-on-surface-variant line-clamp-3 mt-space-xs">
              How meticulous logbook organization, aesthetic presentation, and verified equipment manifests drive premium valuations and faster completions across European networks.
            </p>
</div>
<div className="pt-space-md flex items-center justify-between text-secondary font-title-md text-title-md">
<span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Seller blueprint <span className="material-symbols-outlined text-[18px]">east</span>
</span>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
<div className="relative w-full aspect-[16/10] bg-surface-container-high overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="/design/d0456c6733.jpg"/>
<div className="absolute top-space-sm left-space-sm">
<span className="px-2.5 py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-full font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider shadow-sm">
              Financing
            </span>
</div>
</div>
<div className="p-space-lg flex-1 flex flex-col justify-between">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center gap-1 font-label-sm text-label-sm text-outline mb-space-xs">
<span>9 min read</span>
<span>·</span>
<span>July 2025</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
<Link href="#" >Nautical Leasing vs. Marine Loans in Spain and Italy: Fiscal Structuring Explained</Link>
</h3>
<p className="font-body-md text-body-md text-on-surface-variant line-clamp-3 mt-space-xs">
              A comparative evaluation of French, Italian, and Spanish leasing schemes, amortisation tables, residual buyout clauses, and VAT implications for private owners.
            </p>
</div>
<div className="pt-space-md flex items-center justify-between text-secondary font-title-md text-title-md">
<span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Compare options <span className="material-symbols-outlined text-[18px]">east</span>
</span>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
<div className="relative w-full aspect-[16/10] bg-surface-container-high overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="/design/22fe9bf3e3.jpg"/>
<div className="absolute top-space-sm left-space-sm">
<span className="px-2.5 py-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-full font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider shadow-sm">
              Legal and tax
            </span>
</div>
</div>
<div className="p-space-lg flex-1 flex flex-col justify-between">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center gap-1 font-label-sm text-label-sm text-outline mb-space-xs">
<span>8 min read</span>
<span>·</span>
<span>July 2025</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
<Link href="#" >Italian RID Deregistration and Flag Transfers: Timelines and Document Prerequisites</Link>
</h3>
<p className="font-body-md text-body-md text-on-surface-variant line-clamp-3 mt-space-xs">
              Step-by-step procedures for the cancellation of records from the Registro Internazionale Navale (RID) when changing flag to Poland, Malta, or the Spanish Capitania Maritima.
            </p>
</div>
<div className="pt-space-md flex items-center justify-between text-secondary font-title-md text-title-md">
<span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Read transfer guide <span className="material-symbols-outlined text-[18px]">east</span>
</span>
</div>
</div>
</article>
</div>

<nav aria-label="Pagination Navigation" className="flex items-center justify-center gap-space-xs pt-space-xl pb-space-lg">
<Link href="#" className="px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant hover:text-primary hover:bg-surface-container-high font-title-md text-title-md transition-colors flex items-center gap-1" >
<span className="material-symbols-outlined text-[18px]">chevron_left</span>
<span>Previous</span>
</Link>
<div className="flex items-center gap-space-xs px-space-sm">
<Link href="#" aria-current="page" className="w-10 h-10 rounded-lg bg-primary text-on-primary font-title-md text-title-md flex items-center justify-center font-semibold shadow-sm" >
          1
        </Link>
<Link href="#" className="w-10 h-10 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high font-title-md text-title-md flex items-center justify-center transition-colors" >
          2
        </Link>
<Link href="#" className="w-10 h-10 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high font-title-md text-title-md flex items-center justify-center transition-colors" >
          3
        </Link>
</div>
<Link href="#" className="px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant hover:text-primary hover:bg-surface-container-high font-title-md text-title-md transition-colors flex items-center gap-1" >
<span>Next</span>
<span className="material-symbols-outlined text-[18px]">chevron_right</span>
</Link>
</nav>
</div>
</div>

    </main>
  );
}
