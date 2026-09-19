import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function StaffServiceRequests() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission permission="approve_listings_and_revisions">
<div className="flex flex-col w-full">

<header className="w-full bg-primary text-on-primary">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xs flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-space-md">
<div className="flex items-center gap-space-xs">
<span className="inline-block w-2.5 h-2.5 rounded-full bg-secondary-fixed animate-pulse"></span>
<span className="font-title-md text-label-md tracking-wider uppercase text-secondary-fixed">Staff Console</span>
</div>
<span className="text-on-primary-container hidden sm:inline">|</span>
<span className="font-body-sm text-surface-dim hidden sm:inline">Maritime Service Operations &amp; Escrow Supervision</span>
<span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-label-sm uppercase">Screen 45 of 51</span>
</div>
<div className="flex items-center gap-space-md font-label-md">
<button className="flex items-center gap-1 text-surface-dim hover:text-on-primary transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">swap_horiz</span>
<span>Switch Demo Role</span>
</button>
<span className="text-on-primary-container">|</span>
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-secondary-fixed text-[18px]">verified_user</span>
<span className="text-on-primary font-medium">Auditor: M. Vives (Palma HQ)</span>
</div>
<span className="text-on-primary-container">|</span>
<button className="text-error-container hover:text-on-primary transition-colors flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">logout</span>
<span>Log Out</span>
</button>
</div>
</div>
</header>

<nav className="w-full bg-surface-container-low shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex items-center gap-space-md overflow-x-auto py-space-xs scrollbar-none font-body-sm text-on-surface-variant">
<Link href="#" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Overview</Link>
<Link href="#" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Users</Link>
<Link href="#" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Boats</Link>
<Link href="/brokers/" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Brokers</Link>
<Link href="#" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Service Providers</Link>
<Link href="#" className="py-space-xs px-space-sm rounded bg-primary text-on-primary font-medium whitespace-nowrap flex items-center gap-1.5 shadow-sm" >
<span>Service Requests</span>
<span className="px-1.5 py-0.2 rounded-full bg-secondary-container text-on-secondary-container font-label-sm">48 Active</span>
</Link>
<Link href="#" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Leads</Link>
<Link href="#" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Subscriptions</Link>
<Link href="#" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Ads &amp; Banners</Link>
<Link href="#" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Guides &amp; Blog</Link>
<Link href="#" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Analytics</Link>
<Link href="#" className="py-space-xs px-space-sm rounded hover:text-primary whitespace-nowrap" >Settings</Link>
</div>
</div>
</nav>

<div className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="flex flex-col gap-space-xs max-w-3xl">
<div className="flex items-center gap-space-sm flex-wrap">
<span className="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded bg-surface-container-high text-primary font-label-sm tracking-wider uppercase">
<span className="material-symbols-outlined text-[14px] text-secondary">anchor</span>
            Maritime Logistics &amp; Yard Dispatch
          </span>
<span className="inline-flex items-center gap-1 px-space-sm py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm uppercase font-semibold">
            Escrow Audit #OPS-45
          </span>
<span className="text-body-sm text-on-surface-variant font-label-sm tracking-tight">STP Palma • Portofino • Cannes</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          Service Request &amp; Work Order Supervision
        </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant">
          Monitor, mediate, and audit high-value marine repair work orders, refit contracts, pre-purchase surveys, and escrow deposits across accredited Mediterranean yards.
        </p>
</div>
<div className="flex flex-wrap items-center gap-space-sm shrink-0">
<button className="inline-flex items-center gap-space-xs px-space-md py-space-sm rounded bg-surface-container-lowest text-primary hover:bg-surface-container transition-colors shadow-sm font-label-md" type="button">
<span className="material-symbols-outlined text-[18px]">download</span>
<span>Export RFQ Audit Log (CSV)</span>
</button>
<button className="inline-flex items-center gap-space-xs px-space-md py-space-sm rounded bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-sm font-label-md" type="button">
<span className="material-symbols-outlined text-[18px]">gavel</span>
<span>+ Manual Dispute Intervention</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-space-md relative overflow-hidden">
<div className="flex items-start justify-between">
<span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Total Inquiries / RFQs</span>
<span className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[20px]">assignment</span>
</span>
</div>
<div className="flex flex-col gap-1">
<div className="flex items-baseline gap-space-xs">
<span className="font-display-hero text-headline-lg text-primary tracking-tight font-headline-md">342</span>
<span className="font-label-sm text-secondary flex items-center gap-0.5">
<span className="material-symbols-outlined text-[14px]">trending_up</span> 18%
            </span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Balearics (184), Liguria (98), Côte d&apos;Azur (60)</span>
</div>
<div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
<div className="bg-secondary h-full" style={{"width": "72%"}}></div>
</div>
</div>

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-space-md relative overflow-hidden">
<div className="flex items-start justify-between">
<span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Active Quoted Value</span>
<span className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-[20px]">euro</span>
</span>
</div>
<div className="flex flex-col gap-1">
<div className="flex items-baseline gap-space-xs">
<span className="font-display-hero text-headline-lg text-primary tracking-tight font-headline-md">€1,280,500</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Avg Yard Turnaround: <strong>3.4 hrs</strong> response</span>
</div>
<div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
<div className="bg-primary h-full" style={{"width": "86%"}}></div>
</div>
</div>

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-space-md relative overflow-hidden">
<div className="flex items-start justify-between">
<span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Work Orders Active</span>
<span className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[20px]">precision_manufacturing</span>
</span>
</div>
<div className="flex flex-col gap-1">
<div className="flex items-baseline gap-space-xs">
<span className="font-display-hero text-headline-lg text-primary tracking-tight font-headline-md">48</span>
<span className="font-label-sm text-on-surface-variant">hulls</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">36 Yard Drydocks · 12 Mobile Dispatches</span>
</div>
<div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
<div className="bg-secondary h-full" style={{"width": "65%"}}></div>
</div>
</div>

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-space-md relative overflow-hidden">
<div className="flex items-start justify-between">
<span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Escrow In-Custody</span>
<span className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-tertiary-container">
<span className="material-symbols-outlined text-[20px]">account_balance</span>
</span>
</div>
<div className="flex flex-col gap-1">
<div className="flex items-baseline gap-space-xs">
<span className="font-display-hero text-headline-lg text-primary tracking-tight font-headline-md">€485,200</span>
</div>
<span className="font-body-sm text-body-sm text-secondary font-medium">Banc Sabadell &amp; Intesa Sanpaolo Escrow Vaults</span>
</div>
<div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
<div className="bg-secondary-fixed-dim h-full" style={{"width": "94%"}}></div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-md">
<div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">

<div className="relative flex-1 min-w-[280px]">
<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
<input className="w-full pl-10 pr-space-md py-2.5 rounded bg-surface-container-low text-on-surface placeholder-on-surface-variant font-body-md focus:outline-none focus:bg-surface-container-lowest transition-all" placeholder="Search by RFQ ID, vessel name, provider or client..." type="text"/>
</div>

<div className="flex flex-wrap items-center gap-space-sm">
<div className="relative">
<select className="appearance-none bg-surface-container-low text-on-surface font-body-sm py-2.5 pl-3 pr-8 rounded focus:outline-none cursor-pointer">
<option>Category: All Marine Services</option>
<option>Engine &amp; Maintenance</option>
<option>Pre-purchase Survey</option>
<option>Legal &amp; Flag Transfer</option>
<option>Transport &amp; Haulage</option>
</select>
<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
</div>
<div className="relative">
<select className="appearance-none bg-surface-container-low text-on-surface font-body-sm py-2.5 pl-3 pr-8 rounded focus:outline-none cursor-pointer">
<option>Status: All Active &amp; Settled</option>
<option>In Review</option>
<option>Formal Quote Sent</option>
<option>Escrow Funded</option>
<option>Flagged / Dispute</option>
</select>
<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
</div>
<div className="relative">
<select className="appearance-none bg-surface-container-low text-on-surface font-body-sm py-2.5 pl-3 pr-8 rounded focus:outline-none cursor-pointer">
<option>Jurisdiction: Western Med</option>
<option>Spain (Balearics / Barcelona)</option>
<option>Italy (Liguria / Tyrrhenian)</option>
<option>France (Côte d&apos;Azur)</option>
</select>
<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">expand_more</span>
</div>
</div>
</div>

<div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
<div className="flex flex-wrap items-center gap-space-xs font-label-md">
<button className="px-3 py-1 rounded-full bg-primary text-on-primary" type="button">
            All Requests (342)
          </button>
<button className="px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors" type="button">
            Escrow Deposited (48)
          </button>
<button className="px-3 py-1 rounded-full bg-error-container text-on-error-container font-semibold flex items-center gap-1" type="button">
<span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
            Needs Mediation (2)
          </button>
<button className="px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors" type="button">
            High Value (&gt;€50k) (14)
          </button>
<button className="px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant hover:text-primary transition-colors" type="button">
            RINA / Lloyd&apos;s Certified (39)
          </button>
</div>
<div className="text-on-surface-variant font-body-sm flex items-center gap-2">
<span>Showing <strong>5 of 342</strong> operations</span>
<span className="text-outline-variant">·</span>
<button className="text-secondary hover:underline flex items-center gap-0.5" type="button">
<span className="material-symbols-outlined text-[16px]">refresh</span> Real-time Sync
          </button>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
<div className="overflow-x-auto">
<table className="w-full text-left font-body-md border-collapse">
<thead>
<tr className="bg-surface-container-low text-on-surface-variant font-label-md text-label-md uppercase tracking-wider">
<th className="py-space-md px-space-md">Request / Ref ID</th>
<th className="py-space-md px-space-md">Vessel &amp; Client</th>
<th className="py-space-md px-space-md">Service Provider / Yard</th>
<th className="py-space-md px-space-md">Scope &amp; Work Order</th>
<th className="py-space-md px-space-md">Quoted / Escrow</th>
<th className="py-space-md px-space-md">Status &amp; Jurisdiction</th>
<th className="py-space-md px-space-md text-right">Staff Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-transparent font-body-sm">

<tr className="hover:bg-surface-container-low/50 transition-colors group">
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-spec-num text-spec-num font-semibold text-primary">#REQ-2025-084</span>
<span className="font-label-sm text-outline">Created 2d ago</span>
<span className="inline-flex items-center gap-1 font-label-sm text-secondary mt-1">
<span className="material-symbols-outlined text-[12px]">verified</span> Pre-cleared
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-title-md text-primary font-headline-sm text-title-md">Solaris 50 &apos;Baleares Express&apos;</span>
<span className="text-on-surface-variant">Capt. Matteo Ferrandiz (Broker: Engel &amp; Völkers Yachting)</span>
<span className="font-label-sm text-outline">LOA: 15.42m · Flag: Spanish Lista 6ª</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-title-md text-primary">Talleres Navales del Med S.L.</span>
<span className="text-on-surface-variant">Yard Berth: STP Palma (Drydock 4)</span>
<span className="font-label-sm text-secondary font-medium">Tier-1 Certified Yard</span>
</div>
</td>
<td className="py-space-md px-space-md align-top max-w-xs">
<div className="flex flex-col gap-1">
<p className="font-medium text-primary line-clamp-2">1,000h Volvo Penta Overhaul &amp; Saildrive Seal Replacement</p>
<span className="text-on-surface-variant font-label-sm">Includes dyno benchmark &amp; bronze prop balancing</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-spec-num text-spec-num font-semibold text-primary">€4,029.30</span>
<span className="font-label-sm text-secondary font-medium">30% Escrow: €1,200.00</span>
<span className="font-label-sm text-outline">Held at Sabadell Escrow</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm font-medium w-max">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Sea Trial Slated
                  </span>
<span className="text-on-surface-variant font-label-sm flex items-center gap-1">
<span className="material-symbols-outlined text-[13px]">place</span> Spain (Mallorca)
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top text-right">
<div className="flex items-center justify-end gap-space-xs">
<button className="p-1.5 rounded bg-surface-container hover:bg-surface-container-high text-primary transition-colors" title="Audit Dossier" type="button">
<span className="material-symbols-outlined text-[18px]">folder_open</span>
</button>
<button className="px-2.5 py-1.5 rounded bg-primary text-on-primary font-label-md hover:bg-primary-container transition-colors" type="button">
                    Milestones
                  </button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors group bg-surface-container-low/20">
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-spec-num text-spec-num font-semibold text-primary">#REQ-2025-079</span>
<span className="font-label-sm text-outline">Created 4d ago</span>
<span className="inline-flex items-center gap-1 font-label-sm text-secondary mt-1">
<span className="material-symbols-outlined text-[12px]">security</span> Full Escrow
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-title-md text-primary font-headline-sm text-title-md">Benetti Oasis 40M &apos;Luminosa&apos;</span>
<span className="text-on-surface-variant">Marina Balear Yachting (Buyer Mandate)</span>
<span className="font-label-sm text-outline">LOA: 40.80m · Gross Tons: 385 GT</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-title-md text-primary">Balearic Maritime Surveyors Guild</span>
<span className="text-on-surface-variant">Lead: Ing. Carlos Menéndez (RINA)</span>
<span className="font-label-sm text-secondary font-medium">Independent Accredited</span>
</div>
</td>
<td className="py-space-md px-space-md align-top max-w-xs">
<div className="flex flex-col gap-1">
<p className="font-medium text-primary line-clamp-2">Full Pre-Purchase Ultrasonic Plate &amp; Mast NDT Survey</p>
<span className="text-on-surface-variant font-label-sm">Hull thickness map + thermal scan electrical array</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-spec-num text-spec-num font-semibold text-primary">€2,400.00</span>
<span className="font-label-sm text-secondary font-medium">100% Escrow Secured</span>
<span className="font-label-sm text-outline">Auto-release on PDF delivery</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm font-medium w-max">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Surveyor Dispatched
                  </span>
<span className="text-on-surface-variant font-label-sm flex items-center gap-1">
<span className="material-symbols-outlined text-[13px]">place</span> Port Adriano (Spain)
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top text-right">
<div className="flex items-center justify-end gap-space-xs">
<button className="p-1.5 rounded bg-surface-container hover:bg-surface-container-high text-primary transition-colors" title="Audit Survey Report" type="button">
<span className="material-symbols-outlined text-[18px]">verified</span>
</button>
<button className="px-2.5 py-1.5 rounded bg-primary text-on-primary font-label-md hover:bg-primary-container transition-colors" type="button">
                    Inspect Cert
                  </button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors group">
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-spec-num text-spec-num font-semibold text-primary">#REQ-2025-071</span>
<span className="font-label-sm text-outline">Created 5d ago</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-title-md text-primary font-headline-sm text-title-md">Sanlorenzo SL88 &apos;Solaria&apos;</span>
<span className="text-on-surface-variant">Dr. Markus Weber (Munich / Portofino)</span>
<span className="font-label-sm text-outline">LOA: 26.80m · Engines: 2x MTU 2000 M96L</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-title-md text-primary">Talleres Navales del Med</span>
<span className="text-on-surface-variant">Rep: G. Rossi (Mobile Tech Unit)</span>
<span className="font-label-sm text-outline">Field Tech Dispatched</span>
</div>
</td>
<td className="py-space-md px-space-md align-top max-w-xs">
<div className="flex flex-col gap-1">
<p className="font-medium text-primary line-clamp-2">Dual MTU 2000 M96L Borescope &amp; Spectrometry</p>
<span className="text-on-surface-variant font-label-sm">Oil chromatography &amp; cylinder liner inspection</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-spec-num text-spec-num font-semibold text-primary">€3,850.00</span>
<span className="font-label-sm text-outline-variant font-medium">Escrow Pending</span>
<span className="font-label-sm text-outline">Quote validity: 48h left</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm font-medium w-max">
<span className="w-1.5 h-1.5 rounded-full bg-outline"></span> Client Reviewing
                  </span>
<span className="text-on-surface-variant font-label-sm flex items-center gap-1">
<span className="material-symbols-outlined text-[13px]">place</span> Italy (Liguria)
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top text-right">
<div className="flex items-center justify-end gap-space-xs">
<button className="px-2.5 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-primary font-label-md transition-colors" type="button">
                    Send Reminder
                  </button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors group bg-surface-container-low/20">
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-spec-num text-spec-num font-semibold text-primary">#REQ-2025-065</span>
<span className="font-label-sm text-outline">Created 6d ago</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-title-md text-primary font-headline-sm text-title-md">Custom Line 106 &apos;Altamar&apos;</span>
<span className="text-on-surface-variant">Mateo Cardoso (Managing Trustee)</span>
<span className="font-label-sm text-outline">Flag De-registration in progress</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-title-md text-primary">Bufete Balear Náutico Abogados</span>
<span className="text-on-surface-variant">Maritime Partner: L. Vidal</span>
<span className="font-label-sm text-secondary font-medium">Verified Legal Counsel</span>
</div>
</td>
<td className="py-space-md px-space-md align-top max-w-xs">
<div className="flex flex-col gap-1">
<p className="font-medium text-primary line-clamp-2">Bilateral Notarial Deed Legalization (Lista 7ª to Italian RID)</p>
<span className="text-on-surface-variant font-label-sm">Dossier Hague Apostille &amp; Maritime Lien clearance</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-spec-num text-spec-num font-semibold text-primary">€4,850.00</span>
<span className="font-label-sm text-secondary font-medium">Escrow Released 50%</span>
<span className="font-label-sm text-outline">€2,425 held for final deed</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm font-medium w-max">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Notary Slated
                  </span>
<span className="text-on-surface-variant font-label-sm flex items-center gap-1">
<span className="material-symbols-outlined text-[13px]">place</span> Palma &amp; Genoa
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top text-right">
<div className="flex items-center justify-end gap-space-xs">
<button className="px-2.5 py-1.5 rounded bg-surface-container hover:bg-surface-container-high text-primary font-label-md transition-colors" type="button">
                    Draft Bill of Sale
                  </button>
</div>
</td>
</tr>

<tr className="bg-error-container/20 hover:bg-error-container/30 transition-colors">
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-spec-num text-spec-num font-semibold text-error">#REQ-2025-058</span>
<span className="font-label-sm text-error font-medium">Flagged by Auditor</span>
<span className="inline-flex items-center gap-1 font-label-sm text-error font-semibold mt-1">
<span className="material-symbols-outlined text-[14px]">warning</span> Transit Cover Cap
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-title-md text-primary font-headline-sm text-title-md">Axopar 37 Sun-Top &apos;Ventura&apos;</span>
<span className="text-on-surface-variant">Jaume Soler Pons (Palma)</span>
<span className="font-label-sm text-outline">Beam: 3.35m · Weight: 3,770 kg</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-title-md text-primary">Trans-Med Heavy Yacht Carrier Ltd</span>
<span className="text-on-surface-variant">Dispatcher: Capt. T. Delcroix</span>
<span className="font-label-sm text-error font-medium">Insurance Policy Audit Req.</span>
</div>
</td>
<td className="py-space-md px-space-md align-top max-w-xs">
<div className="flex flex-col gap-1">
<p className="font-medium text-primary line-clamp-2">Overland Transport Mallorca to Genoa via Ro-Ro Valencia</p>
<span className="text-on-surface-variant font-label-sm">Disassembly of T-top &amp; hydraulic cradle securitization</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-0.5">
<span className="font-spec-num text-spec-num font-semibold text-primary">€8,900.00</span>
<span className="font-label-sm text-error font-medium">Escrow On Hold</span>
<span className="font-label-sm text-outline">Client deposited €8,900</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error text-on-error font-label-sm font-medium w-max">
<span className="w-1.5 h-1.5 rounded-full bg-on-error animate-pulse"></span> Insurance Discrepancy
                  </span>
<span className="text-on-surface-variant font-label-sm flex items-center gap-1">
<span className="material-symbols-outlined text-[13px]">place</span> Spain → Italy
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top text-right">
<div className="flex items-center justify-end gap-space-xs">
<button className="px-3 py-1.5 rounded bg-error text-on-error font-label-md hover:bg-on-error-container transition-colors shadow-sm flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">policy</span>
                    Resolve Flag
                  </button>
</div>
</td>
</tr>
</tbody>
</table>
</div>

<div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-md font-body-sm text-on-surface-variant">
<div className="flex items-center gap-space-sm">
<span>Displaying 1-5 of 342 work orders</span>
<span className="text-outline-variant">·</span>
<span>Escrow Protected Volume: <strong>€485,200.00</strong></span>
</div>
<div className="flex items-center gap-space-xs font-label-md">
<button className="w-8 h-8 rounded bg-surface-container-lowest text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">chevron_left</span>
</button>
<button className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-medium shadow-sm" type="button">1</button>
<button className="w-8 h-8 rounded bg-surface-container-lowest text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors" type="button">2</button>
<button className="w-8 h-8 rounded bg-surface-container-lowest text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors" type="button">3</button>
<span className="px-1 text-outline">...</span>
<button className="w-8 h-8 rounded bg-surface-container-lowest text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors" type="button">69</button>
<button className="w-8 h-8 rounded bg-surface-container-lowest text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">chevron_right</span>
</button>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-md p-space-xl flex flex-col gap-space-lg relative overflow-hidden">

<div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pb-space-sm">
<div className="flex items-center gap-space-sm">
<span className="w-10 h-10 rounded-lg bg-error-container text-on-error-container flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[24px]">gavel</span>
</span>
<div className="flex flex-col">
<div className="flex items-center gap-space-xs">
<span className="font-headline-sm text-headline-sm text-primary">Dispute Mediation Protocol &amp; Escrow Milestones</span>
<span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-label-sm font-semibold uppercase">Inspection Required</span>
</div>
<span className="font-body-sm text-on-surface-variant">Flagged Audit for RFQ #REQ-2025-058 · Trans-Med Heavy Yacht Carrier Ltd</span>
</div>
</div>
<div className="flex items-center gap-space-sm font-label-md">
<span className="font-spec-num text-primary font-semibold">Total Held: €8,900.00</span>
<span className="text-outline-variant">|</span>
<span className="text-secondary font-medium">Banc Sabadell Custody ID: #SB-9941-MT</span>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">

<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant">Issue Diagnostic</span>
<span className="text-error font-label-sm font-bold flex items-center gap-0.5">
<span className="material-symbols-outlined text-[14px]">report</span> High Priority
              </span>
</div>
<p className="font-title-md text-primary">Cargo Transit Indemnity Cap Deficit</p>
<p className="font-body-sm text-on-surface-variant">
              The carrier&apos;s standard CMR haulage cover is capped at €150,000. However, the vessel’s agreed insured valuation under Nauta brokerage registry is <strong>€290,000</strong>. Transport cannot embark from Valencia ferry terminal without secondary hull extension endorsement.
            </p>
</div>
<div className="p-space-sm rounded bg-surface-container-lowest text-body-sm text-on-surface flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">verified_user</span>
<div>
<span className="font-medium text-primary block">Lloyd&apos;s Med Underwriters</span>
<span className="text-outline font-label-sm">Primary Carrier Policy: #LLD-8820-2024</span>
</div>
</div>
</div>

<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant">Escrow Release Tranches</span>
<div className="flex flex-col gap-space-sm pt-space-xs">

<div className="flex items-start gap-space-sm">
<div className="w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0 text-[12px] font-bold">1</div>
<div className="flex flex-col">
<span className="font-title-md text-body-md text-primary">Tranche 1: Disassembly &amp; Loading (30%)</span>
<span className="font-label-sm text-secondary font-medium">€2,670 · Surveyor Sign-off Complete</span>
</div>
</div>

<div className="flex items-start gap-space-sm">
<div className="w-6 h-6 rounded-full bg-error text-on-error flex items-center justify-center shrink-0 text-[12px] font-bold">!</div>
<div className="flex flex-col">
<span className="font-title-md text-body-md text-primary">Tranche 2: Ro-Ro Ferry Passage (40%)</span>
<span className="font-label-sm text-error font-medium">€3,560 · HELD: Transit Policy Cap Deficit</span>
</div>
</div>

<div className="flex items-start gap-space-sm">
<div className="w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0 text-[12px] font-bold">3</div>
<div className="flex flex-col">
<span className="font-title-md text-body-md text-on-surface-variant">Tranche 3: Genoa Slipway Reassembly (30%)</span>
<span className="font-label-sm text-outline">€2,670 · Post-transit hull inspection</span>
</div>
</div>
</div>
</div>
<div className="text-right">
<span className="font-label-sm text-outline">Supervised by Nauta Escrow Protocol v3.2</span>
</div>
</div>

<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant">Administrative Decision</span>
<p className="font-body-sm text-on-surface-variant">
              Auditor manual intervention allows partial cargo rider injection or formal work order suspension.
            </p>
</div>
<div className="flex flex-col gap-space-xs">
<button className="w-full py-2.5 px-space-md rounded bg-primary text-on-primary font-label-md hover:bg-primary-container transition-colors shadow-sm text-center" type="button">
              Approve Route &amp; Release Transit Escrow
            </button>
<button className="w-full py-2.5 px-space-md rounded bg-surface-container-lowest text-primary font-label-md hover:bg-surface-container-high transition-colors shadow-sm text-center" type="button">
              Request Revised Surveyor Assessment
            </button>
<button className="w-full py-2.5 px-space-md rounded bg-error-container text-on-error-container font-label-md hover:bg-error hover:text-on-error transition-colors text-center" type="button">
              Issue Formal Notice of Suspension
            </button>
</div>
</div>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">

<div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
<div className="flex items-center justify-between">
<div className="flex flex-col">
<span className="font-headline-sm text-headline-sm text-primary">Accredited Mediterranean Shipyard Slots</span>
<span className="font-body-sm text-on-surface-variant">Real-time crane, travel-lift (700t), and hardstanding availability</span>
</div>
<span className="px-2.5 py-1 rounded bg-secondary-container text-on-secondary-container font-label-md font-medium">
            36 Active Bookings
          </span>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md pt-space-xs">

<div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
<div className="flex items-center justify-between">
<span className="font-title-md text-primary">STP Shipyard Palma</span>
<span className="font-label-sm text-secondary font-bold">92% Capacity</span>
</div>
<span className="font-body-sm text-on-surface-variant">Mallorca, Spain · 700t Travel Lift</span>
<div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mt-1">
<div className="bg-secondary h-full" style={{"width": "92%"}}></div>
</div>
<span className="font-label-sm text-outline mt-1">18 Nauta Vessels in Drydock</span>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
<div className="flex items-center justify-between">
<span className="font-title-md text-primary">Amico &amp; Co Shipyard</span>
<span className="font-label-sm text-secondary font-bold">68% Capacity</span>
</div>
<span className="font-body-sm text-on-surface-variant">Genoa, Italy · Covered Drydock 100m</span>
<div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mt-1">
<div className="bg-primary h-full" style={{"width": "68%"}}></div>
</div>
<span className="font-label-sm text-outline mt-1">9 Nauta Superyachts in Refit</span>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
<div className="flex items-center justify-between">
<span className="font-title-md text-primary">Chantier Naval de Marseille</span>
<span className="font-label-sm text-secondary font-bold">45% Capacity</span>
</div>
<span className="font-body-sm text-on-surface-variant">Marseille, France · Deep Water Keel Pit</span>
<div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mt-1">
<div className="bg-secondary h-full" style={{"width": "45%"}}></div>
</div>
<span className="font-label-sm text-outline mt-1">5 Work Orders Scheduled</span>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
<div className="flex items-center justify-between">
<span className="font-title-md text-primary">Marina di Olbia Yard</span>
<span className="font-label-sm text-secondary font-bold">54% Capacity</span>
</div>
<span className="font-body-sm text-on-surface-variant">Sardinia, Italy · Haulage &amp; Wintering</span>
<div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mt-1">
<div className="bg-primary h-full" style={{"width": "54%"}}></div>
</div>
<span className="font-label-sm text-outline mt-1">4 Catamarans in Winterization</span>
</div>
</div>
</div>

<div className="lg:col-span-5 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-sm">
<div className="flex items-center justify-between">
<span className="font-headline-sm text-headline-sm text-primary">Cross-Border AI Translation Log</span>
<span className="px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant font-label-sm font-semibold uppercase">Legal Accuracy Engine</span>
</div>
<p className="font-body-sm text-on-surface-variant">
            All maritime surveyor notes, bills of lading, and shipyard quotations automatically synchronize across Spanish, Italian, and English with nautical maritime terminology checks.
          </p>

<div className="flex items-center gap-space-xs pt-space-xs">
<button className="px-3 py-1 rounded text-body-sm font-medium bg-primary text-on-primary" type="button">Original [ES]</button>
<button className="px-3 py-1 rounded text-body-sm font-medium bg-surface-container-low text-on-surface-variant hover:text-primary" type="button">Translated [EN]</button>
<button className="px-3 py-1 rounded text-body-sm font-medium bg-surface-container-low text-on-surface-variant hover:text-primary" type="button">Translated [IT]</button>
</div>
<div className="p-space-md rounded-lg bg-surface-container-low text-body-sm text-on-surface flex flex-col gap-1.5">
<div className="flex items-center justify-between">
<span className="font-label-sm text-secondary font-semibold uppercase">Accredited Marine Surveyor Note #402</span>
<span className="font-label-sm text-outline">Updated 18m ago</span>
</div>
<p className="italic text-on-surface-variant">
              &quot;Inspección de prensaestopas y cojinete del arbotante concluida. Sin holguras axiales en el eje de babor. Procedemos al calibrado del pasacascos antes de botadura.&quot;
            </p>
<div className="pt-2 flex items-center justify-between font-label-sm text-outline">
<span className="flex items-center gap-1 text-secondary">
<span className="material-symbols-outlined text-[14px]">g_translate</span> Terminology: ISO 12215 / Lloyd&apos;s SSC
              </span>
<span className="text-primary font-medium">Audit Status: Verified</span>
</div>
</div>
</div>
<div className="pt-space-sm flex items-center justify-between">
<span className="font-label-sm text-outline uppercase tracking-wider">Automated Audit Interval: 15s</span>
<Link href="#" className="font-label-md text-secondary hover:underline flex items-center gap-1 font-medium" >
<span>View Full Machine Translation Ledger</span>
<span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</Link>
</div>
</div>
</div>
</div>


</div>
      </RequirePermission>
    </main>
  );
}
