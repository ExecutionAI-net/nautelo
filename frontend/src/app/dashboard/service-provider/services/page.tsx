import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function ProviderServices() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<div className="w-full bg-primary text-on-primary py-space-xs px-margin-mobile md:px-margin lg:px-margin-desktop shadow-sm">
<div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-space-sm">
<span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
<span className="font-label-sm uppercase tracking-wider text-secondary-fixed">Prototype Mode: Service Provider</span>
<span className="text-outline-variant">|</span>
<span className="font-medium text-on-primary">Talleres Navales del Mediterráneo S.L. (Palma de Mallorca, STP Shipyard)</span>
<span className="bg-primary-container text-on-primary-container text-[11px] px-2 py-0.5 rounded font-mono">B2B ID #TNM-7841</span>
</div>
<div className="flex items-center gap-space-md">
<button className="inline-flex items-center gap-1 text-secondary-fixed hover:text-on-secondary text-body-sm font-medium transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">switch_account</span>
<span>Switch Demo Role</span>
</button>
<span className="text-outline-variant">·</span>
<button className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-primary text-body-sm transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">logout</span>
<span>Log Out</span>
</button>
</div>
</div>
</div>

<div className="w-full bg-surface-container-low shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex items-center justify-between overflow-x-auto">
<nav className="flex items-center gap-space-md py-space-xs shrink-0 font-body-md">
<Link href="#" className="px-space-sm py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px]">dashboard</span>
<span>Overview</span>
</Link>
<Link href="#" className="px-space-sm py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px]">build_circle</span>
<span>Service Requests</span>
<span className="bg-secondary text-on-secondary font-label-sm px-1.5 py-0.5 rounded-full text-[10px]">7 Active</span>
</Link>
<Link href="#" className="px-space-sm py-2 rounded-lg bg-surface-container-lowest text-primary font-semibold shadow-sm flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px] text-secondary">inventory_2</span>
<span>Provider Services</span>
<span className="bg-surface-container text-primary font-label-sm px-1.5 py-0.5 rounded-full text-[10px]">4</span>
</Link>
<Link href="#" className="px-space-sm py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px]">badge</span>
<span>Professional Profile</span>
</Link>
<Link href="#" className="px-space-sm py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
<span>Escrow &amp; Invoices</span>
</Link>
</nav>
<div className="hidden lg:flex items-center gap-space-sm shrink-0 py-2">
<span className="inline-flex items-center gap-1.5 text-body-sm text-secondary font-medium bg-surface-container px-2.5 py-1 rounded-full">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
<span>RINA &amp; MCA Certified Yard</span>
</span>
<span className="text-body-sm text-on-surface-variant">VAT ES-B57891204</span>
</div>
</div>
</div>

<div className="max-w-[1440px] w-full mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="flex flex-col gap-space-xs max-w-3xl">
<div className="flex items-center gap-space-xs text-secondary font-label-md uppercase tracking-wider">
<span className="material-symbols-outlined text-[16px]">anchor</span>
<span>Nauta Shipyard &amp; Technical Services Catalog</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          Service Offerings &amp; Multilingual Catalog
        </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant">
          Configure your published shipyard and technical services, pricing models, and international multilingual descriptions for European yacht owners navigating the Western Mediterranean.
        </p>
</div>
<div className="flex items-center gap-space-sm shrink-0 flex-wrap">
<button className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-surface-container-lowest text-primary font-title-md text-title-md hover:bg-surface-container transition-all shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px] text-secondary">open_in_new</span>
<span>Preview Public Profile</span>
</button>
<button className="inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg bg-primary text-on-primary font-title-md text-title-md hover:bg-primary-container transition-all shadow-md" type="button">
<span className="material-symbols-outlined text-[18px]">add_circle</span>
<span>+ Add New Service</span>
</button>
</div>
</div>

<div className="w-full bg-surface-container-lowest rounded-xl shadow-md p-space-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-lg relative overflow-hidden">
<div className="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary"></div>
<div className="flex flex-col md:flex-row items-start md:items-center gap-space-lg">
<div className="w-14 h-14 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 shadow-inner">
<span className="material-symbols-outlined text-[32px] text-secondary">translate</span>
</div>
<div className="flex flex-col gap-1.5 max-w-2xl">
<div className="flex items-center gap-space-sm flex-wrap">
<span className="font-title-md text-title-md text-primary font-semibold">Nauta AI Technical Translation Engine</span>
<span className="bg-secondary-container text-on-secondary-container font-label-sm px-2 py-0.5 rounded font-mono">v2.4 Active</span>
<span className="bg-surface-container-high text-on-surface-variant font-label-sm px-2 py-0.5 rounded">RINA / MCA / Codice Navigazione Aligned</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
            All published service technical specifications are localized into Spanish (ES), Italian (IT), and English (EN) with verified maritime and mechanical terminology. Terminology accuracy is anchored to standardized nautical codes and manufacturer warranty criteria.
          </p>
<div className="flex flex-wrap items-center gap-space-sm pt-1">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-primary font-label-md">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
              EN (Master Source: Active)
            </span>
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-secondary font-label-md">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
              IT (Synced &amp; Reviewed · 100%)
            </span>
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-secondary font-label-md">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
              ES (Synced &amp; Reviewed · 100%)
            </span>
</div>
</div>
</div>
<div className="flex flex-col sm:flex-row items-center gap-space-sm shrink-0 w-full lg:w-auto">
<button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-space-md py-2.5 rounded-lg bg-secondary text-on-secondary hover:bg-on-secondary-container transition-all shadow-sm font-title-md text-title-md" id="trigger-sync-btn" type="button">
<span className="material-symbols-outlined text-[18px]">sync</span>
<span>Sync All Translations</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-1">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Catalog Coverage</span>
<div className="flex items-baseline justify-between mt-1">
<span className="font-headline-sm text-headline-sm text-primary font-semibold">4 Services</span>
<span className="text-secondary font-label-md font-semibold">3 Active · 1 Seasonal</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Covering STP, Port Adriano &amp; Puerto Portals</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-1">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Multilingual Completeness</span>
<div className="flex items-baseline justify-between mt-1">
<span className="font-headline-sm text-headline-sm text-secondary font-semibold">100%</span>
<span className="text-on-surface-variant font-label-md">12 of 12 Locales</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Validated against maritime glossary</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-1">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Escrow Conversion Rate</span>
<div className="flex items-baseline justify-between mt-1">
<span className="font-headline-sm text-headline-sm text-primary font-semibold">94.2%</span>
<span className="text-secondary font-label-md font-semibold">+8.4% MoM</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Average booking release: 3.2 days</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-1">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Pending RFQs / Inquiries</span>
<div className="flex items-baseline justify-between mt-1">
<span className="font-headline-sm text-headline-sm text-primary font-semibold">14 Open</span>
<span className="text-on-tertiary-container font-label-md font-semibold">5 Require Quote</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Average turnaround time: 1.8 hrs</span>
</div>
</div>

<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-md pt-space-xs">
<div className="flex items-center gap-space-sm overflow-x-auto pb-1">
<button className="px-3.5 py-1.5 rounded-full bg-primary text-on-primary font-body-sm text-body-sm font-medium shrink-0" type="button">All Offerings (4)</button>
<button className="px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-primary font-body-sm text-body-sm shrink-0" type="button">Engine &amp; Mechanical (2)</button>
<button className="px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-primary font-body-sm text-body-sm shrink-0" type="button">Propulsion &amp; NDT (1)</button>
<button className="px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-primary font-body-sm text-body-sm shrink-0" type="button">Seasonal Services (1)</button>
</div>
<div className="flex items-center gap-space-sm shrink-0">
<div className="relative">
<input className="bg-surface-container-lowest text-primary text-body-sm px-space-md py-1.5 pl-9 rounded-lg focus:outline-none focus:ring-1 focus:ring-secondary text-body-sm w-48 lg:w-64 placeholder-on-surface-variant/60 shadow-sm" placeholder="Filter specifications..." type="text"/>
<span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-2.5 top-2">search</span>
</div>
<button className="p-2 rounded-lg bg-surface-container-lowest text-primary hover:bg-surface-container transition-colors shadow-sm" title="Catalog Settings" type="button">
<span className="material-symbols-outlined text-[20px]">tune</span>
</button>
</div>
</div>

<div className="flex flex-col gap-space-lg">

<div className="bg-surface-container-lowest rounded-xl shadow-md p-space-lg transition-all hover:shadow-xl flex flex-col gap-space-md">
<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-sm">
<div className="flex flex-col md:flex-row items-start md:items-center gap-space-md">
<div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[28px] text-secondary">precision_manufacturing</span>
</div>
<div>
<div className="flex items-center gap-space-xs flex-wrap">
<span className="font-label-sm uppercase tracking-wider text-secondary font-semibold">Engines &amp; Maintenance</span>
<span className="text-outline-variant">·</span>
<span className="font-label-sm text-on-surface-variant">Code: TNM-ENG-01</span>
<span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary font-label-sm px-2 py-0.5 rounded-full">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Active / Published
                </span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary mt-0.5">
                Volvo Penta &amp; Yanmar Marine Inboard Engine Overhaul
              </h2>
</div>
</div>
<div className="flex items-center gap-space-xs shrink-0">
<button className="open-inspector-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-secondary hover:bg-secondary hover:text-on-secondary font-title-md text-title-md transition-colors shadow-sm" data-service-id="1" type="button">
<span className="material-symbols-outlined text-[16px]">g_translate</span>
<span>AI Translation</span>
</button>
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">edit</span>
<span>Edit Service</span>
</button>
<button className="p-2 rounded-lg bg-surface-container-low text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors" title="Pause Service" type="button">
<span className="material-symbols-outlined text-[20px]">pause_circle</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md py-space-sm bg-surface-container-low rounded-lg px-space-md">
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Pricing Model</span>
<span className="font-spec-num text-spec-num text-primary font-bold mt-0.5">From €75.00 / hr</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">+ OEM Certified Parts</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Turnaround SLA</span>
<span className="font-spec-num text-spec-num text-primary font-semibold mt-0.5">24–48 Hours</span>
<span className="font-body-sm text-body-sm text-secondary font-medium">Emergency berths available</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Operational Area</span>
<span className="font-body-md text-body-md text-primary font-medium mt-0.5">Palma de Mallorca</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">STP, Port Adriano, Puerto Portals</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Published Locales</span>
<div className="flex items-center gap-2 mt-1">
<span className="font-label-sm px-2 py-0.5 rounded bg-surface-container-lowest text-primary font-mono font-medium">EN</span>
<span className="font-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-mono font-medium">ES</span>
<span className="font-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-mono font-medium">IT</span>
<span className="material-symbols-outlined text-[16px] text-secondary" title="Glossary Aligned">verified</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Maritime mechanical verified</span>
</div>
</div>

<div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
<div className="flex flex-wrap items-center gap-space-xs">
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary font-label-md">
<span className="material-symbols-outlined text-[16px] text-on-tertiary-container">workspace_premium</span>
              Official OEM Certified Dealer (Volvo Penta / Yanmar)
            </span>
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-secondary font-label-md">
<span className="material-symbols-outlined text-[16px] text-secondary">security</span>
              Escrow Protection Enabled (Milestone Disbursement)
            </span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Last localized via Nauta Engine: Today at 08:34 CET</span>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-md p-space-lg transition-all hover:shadow-xl flex flex-col gap-space-md">
<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-sm">
<div className="flex flex-col md:flex-row items-start md:items-center gap-space-md">
<div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[28px] text-secondary">biotech</span>
</div>
<div>
<div className="flex items-center gap-space-xs flex-wrap">
<span className="font-label-sm uppercase tracking-wider text-secondary font-semibold">Diagnostic &amp; Oil Spectrometry</span>
<span className="text-outline-variant">·</span>
<span className="font-label-sm text-on-surface-variant">Code: TNM-DIAG-04</span>
<span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary font-label-sm px-2 py-0.5 rounded-full">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Active / Published
                </span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary mt-0.5">
                Borescope Cylinder Inspection &amp; Fluid Spectrometry Analysis
              </h2>
</div>
</div>
<div className="flex items-center gap-space-xs shrink-0">
<button className="open-inspector-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-secondary hover:bg-secondary hover:text-on-secondary font-title-md text-title-md transition-colors shadow-sm" data-service-id="2" type="button">
<span className="material-symbols-outlined text-[16px]">g_translate</span>
<span>AI Translation</span>
</button>
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">edit</span>
<span>Edit Service</span>
</button>
<button className="p-2 rounded-lg bg-surface-container-low text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors" title="Pause Service" type="button">
<span className="material-symbols-outlined text-[20px]">pause_circle</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md py-space-sm bg-surface-container-low rounded-lg px-space-md">
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Pricing Model</span>
<span className="font-spec-num text-spec-num text-primary font-bold mt-0.5">Fixed €480.00 / engine</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Includes digital photo endoscopic reel</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Turnaround SLA</span>
<span className="font-spec-num text-spec-num text-primary font-semibold mt-0.5">Same-Day Diagnostic</span>
<span className="font-body-sm text-body-sm text-secondary font-medium">48h Full Fluid Lab certified</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Operational Area</span>
<span className="font-body-md text-body-md text-primary font-medium mt-0.5">Balearic Islands Basin</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Mobile Van dispatch to any marina</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Published Locales</span>
<div className="flex items-center gap-2 mt-1">
<span className="font-label-sm px-2 py-0.5 rounded bg-surface-container-lowest text-primary font-mono font-medium">EN</span>
<span className="font-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-mono font-medium">ES</span>
<span className="font-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-mono font-medium">IT</span>
<span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Spectrometry terms localized</span>
</div>
</div>

<div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
<div className="flex flex-wrap items-center gap-space-xs">
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary font-label-md">
<span className="material-symbols-outlined text-[16px] text-on-tertiary-container">verified</span>
              ISO 9001 Certified Laboratory Partner
            </span>
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-secondary font-label-md">
<span className="material-symbols-outlined text-[16px] text-secondary">picture_as_pdf</span>
              Direct PDF Report Sync to Buyer Vault
            </span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Instant booking available via Nauta API</span>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-md p-space-lg transition-all hover:shadow-xl flex flex-col gap-space-md">
<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-sm">
<div className="flex flex-col md:flex-row items-start md:items-center gap-space-md">
<div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[28px] text-secondary">radar</span>
</div>
<div>
<div className="flex items-center gap-space-xs flex-wrap">
<span className="font-label-sm uppercase tracking-wider text-secondary font-semibold">Propulsion &amp; Transmission</span>
<span className="text-outline-variant">·</span>
<span className="font-label-sm text-on-surface-variant">Code: TNM-PROP-09</span>
<span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary font-label-sm px-2 py-0.5 rounded-full">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Active / Published
                </span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary mt-0.5">
                Saildrive &amp; Shaft Seal Replacement &amp; Ultrasonic Hull Thickness NDT
              </h2>
</div>
</div>
<div className="flex items-center gap-space-xs shrink-0">
<button className="open-inspector-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-secondary hover:bg-secondary hover:text-on-secondary font-title-md text-title-md transition-colors shadow-sm" data-service-id="3" type="button">
<span className="material-symbols-outlined text-[16px]">g_translate</span>
<span>AI Translation</span>
</button>
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">edit</span>
<span>Edit Service</span>
</button>
<button className="p-2 rounded-lg bg-surface-container-low text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors" title="Pause Service" type="button">
<span className="material-symbols-outlined text-[20px]">pause_circle</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md py-space-sm bg-surface-container-low rounded-lg px-space-md">
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Pricing Model</span>
<span className="font-spec-num text-spec-num text-primary font-bold mt-0.5">Custom Quote</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Calibrated per LOA &amp; Shaft Diameter</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Turnaround SLA</span>
<span className="font-spec-num text-spec-num text-primary font-semibold mt-0.5">Drydock Window (2–4 days)</span>
<span className="font-body-sm text-body-sm text-secondary font-medium">STP Sync Slipway allocated</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Operational Area</span>
<span className="font-body-md text-body-md text-primary font-medium mt-0.5">STP Shipyard &amp; Astilleros</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Palma de Mallorca hardstand</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Published Locales</span>
<div className="flex items-center gap-2 mt-1">
<span className="font-label-sm px-2 py-0.5 rounded bg-surface-container-lowest text-primary font-mono font-medium">EN</span>
<span className="font-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-mono font-medium">ES</span>
<span className="font-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-mono font-medium">IT</span>
<span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Naval architectural glossary checked</span>
</div>
</div>

<div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
<div className="flex flex-wrap items-center gap-space-xs">
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary font-label-md">
<span className="material-symbols-outlined text-[16px] text-on-tertiary-container">assignment_turned_in</span>
              IIMS Certified Marine Surveyor Assigned
            </span>
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-secondary font-label-md">
<span className="material-symbols-outlined text-[16px] text-secondary">shield</span>
              Lloyd’s Register &amp; RINA compliant non-destructive testing
            </span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">8 quotes submitted this month</span>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-md p-space-lg transition-all hover:shadow-xl flex flex-col gap-space-md">
<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-sm">
<div className="flex flex-col md:flex-row items-start md:items-center gap-space-md">
<div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[28px] text-secondary">ac_unit</span>
</div>
<div>
<div className="flex items-center gap-space-xs flex-wrap">
<span className="font-label-sm uppercase tracking-wider text-secondary font-semibold">Winterization &amp; Commissioning</span>
<span className="text-outline-variant">·</span>
<span className="font-label-sm text-on-surface-variant">Code: TNM-WINT-12</span>
<span className="inline-flex items-center gap-1 bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-sm px-2 py-0.5 rounded-full font-medium">
<span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-fixed-variant"></span>
                  Seasonal Active (Oct – April)
                </span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary mt-0.5">
                Full Mediterranean Winterization &amp; De-Winterization Package
              </h2>
</div>
</div>
<div className="flex items-center gap-space-xs shrink-0">
<button className="open-inspector-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-secondary hover:bg-secondary hover:text-on-secondary font-title-md text-title-md transition-colors shadow-sm" data-service-id="4" type="button">
<span className="material-symbols-outlined text-[16px]">g_translate</span>
<span>AI Translation</span>
</button>
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">edit</span>
<span>Edit Service</span>
</button>
<button className="p-2 rounded-lg bg-surface-container-low text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors" title="Pause Service" type="button">
<span className="material-symbols-outlined text-[20px]">pause_circle</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md py-space-sm bg-surface-container-low rounded-lg px-space-md">
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Pricing Model</span>
<span className="font-spec-num text-spec-num text-primary font-bold mt-0.5">Tiered by LOA</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">€1,200 (&lt;15m) · €2,500 (15–24m)</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Turnaround SLA</span>
<span className="font-spec-num text-spec-num text-primary font-semibold mt-0.5">Scheduled Maintenance Slot</span>
<span className="font-body-sm text-body-sm text-secondary font-medium">Includes Spring De-wintering visit</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Operational Area</span>
<span className="font-body-md text-body-md text-primary font-medium mt-0.5">All Mallorca Marinas</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Ibiza &amp; Menorca available upon request</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Published Locales</span>
<div className="flex items-center gap-2 mt-1">
<span className="font-label-sm px-2 py-0.5 rounded bg-surface-container-lowest text-primary font-mono font-medium">EN</span>
<span className="font-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-mono font-medium">ES</span>
<span className="font-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-mono font-medium">IT</span>
<span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Seasonal SLA descriptions updated</span>
</div>
</div>

<div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
<div className="flex flex-wrap items-center gap-space-xs">
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary font-label-md">
<span className="material-symbols-outlined text-[16px] text-on-tertiary-container">inventory</span>
              Includes Glycol Antifreeze Flush &amp; A/C Descaling
            </span>
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-secondary font-label-md">
<span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
              All-Risk Marina Insurance Guarantee Validated
            </span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Scheduled for seasonal auto-archive April 30</span>
</div>
</div>
</div>

<div className="w-full bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden mt-space-lg" id="inspector-container">
<div className="bg-primary text-on-primary p-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md">
<div className="flex items-center gap-space-md">
<div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-on-secondary">
<span className="material-symbols-outlined text-[24px]">spellcheck</span>
</div>
<div>
<div className="flex items-center gap-space-xs">
<span className="font-label-sm uppercase tracking-widest text-secondary-fixed">Nauta Multilingual Validation Studio</span>
<span className="text-outline-variant">·</span>
<span className="font-mono text-[11px] text-secondary-fixed">Engine v2.4</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-primary">
              Service AI Translation Inspector: Volvo Penta &amp; Yanmar Inboard Overhaul
            </h3>
</div>
</div>
<div className="flex items-center gap-space-sm shrink-0">
<span className="inline-flex items-center gap-1 bg-surface-container-low/20 text-on-primary font-label-md px-3 py-1 rounded-full">
<span className="material-symbols-outlined text-[16px] text-secondary-fixed">check_circle</span>
            Lexical Accuracy: 99.8%
          </span>
<button className="p-1.5 rounded-lg text-on-primary hover:bg-primary-container transition-colors" id="close-inspector-btn" type="button">
<span className="material-symbols-outlined text-[20px]">keyboard_arrow_up</span>
</button>
</div>
</div>

<div className="p-space-lg grid grid-cols-1 lg:grid-cols-3 gap-space-lg bg-surface">

<div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-sm">
<div className="flex items-center justify-between pb-space-xs">
<div className="flex items-center gap-2">
<span className="font-mono font-bold text-body-md px-2 py-0.5 rounded bg-primary text-on-primary">EN</span>
<span className="font-title-md text-title-md text-primary">Master Source</span>
</div>
<span className="font-label-sm text-on-surface-variant">742 chars · 112 words</span>
</div>
<div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-1 text-body-sm text-on-surface">
<span className="font-semibold text-primary">Title:</span>
<p>Volvo Penta &amp; Yanmar Marine Inboard Engine Overhaul</p>
<span className="font-semibold text-primary mt-2">Technical Scope:</span>
<p className="text-on-surface-variant leading-relaxed">
                Complete mechanical overhaul and tolerance calibration for Volvo Penta D-series and Yanmar JH/4LH marine propulsion units. Scope includes compression tests, cylinder head de-coking, injector ultrasonic cleaning, sea-water pump impeller renew, and heat exchanger acid flush. Performed by certified master naval mechanics at STP Palma with OEM warranty registration.
              </p>
<span className="font-semibold text-primary mt-2">Certified Terms:</span>
<div className="flex flex-wrap gap-1 mt-1">
<span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-primary">tolerance calibration</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-primary">heat exchanger flush</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-primary">impeller renew</span>
</div>
</div>
</div>
<div className="flex items-center justify-between pt-space-xs text-body-sm">
<span className="text-secondary flex items-center gap-1 font-medium font-label-md">
<span className="material-symbols-outlined text-[16px]">lock</span> Authoritative Copy
            </span>
<button className="text-primary hover:text-secondary font-medium transition-colors text-body-sm" type="button">Edit Master</button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-sm">
<div className="flex items-center justify-between pb-space-xs">
<div className="flex items-center gap-2">
<span className="font-mono font-bold text-body-md px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container">IT</span>
<span className="font-title-md text-title-md text-primary">Italian Localization</span>
</div>
<span className="font-label-sm text-secondary flex items-center gap-1 font-semibold">
<span className="material-symbols-outlined text-[14px]">verified</span> Codice Navigazione
              </span>
</div>
<div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-1 text-body-sm text-on-surface">
<span className="font-semibold text-primary">Titolo Localizzato:</span>
<p>Revisione Completa Motori Entrobordo Volvo Penta e Yanmar</p>
<span className="font-semibold text-primary mt-2">Ambito Tecnico:</span>
<p className="text-on-surface-variant leading-relaxed">
                Revisione meccanica integrale e taratura delle tolleranze per propulsori marini entrobordo serie Volvo Penta D e Yanmar JH/4LH. L&apos;intervento comprende prova di compressione, disincrostazione testata, lavaggio a ultrasuoni iniettori, sostituzione girante pompa acqua mare e decapaggio fascio tubiero scambiatore di calore. Eseguito da meccanici navali certificati presso STP Palma con garanzia ufficiale OEM.
              </p>
<span className="font-semibold text-primary mt-2">Termini RINA Verificati:</span>
<div className="flex flex-wrap gap-1 mt-1">
<span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-secondary">taratura tolleranze</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-secondary">scambiatore di calore</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-secondary">girante acqua mare</span>
</div>
</div>
</div>
<div className="flex items-center justify-between pt-space-xs text-body-sm">
<span className="text-on-surface-variant font-label-md">Synced · 100% Match</span>
<button className="text-secondary hover:text-primary font-medium transition-colors text-body-sm flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">edit_note</span>
<span>Manual Override</span>
</button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-sm">
<div className="flex items-center justify-between pb-space-xs">
<div className="flex items-center gap-2">
<span className="font-mono font-bold text-body-md px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container">ES</span>
<span className="font-title-md text-title-md text-primary">Spanish Localization</span>
</div>
<span className="font-label-sm text-secondary flex items-center gap-1 font-semibold">
<span className="material-symbols-outlined text-[14px]">verified</span> Marina Mercante
              </span>
</div>
<div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-1 text-body-sm text-on-surface">
<span className="font-semibold text-primary">Título Localizado:</span>
<p>Revisión General y Overhaul de Motores Intraborda Volvo Penta y Yanmar</p>
<span className="font-semibold text-primary mt-2">Alcance Técnico:</span>
<p className="text-on-surface-variant leading-relaxed">
                Revisión mecánica integral y calibración de tolerancias para motores marinos intraborda Volvo Penta serie D y Yanmar JH/4LH. Incluye prueba de compresión, descarbonización de culata, limpieza por ultrasonidos de inyectores, sustitución de rodete/impeller de bomba salada y desincrustación química de intercambiador de calor. Realizado por mecánicos navales homologados en STP Palma con registro OEM.
              </p>
<span className="font-semibold text-primary mt-2">Términos Técnicos Validados:</span>
<div className="flex flex-wrap gap-1 mt-1">
<span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-secondary">calibración tolerancias</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-secondary">intercambiador térmico</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-secondary">rodete / impeller</span>
</div>
</div>
</div>
<div className="flex items-center justify-between pt-space-xs text-body-sm">
<span className="text-on-surface-variant font-label-md">Synced · 100% Match</span>
<button className="text-secondary hover:text-primary font-medium transition-colors text-body-sm flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">edit_note</span>
<span>Manual Override</span>
</button>
</div>
</div>
</div>

<div className="bg-surface-container-low p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm">
<div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
<span className="material-symbols-outlined text-[18px] text-secondary">shield</span>
<span>Nauta AI translation tailored for maritime legal accuracy. Verified by Talleres Navales S.L. Quality Control.</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-3.5 py-1.5 rounded-lg bg-surface-container text-primary hover:bg-surface-container-high text-body-sm font-medium transition-colors" type="button">
            Re-run Glossary Verification
          </button>
<button className="px-4 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-body-sm font-medium transition-colors shadow-sm" type="button">
            Approve &amp; Lock Localizations
          </button>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-md p-space-lg flex flex-col lg:flex-row items-start justify-between gap-space-lg">
<div className="flex flex-col gap-space-xs max-w-xl">
<span className="font-label-sm text-secondary uppercase tracking-wider font-semibold">Shipyard Infrastructure &amp; Capabilities</span>
<h3 className="font-headline-sm text-headline-sm text-primary">Talleres Navales del Mediterráneo Facilities</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          Operational footprint includes 650 m² enclosed mechanical machine shop inside STP Shipyard Palma, travelift access up to 700 tonnes, clean-room fuel injection bench, and 3 mobile rapid-intervention vans equipped for Palma Bay, Port Adriano, and Andratx.
        </p>
</div>
<div className="grid grid-cols-2 sm:grid-cols-3 gap-space-md w-full lg:w-auto shrink-0">
<div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
<span className="font-label-sm text-on-surface-variant">Travelift Capacity</span>
<span className="font-title-md text-title-md text-primary font-bold">700 Tonnes</span>
<span className="text-[11px] text-secondary font-medium">STP Hardstand</span>
</div>
<div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
<span className="font-label-sm text-on-surface-variant">Mobile Vans</span>
<span className="font-title-md text-title-md text-primary font-bold">3 Units</span>
<span className="text-[11px] text-secondary font-medium">Rapid Response</span>
</div>
<div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col col-span-2 sm:col-span-1">
<span className="font-label-sm text-on-surface-variant">OEM Accreditation</span>
<span className="font-title-md text-title-md text-primary font-bold">Class A</span>
<span className="text-[11px] text-secondary font-medium">Volvo / Yanmar</span>
</div>
</div>
</div>
</div>


</div>
      </RequirePermission>
    </main>
  );
}
