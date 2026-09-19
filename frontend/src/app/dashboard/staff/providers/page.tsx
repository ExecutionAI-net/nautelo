import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function StaffProviders() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission permission="approve_listings_and_revisions">
<div className="flex flex-col w-full">

<div className="w-full bg-primary-container text-on-primary py-2 px-margin-mobile md:px-margin lg:px-margin-desktop text-label-sm font-label-sm">
<div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
<div className="flex items-center gap-2">
<span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-secondary-fixed"></span>
<span className="tracking-widest uppercase font-semibold text-secondary-fixed">STAFF CONSOLE</span>
<span className="text-on-primary-container">•</span>
<span className="text-on-primary font-medium">Platform Administration — Screen 44 of 51</span>
<span className="text-on-primary-container hidden sm:inline">•</span>
<span className="hidden sm:inline px-2 py-0.5 rounded bg-primary text-on-primary text-[10px] tracking-wide uppercase">Desk: Maritime Compliance &amp; Identity</span>
</div>
<div className="flex items-center gap-4 text-on-primary-container">
<button className="hover:text-on-primary transition-colors flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[14px]">swap_horiz</span> Switch Demo Role
        </button>
<span>/</span>
<button className="hover:text-error-container transition-colors flex items-center gap-1 text-on-primary" type="button">
<span className="material-symbols-outlined text-[14px]">logout</span> Log Out
        </button>
</div>
</div>
</div>

<div className="w-full bg-surface-container-low shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop overflow-x-auto no-scrollbar">
<nav className="flex items-center gap-1 py-1 whitespace-nowrap min-w-max">
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Overview</Link>
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Users (41)</Link>
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Boats (42)</Link>
<Link href="/brokers/" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Brokers (43)</Link>
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md bg-primary text-on-primary font-semibold shadow-sm flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[15px]">engineering</span>
          Service Providers (44)
        </Link>
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Service Requests (45)</Link>
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Leads (46)</Link>
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Subscriptions (47)</Link>
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Ads &amp; Banners (48)</Link>
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Guides &amp; Blog (49)</Link>
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Analytics (50)</Link>
<Link href="#" className="px-3 py-2 rounded font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" >Settings (51)</Link>
</nav>
</div>
</div>

<div className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-lg space-y-space-xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
<div className="space-y-2 max-w-3xl">
<div className="flex items-center gap-2">
<span className="px-2.5 py-1 rounded bg-secondary/10 text-secondary font-label-sm text-label-sm uppercase tracking-wider font-semibold">
            Compliance Module 04-B
          </span>
<span className="text-outline-variant font-label-sm">•</span>
<span className="font-label-sm text-label-sm text-on-surface-variant tracking-wide">
            AUDIT JURISDICTIONS: ES-BALEARES, ES-CAT, IT-LIGURIA, FR-PACA
          </span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          Marine Service Provider &amp; Surveyor Governance
        </h1>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          Inspect shipyard certifications, verify surveyor professional indemnity insurance (IIMS, RINA, Lloyd&apos;s Register), and manage marketplace service vendor accreditations across Western Mediterranean marinas.
        </p>
</div>

<div className="flex flex-wrap items-center gap-space-sm shrink-0">
<button className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-surface-container-low text-primary hover:bg-surface-container font-label-md text-label-md shadow-sm transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">sim_card_download</span>
          Export Surveyor Registry
        </button>
<button className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md shadow-sm transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">verified_user</span>
          + Register Certified Shipyard
        </button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between text-on-surface-variant mb-3">
<span className="font-label-sm text-label-sm uppercase tracking-wider">Accredited Marine Yards</span>
<span className="material-symbols-outlined text-secondary text-[20px]">warehouse</span>
</div>
<div className="flex items-baseline justify-between">
<span className="font-display-hero-mobile text-display-hero-mobile text-primary font-bold">94</span>
<span className="font-label-sm text-label-sm text-secondary flex items-center gap-0.5">
<span className="material-symbols-outlined text-[14px]">arrow_upward</span> +4 this mo
          </span>
</div>
<p className="text-body-sm font-body-sm text-on-surface-variant mt-2">STP Palma, MB92 Barcelona, Genoa Ship Lift</p>
</div>

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between text-on-surface-variant mb-3">
<span className="font-label-sm text-label-sm uppercase tracking-wider">Certified Surveyors</span>
<span className="material-symbols-outlined text-secondary text-[20px]">frame_inspect</span>
</div>
<div className="flex items-baseline justify-between">
<span className="font-display-hero-mobile text-display-hero-mobile text-primary font-bold">28</span>
<span className="font-label-sm text-label-sm text-on-tertiary-container bg-tertiary-fixed/30 px-1.5 py-0.5 rounded">
            3 Audits Pending
          </span>
</div>
<p className="text-body-sm font-body-sm text-on-surface-variant mt-2">IIMS, YDSA, RINA NDT Level II &amp; III</p>
</div>

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between text-on-surface-variant mb-3">
<span className="font-label-sm text-label-sm uppercase tracking-wider">Active Engagements</span>
<span className="material-symbols-outlined text-secondary text-[20px]">handshake</span>
</div>
<div className="flex items-baseline justify-between">
<span className="font-display-hero-mobile text-display-hero-mobile text-primary font-bold">52</span>
<span className="font-label-sm text-label-sm text-secondary font-medium">96.8% SLAs Met</span>
</div>
<p className="text-body-sm font-body-sm text-on-surface-variant mt-2">18 Pre-purchase, 14 Refits, 20 Logistics</p>
</div>

<div className="bg-primary text-on-primary p-space-md rounded shadow-md flex flex-col justify-between relative overflow-hidden">
<div className="absolute -right-4 -bottom-4 w-24 h-24 bg-secondary/15 rounded-full blur-xl pointer-events-none"></div>
<div className="flex items-center justify-between text-on-primary-container mb-3">
<span className="font-label-sm text-label-sm uppercase tracking-wider">Monthly Escrow Volume</span>
<span className="material-symbols-outlined text-secondary-fixed text-[20px]">lock</span>
</div>
<div className="flex items-baseline justify-between">
<span className="font-display-hero-mobile text-display-hero-mobile font-bold tracking-tight text-on-primary">€320,400</span>
<span className="font-label-sm text-label-sm text-secondary-fixed">Secure Bank Vault</span>
</div>
<p className="text-body-sm font-body-sm text-on-primary-container mt-2">Zero chargeback requests recorded (Q2 2025)</p>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm space-y-4">
<div className="flex flex-col lg:flex-row gap-3">

<div className="relative flex-1">
<span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
<input className="w-full pl-10 pr-4 py-2.5 rounded bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:bg-surface-container-lowest focus:outline-none transition-all" placeholder="Search by company name, CIF, lead surveyor, specialty, or shipyard location..." type="text"/>
</div>

<div className="flex flex-wrap items-center gap-2 shrink-0">
<div className="relative">
<select className="appearance-none bg-surface-container-low text-on-surface text-label-md font-label-md py-2.5 pl-3 pr-8 rounded focus:outline-none cursor-pointer">
<option>Specialty: All Disciplines</option>
<option>Engine &amp; Mechanical</option>
<option>Ultrasonic &amp; NDT Surveyors</option>
<option>Legal &amp; Registration</option>
<option>Marine Insurance</option>
<option>Transport &amp; Logistics</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
</div>
<div className="relative">
<select className="appearance-none bg-surface-container-low text-on-surface text-label-md font-label-md py-2.5 pl-3 pr-8 rounded focus:outline-none cursor-pointer">
<option>Certification: All Standard</option>
<option>IIMS Certified</option>
<option>RINA Class Surveyor</option>
<option>Volvo Penta / Yanmar OEM</option>
<option>Lloyd&apos;s Approved Agent</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
</div>
<div className="relative">
<select className="appearance-none bg-surface-container-low text-on-surface text-label-md font-label-md py-2.5 pl-3 pr-8 rounded focus:outline-none cursor-pointer">
<option>Region: Western Med (All)</option>
<option>Mallorca (Baleares)</option>
<option>Barcelona &amp; Tarragona</option>
<option>Valencia &amp; Alicante</option>
<option>Genoa &amp; Ligurian Coast</option>
<option>Naples &amp; Amalfi</option>
<option>French Riviera (Côte d&apos;Azur)</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
</div>
<div className="relative">
<select className="appearance-none bg-surface-container-low text-on-surface text-label-md font-label-md py-2.5 pl-3 pr-8 rounded focus:outline-none cursor-pointer">
<option>Status: All Statuses</option>
<option>Active / Verified Only</option>
<option>Verification Pending</option>
<option>Expired Insurance Alerts</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
</div>
<button className="p-2.5 bg-surface-container-low text-on-surface-variant hover:text-primary rounded" title="Reset Filters" type="button">
<span className="material-symbols-outlined text-[18px]">restart_alt</span>
</button>
</div>
</div>

<div className="flex items-center justify-between pt-2">
<div className="flex items-center gap-3 overflow-x-auto text-label-sm font-label-sm py-1">
<span className="text-on-surface-variant uppercase tracking-wider">Fast Presets:</span>
<button className="px-2.5 py-1 rounded bg-surface-container text-primary font-semibold flex items-center gap-1.5" type="button">
<span>All Entities</span> <span className="text-[10px] bg-surface-container-highest px-1.5 py-0.2 rounded-full">122</span>
</button>
<button className="px-2.5 py-1 rounded hover:bg-surface-container text-on-surface-variant transition-colors flex items-center gap-1.5" type="button">
<span className="w-2 h-2 rounded-full bg-secondary"></span> Verified Yards <span className="text-[10px] bg-surface-container-highest px-1.5 py-0.2 rounded-full">64</span>
</button>
<button className="px-2.5 py-1 rounded hover:bg-surface-container text-on-surface-variant transition-colors flex items-center gap-1.5" type="button">
<span className="w-2 h-2 rounded-full bg-secondary-container"></span> Hull Surveyors <span className="text-[10px] bg-surface-container-highest px-1.5 py-0.2 rounded-full">28</span>
</button>
<button className="px-2.5 py-1 rounded hover:bg-surface-container text-on-surface-variant transition-colors flex items-center gap-1.5" type="button">
<span className="w-2 h-2 rounded-full bg-error"></span> Policy Renewal Due <span className="text-[10px] bg-error-container text-on-error-container px-1.5 py-0.2 rounded-full font-bold">2</span>
</button>
</div>
<div className="text-body-sm font-body-sm text-on-surface-variant hidden md:block">
          Showing <strong>5</strong> of 122 registered maritime partners
        </div>
</div>
</div>

<div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden">
<div className="overflow-x-auto">
<table className="w-full text-left font-body-md text-body-md border-collapse">
<thead>
<tr className="bg-surface-container text-primary font-label-md text-label-md tracking-wider uppercase">
<th className="py-3.5 px-4 font-semibold">Provider / Entity</th>
<th className="py-3.5 px-4 font-semibold">Core Specialty &amp; Accreditations</th>
<th className="py-3.5 px-4 font-semibold">Base Yard / Facilities</th>
<th className="py-3.5 px-4 font-semibold">Lead Technical Staff</th>
<th className="py-3.5 px-4 font-semibold">Active Escrow Pipeline</th>
<th className="py-3.5 px-4 font-semibold">Insurance &amp; Liability</th>
<th className="py-3.5 px-4 font-semibold text-right">Verification &amp; Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container-low">

<tr className="hover:bg-surface-container-low/60 transition-colors">
<td className="py-4 px-4 align-top">
<div className="flex items-start gap-3">
<div className="w-10 h-10 rounded bg-primary text-on-primary flex items-center justify-center shrink-0 font-headline-sm text-headline-sm">
                    T
                  </div>
<div>
<div className="font-title-md text-title-md text-primary font-semibold flex items-center gap-1.5">
                      Talleres Navales del Mediterráneo S.L.
                      <span className="material-symbols-outlined text-secondary text-[17px]" title="Audited Official Shipyard">verified</span>
</div>
<div className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-2 mt-0.5">
<span>CIF: B-07928114</span>
<span>•</span>
<span>ES-PM / Yard ID: TNM-992</span>
</div>
<div className="mt-1 flex items-center gap-1 text-[11px] text-secondary font-label-sm font-semibold">
<span className="material-symbols-outlined text-[13px]">check_circle</span> PLATFORM TIER 1 PARTNER
                    </div>
</div>
</div>
</td>
<td className="py-4 px-4 align-top">
<div className="space-y-1">
<div className="font-medium text-primary">Engine &amp; Transmission Overhaul</div>
<div className="flex flex-wrap gap-1">
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">Volvo Penta OEM</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">Yanmar Marine</span>
<span className="px-2 py-0.5 rounded bg-surface-container-high text-primary font-label-sm text-label-sm">RINA NDT</span>
</div>
</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-medium text-primary">STP Shipyard Palma</div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Muelle Viejo, Palma de Mallorca</div>
<div className="text-label-sm font-label-sm text-secondary mt-1">Travelift 700T • Keel Pit Berth</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-medium text-primary">Ing. Mateo Rosselló</div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Lead Chief Diesel Eng.</div>
<div className="text-[11px] text-outline font-label-sm">COITN Reg #1142</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-spec-num text-spec-num text-primary font-semibold">€84,500.00</div>
<div className="text-body-sm font-body-sm text-secondary font-medium">6 Inquiries Active</div>
<div className="text-[11px] text-on-surface-variant">Avg. close rate: 92%</div>
</td>
<td className="py-4 px-4 align-top">
<div className="flex items-center gap-1.5 text-secondary font-semibold text-label-md font-label-md">
<span className="material-symbols-outlined text-[16px]">verified_user</span> Hiscox €5,000,000
                </div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Marine Civil Liability</div>
<div className="text-[11px] text-outline font-label-sm">Valid until Nov 2026</div>
</td>
<td className="py-4 px-4 align-top text-right space-y-2">
<span className="inline-flex items-center px-2.5 py-1 rounded bg-secondary/10 text-secondary font-label-sm text-label-sm font-semibold">
                  Verified Shipyard
                </span>
<div className="flex items-center justify-end gap-1.5 pt-1">
<button className="px-2.5 py-1 rounded bg-surface-container text-primary hover:bg-surface-container-high font-label-sm text-label-sm transition-colors" type="button">
                    Manage Profile
                  </button>
<button className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors" title="Audit Services" type="button">
<span className="material-symbols-outlined text-[18px]">policy</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/60 transition-colors bg-surface-container-lowest">
<td className="py-4 px-4 align-top">
<div className="flex items-start gap-3">
<div className="w-10 h-10 rounded bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 font-headline-sm text-headline-sm">
                    B
                  </div>
<div>
<div className="font-title-md text-title-md text-primary font-semibold flex items-center gap-1.5">
                      Balearic Maritime Surveyors Guild
                      <span className="material-symbols-outlined text-secondary text-[17px]" title="Chartered Marine Surveyor">workspace_premium</span>
</div>
<div className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-2 mt-0.5">
<span>Assoc #ESP-882</span>
<span>•</span>
<span>IIMS Corp Member</span>
</div>
<div className="mt-1 flex items-center gap-1 text-[11px] text-tertiary font-label-sm font-semibold">
<span className="material-symbols-outlined text-[13px]">anchor</span> MED PRE-PURCHASE SPECIALISTS
                    </div>
</div>
</div>
</td>
<td className="py-4 px-4 align-top">
<div className="space-y-1">
<div className="font-medium text-primary">Pre-Purchase &amp; Hull Ultrasonic NDT</div>
<div className="flex flex-wrap gap-1">
<span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">IIMS Certified</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">Thermal Osmosis Scan</span>
</div>
</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-medium text-primary">Moll Vell &amp; Club de Mar</div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Palma / Mobile across Ibiza &amp; Menorca</div>
<div className="text-label-sm font-label-sm text-on-surface-variant mt-1">Independent Testing Van Unit</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-medium text-primary">Capt. Mateu Rosselló</div>
<div className="text-body-sm font-body-sm text-on-surface-variant">CEng MRINA, Hon. FIIMS</div>
<div className="text-[11px] text-outline font-label-sm">IIMS License #MS-44910</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-spec-num text-spec-num text-primary font-semibold">€32,800.00</div>
<div className="text-body-sm font-body-sm text-secondary font-medium">4 Surveys in Escrow</div>
<div className="text-[11px] text-on-surface-variant">Next delivery: Today 18:00</div>
</td>
<td className="py-4 px-4 align-top">
<div className="flex items-center gap-1.5 text-secondary font-semibold text-label-md font-label-md">
<span className="material-symbols-outlined text-[16px]">verified_user</span> Lloyd&apos;s Syndicate €10M
                </div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Professional Errors &amp; Omissions</div>
<div className="text-[11px] text-outline font-label-sm">Valid until Mar 2027</div>
</td>
<td className="py-4 px-4 align-top text-right space-y-2">
<span className="inline-flex items-center px-2.5 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">
                  Certified Surveyor
                </span>
<div className="flex items-center justify-end gap-1.5 pt-1">
<button className="px-2.5 py-1 rounded bg-surface-container text-primary hover:bg-surface-container-high font-label-sm text-label-sm transition-colors" type="button">
                    View Credentials
                  </button>
<button className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors" title="Audit Certs" type="button">
<span className="material-symbols-outlined text-[18px]">verified</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/60 transition-colors">
<td className="py-4 px-4 align-top">
<div className="flex items-start gap-3">
<div className="w-10 h-10 rounded bg-surface-container-high text-primary flex items-center justify-center shrink-0 font-headline-sm text-headline-sm">
                    N
                  </div>
<div>
<div className="font-title-md text-title-md text-primary font-semibold flex items-center gap-1.5">
                      Bufete Balear Náutico Abogados
                      <span className="material-symbols-outlined text-secondary text-[17px]">gavel</span>
</div>
<div className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-2 mt-0.5">
<span>NIF: A-57129033</span>
<span>•</span>
<span>Bar Assc. ICAIB</span>
</div>
<div className="mt-1 flex items-center gap-1 text-[11px] text-on-surface-variant font-label-sm">
<span className="material-symbols-outlined text-[13px]">account_balance</span> CROSS-BORDER TITLE &amp; VAT ESCROW
                    </div>
</div>
</div>
</td>
<td className="py-4 px-4 align-top">
<div className="space-y-1">
<div className="font-medium text-primary">Maritime Legal, Flag Transfers &amp; Escrow</div>
<div className="flex flex-wrap gap-1">
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">Spanish Registry (Lista 6ª/7ª)</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">Polish &amp; Dutch Kadaster</span>
</div>
</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-medium text-primary">Carrer de la Constitució 12</div>
<div className="text-body-sm font-body-sm text-on-surface-variant">07001 Palma de Mallorca</div>
<div className="text-label-sm font-label-sm text-outline mt-1">Notarial Desk Access</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-medium text-primary">Dra. Clara Vidal Ferrer</div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Senior Maritime Jurist</div>
<div className="text-[11px] text-outline font-label-sm">ICAIB Col. #4291</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-spec-num text-spec-num text-primary font-semibold">€14,200.00</div>
<div className="text-body-sm font-body-sm text-secondary font-medium">3 Flag Legalizations</div>
<div className="text-[11px] text-on-surface-variant">2 Closing this week</div>
</td>
<td className="py-4 px-4 align-top">
<div className="flex items-center gap-1.5 text-secondary font-semibold text-label-md font-label-md">
<span className="material-symbols-outlined text-[16px]">verified_user</span> Mutua Abogacía €3M
                </div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Professional Indemnity Active</div>
<div className="text-[11px] text-outline font-label-sm">Valid until Dec 2025</div>
</td>
<td className="py-4 px-4 align-top text-right space-y-2">
<span className="inline-flex items-center px-2.5 py-1 rounded bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold">
                  Verified Legal Desk
                </span>
<div className="flex items-center justify-end gap-1.5 pt-1">
<button className="px-2.5 py-1 rounded bg-surface-container text-primary hover:bg-surface-container-high font-label-sm text-label-sm transition-colors" type="button">
                    View Profile
                  </button>
<button className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors" title="View Legal Trust Mandate" type="button">
<span className="material-symbols-outlined text-[18px]">contract</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/60 transition-colors bg-surface-container-lowest">
<td className="py-4 px-4 align-top">
<div className="flex items-start gap-3">
<div className="w-10 h-10 rounded bg-primary-container text-on-primary flex items-center justify-center shrink-0 font-headline-sm text-headline-sm">
                    T
                  </div>
<div>
<div className="font-title-md text-title-md text-primary font-semibold flex items-center gap-1.5">
                      Trans-Med Heavy Yacht Carrier Ltd
                      <span className="material-symbols-outlined text-secondary text-[17px]">local_shipping</span>
</div>
<div className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-2 mt-0.5">
<span>VAT: GB-99410294</span>
<span>•</span>
<span>BIMCO Carrier #312</span>
</div>
<div className="mt-1 flex items-center gap-1 text-[11px] text-secondary font-label-sm font-semibold">
<span className="material-symbols-outlined text-[13px]">directions_boat</span> PETERS &amp; MAY ALLIANCE PARTNER
                    </div>
</div>
</div>
</td>
<td className="py-4 px-4 align-top">
<div className="space-y-1">
<div className="font-medium text-primary">Overland &amp; Semi-Submersible Transport</div>
<div className="flex flex-wrap gap-1">
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">Hydraulic Cradle Transporters</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">Cabo de Gata &amp; Biscay Routes</span>
</div>
</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-medium text-primary">Port Tarragona &amp; Genoa</div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Hubs in Palma, Marseille &amp; Civitavecchia</div>
<div className="text-label-sm font-label-sm text-secondary mt-1">Deepwater Ro-Ro Ramps</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-medium text-primary">Master Mar. Luc Garnier</div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Logistics Operations Director</div>
<div className="text-[11px] text-outline font-label-sm">STCW Unlimited Master</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-spec-num text-spec-num text-primary font-semibold">€118,900.00</div>
<div className="text-body-sm font-body-sm text-secondary font-medium">2 Sailings in Escrow</div>
<div className="text-[11px] text-on-surface-variant">Ibiza → Southampton</div>
</td>
<td className="py-4 px-4 align-top">
<div className="flex items-center gap-1.5 text-secondary font-semibold text-label-md font-label-md">
<span className="material-symbols-outlined text-[16px]">verified_user</span> Lloyd&apos;s Cargo Cover €50M
                </div>
<div className="text-body-sm font-body-sm text-on-surface-variant">All-Risks Transit Cover</div>
<div className="text-[11px] text-outline font-label-sm">Valid until Jun 2026</div>
</td>
<td className="py-4 px-4 align-top text-right space-y-2">
<span className="inline-flex items-center px-2.5 py-1 rounded bg-secondary/10 text-secondary font-label-sm text-label-sm font-semibold">
                  Accredited Carrier
                </span>
<div className="flex items-center justify-end gap-1.5 pt-1">
<button className="px-2.5 py-1 rounded bg-surface-container text-primary hover:bg-surface-container-high font-label-sm text-label-sm transition-colors" type="button">
                    View Fleet
                  </button>
<button className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors" title="Check Route Manifests" type="button">
<span className="material-symbols-outlined text-[18px]">map</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/60 transition-colors bg-error-container/10">
<td className="py-4 px-4 align-top">
<div className="flex items-start gap-3">
<div className="w-10 h-10 rounded bg-error-container text-on-error-container flex items-center justify-center shrink-0 font-headline-sm text-headline-sm">
                    L
                  </div>
<div>
<div className="font-title-md text-title-md text-primary font-semibold flex items-center gap-1.5">
                      Liguria Marine Electronics &amp; Comms
                      <span className="material-symbols-outlined text-error text-[17px]" title="Action required: Policy expiring">warning</span>
</div>
<div className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-2 mt-0.5">
<span>P.IVA: IT-038291040</span>
<span>•</span>
<span>Camera di Commercio Genova</span>
</div>
<div className="mt-1 flex items-center gap-1 text-[11px] text-error font-label-sm font-semibold">
<span className="material-symbols-outlined text-[13px]">timer</span> INSURANCE POLICY EXPIRING IN 5 DAYS
                    </div>
</div>
</div>
</td>
<td className="py-4 px-4 align-top">
<div className="space-y-1">
<div className="font-medium text-primary">NMEA 2000, Satcom, Radar Diagnostics</div>
<div className="flex flex-wrap gap-1">
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">Raymarine Certified</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-label-sm">Furuno &amp; Simrad Gold</span>
</div>
</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-medium text-primary">Marina di Genova Aeroporto</div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Calata Marina 16, Genoa</div>
<div className="text-label-sm font-label-sm text-outline mt-1">Superyacht Berth Technicians</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-medium text-primary">David Bennasar</div>
<div className="text-body-sm font-body-sm text-on-surface-variant">Lead Electronics Specialist</div>
<div className="text-[11px] text-outline font-label-sm">GMDSS General Operator</div>
</td>
<td className="py-4 px-4 align-top">
<div className="font-spec-num text-spec-num text-primary font-semibold">€7,000.00</div>
<div className="text-body-sm font-body-sm text-on-surface-variant font-medium">1 Pending Quotation</div>
<div className="text-[11px] text-error font-semibold">Escrow hold on new quotes</div>
</td>
<td className="py-4 px-4 align-top">
<div className="flex items-center gap-1.5 text-error font-semibold text-label-md font-label-md">
<span className="material-symbols-outlined text-[16px]">priority_high</span> Generali Italia €1,000,000
                </div>
<div className="text-body-sm font-body-sm text-error font-medium">Expires: June 28, 2025</div>
<div className="text-[11px] text-error font-label-sm font-semibold">Renewal request sent via email</div>
</td>
<td className="py-4 px-4 align-top text-right space-y-2">
<span className="inline-flex items-center px-2.5 py-1 rounded bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                  Renewal Alert
                </span>
<div className="flex items-center justify-end gap-1.5 pt-1">
<button className="px-2.5 py-1 rounded bg-error text-on-error hover:opacity-90 font-label-sm text-label-sm transition-opacity" type="button">
                    Review Insurance
                  </button>
<button className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors" title="Message Vendor" type="button">
<span className="material-symbols-outlined text-[18px]">mail</span>
</button>
</div>
</td>
</tr>
</tbody>
</table>
</div>

<div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-4">
<div className="flex items-center gap-2 text-body-sm font-body-sm text-on-surface-variant">
<span>Rows per page:</span>
<select className="bg-surface-container text-on-surface text-label-sm font-label-sm rounded px-2 py-1 focus:outline-none">
<option>10</option>
<option >25</option>
<option>50</option>
</select>
<span className="ml-2">1–5 of 122 registered maritime partners</span>
</div>
<div className="flex items-center gap-1">
<button className="p-2 rounded hover:bg-surface-container text-outline disabled:opacity-40" disabled type="button">
<span className="material-symbols-outlined text-[18px]">first_page</span>
</button>
<button className="p-2 rounded hover:bg-surface-container text-outline disabled:opacity-40" disabled type="button">
<span className="material-symbols-outlined text-[18px]">chevron_left</span>
</button>
<button className="px-3 py-1 rounded bg-primary text-on-primary font-label-sm text-label-sm font-semibold" type="button">
            1
          </button>
<button className="px-3 py-1 rounded hover:bg-surface-container text-on-surface font-label-sm text-label-sm" type="button">
            2
          </button>
<button className="px-3 py-1 rounded hover:bg-surface-container text-on-surface font-label-sm text-label-sm" type="button">
            3
          </button>
<button className="px-3 py-1 rounded hover:bg-surface-container text-on-surface font-label-sm text-label-sm" type="button">
            4
          </button>
<button className="px-3 py-1 rounded hover:bg-surface-container text-on-surface font-label-sm text-label-sm" type="button">
            5
          </button>
<button className="p-2 rounded hover:bg-surface-container text-on-surface-variant" type="button">
<span className="material-symbols-outlined text-[18px]">chevron_right</span>
</button>
<button className="p-2 rounded hover:bg-surface-container text-on-surface-variant" type="button">
<span className="material-symbols-outlined text-[18px]">last_page</span>
</button>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded shadow-md overflow-hidden">

<div className="bg-primary text-on-primary p-space-md flex flex-col md:flex-row md:items-center justify-between gap-3">
<div className="flex items-center gap-3">
<div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-on-secondary">
<span className="material-symbols-outlined text-[20px]">fact_check</span>
</div>
<div>
<span className="font-label-sm text-label-sm text-secondary-fixed uppercase tracking-widest font-semibold block">
              Active Audit Case #VER-8490
            </span>
<h2 className="font-title-lg text-title-lg text-on-primary font-semibold">
              Surveyor License &amp; Yard Safety Verification Protocol
            </h2>
</div>
</div>
<div className="flex items-center gap-2">
<span className="px-2.5 py-1 rounded bg-secondary/30 text-secondary-fixed font-label-sm text-label-sm uppercase tracking-wider font-semibold">
            Status: Under Human Review
          </span>
<span className="text-on-primary-container text-label-sm font-label-sm">Assigned Auditor: M. De Luca (Compliance Lead)</span>
</div>
</div>

<div className="p-space-md lg:p-space-lg grid grid-cols-1 lg:grid-cols-3 gap-space-lg">

<div className="space-y-4">
<div className="flex items-center justify-between">
<h3 className="font-title-md text-title-md text-primary font-semibold">Audited Entity</h3>
<span className="text-label-sm font-label-sm text-secondary font-medium">ID: MS-BAL-094</span>
</div>
<div className="p-3 bg-surface-container-low rounded space-y-2 text-body-sm font-body-sm">
<div className="font-semibold text-primary text-body-md">Balearic Maritime Surveyors Guild</div>
<p className="text-on-surface-variant">Lead Representative: <strong>Capt. Mateu Rosselló, CEng MRINA</strong></p>
<div className="pt-2 text-label-sm font-label-sm text-outline uppercase tracking-wider">Submitted Credentials</div>
<ul className="space-y-1 text-on-surface">
<li className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[16px]">check</span>
                IIMS Full Membership No: <strong>FIIMS-ES-2018-912</strong>
</li>
<li className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[16px]">check</span>
                ISO 9712 NDT Ultrasonic Level II (Hull Thickness)
              </li>
<li className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[16px]">check</span>
                STP Palma Hot Works &amp; Drydock Access Permit 2025/26
              </li>
<li className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[16px]">check</span>
                MB92 Barcelona Restricted Yard Clearance Badge
              </li>
</ul>
</div>

<div className="p-3 bg-surface-container rounded flex items-center justify-between">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-primary text-[24px]">description</span>
<div>
<div className="text-label-md font-label-md text-primary font-semibold">IIMS_Credential_Certificate_2025.pdf</div>
<div className="text-[11px] text-on-surface-variant">Digital Signature: eIDAS Compliant (FNMT Spain)</div>
</div>
</div>
<button className="p-1.5 text-secondary hover:text-primary transition-colors" title="Download &amp; Verify Hash" type="button">
<span className="material-symbols-outlined text-[20px]">visibility</span>
</button>
</div>
</div>

<div className="space-y-4">
<h3 className="font-title-md text-title-md text-primary font-semibold">Direct Verification API Checks</h3>
<div className="space-y-2.5">

<div className="p-3 bg-surface-container-low rounded flex items-start gap-3">
<span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">verified</span>
<div className="flex-1">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md font-semibold text-primary">IIMS International Register Registry</span>
<span className="text-secondary font-label-sm text-label-sm font-bold">MATCH 100%</span>
</div>
<p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5">
                  Verified via Portsmouth IIMS Registry Webhook. Member in continuous good standing since 2018.
                </p>
</div>
</div>

<div className="p-3 bg-surface-container-low rounded flex items-start gap-3">
<span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">shield</span>
<div className="flex-1">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md font-semibold text-primary">Lloyd&apos;s Marine Underwriting Desk</span>
<span className="text-secondary font-label-sm text-label-sm font-bold">ACTIVE COVER</span>
</div>
<p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5">
                  Policy #LL-982144-MED. €10,000,000 professional indemnity verified via coverholder broker portal.
                </p>
</div>
</div>

<div className="p-3 bg-surface-container-low rounded flex items-start gap-3">
<span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">assignment_turned_in</span>
<div className="flex-1">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md font-semibold text-primary">Spanish Tax Agency (AEAT) &amp; Social Security</span>
<span className="text-secondary font-label-sm text-label-sm font-bold">CLEAR</span>
</div>
<p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5">
                  Valid Certificate of Tax Liability Exemption (Certificado de estar al corriente de pagos).
                </p>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-low p-4 rounded flex flex-col justify-between space-y-4">
<div>
<h3 className="font-title-md text-title-md text-primary font-semibold mb-2">Auditor Decision Controls</h3>
<p className="text-body-sm font-body-sm text-on-surface-variant mb-4">
              All approvals are cryptographically recorded in the platform immutable compliance ledger. Notifications are automatically sent to yacht owners with pending surveys.
            </p>
<div className="space-y-2">
<label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">Auditor Internal Notes</label>
<textarea className="w-full p-2 rounded bg-surface-container-lowest text-on-surface text-body-sm font-body-sm placeholder:text-outline focus:outline-none" placeholder="Log notes on IIMS license expiry, drydock permits, or insurance endorsements..." rows={3}>All IIMS credentials and ultrasonic test calibrations validated with manufacturer (Olympus Epoch 650 serial #94812). Ready for 12-month platform renewal.</textarea>
</div>
</div>

<div className="space-y-2 pt-2">
<button className="w-full py-2.5 px-4 rounded bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">verified</span>
              Approve Provider &amp; Endorse Badge
            </button>
<div className="grid grid-cols-2 gap-2">
<button className="py-2 px-3 rounded bg-surface-container text-primary hover:bg-surface-container-high font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">upload_file</span>
                Request Update
              </button>
<button className="py-2 px-3 rounded bg-error-container text-on-error-container hover:bg-error/20 font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">block</span>
                Temp Suspension
              </button>
</div>
</div>
</div>
</div>

<div className="bg-surface-container px-space-md py-2.5 flex flex-wrap items-center justify-between text-[11px] text-on-surface-variant font-label-sm">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[16px]">lock</span>
<span>COMPLIANCE ENFORCEMENT ENGINE v4.2 • EU DIGITAL SERVICES ACT &amp; MARITIME LABOUR CONVENTION VERIFIED</span>
</div>
<div>
          Last audit log: May 24, 2025 — 14:32 CEST (Session ID: Nauta-Staff-Auth-992)
        </div>
</div>
</div>

<div className="p-space-md bg-surface-container-lowest rounded shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
<div className="flex items-center gap-3">
<div className="w-8 h-8 rounded bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[18px]">translate</span>
</div>
<div>
<h4 className="font-title-md text-title-md text-primary font-semibold">Maritime Multi-Language Protocol Status</h4>
<p className="text-body-sm font-body-sm text-on-surface-variant">
            Technical scope documents and quotation line-items are automatically transcribed between English, Spanish, and Italian via Nauta Marine Legal AI.
          </p>
</div>
</div>
<div className="flex items-center gap-3 shrink-0">
<div className="text-right hidden sm:block">
<span className="font-label-sm text-label-sm text-secondary block font-semibold">AI Translation Engine: ACTIVE</span>
<span className="text-[11px] text-outline">Accuracy benchmark: 99.4% nautical terminology</span>
</div>
<button className="px-3 py-1.5 rounded bg-surface-container-low text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" type="button">
          Audit Vocabularies
        </button>
</div>
</div>
</div>
</div>
      </RequirePermission>
    </main>
  );
}
