import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function ProviderRequests() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<aside className="w-full bg-primary text-on-primary py-space-xs px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-space-xs">
<div className="flex items-center gap-space-sm text-center sm:text-left">
<span className="inline-block w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed">Prototype Mode</span>
<span className="hidden md:inline text-on-primary-container font-body-sm">|</span>
<span className="font-body-sm text-body-sm text-surface-container-low font-medium">Service Provider: <strong className="font-semibold text-on-primary">Talleres Navales del Mediterráneo S.L.</strong> (Muelle Viejo, Palma de Mallorca)</span>
</div>
<div className="flex items-center gap-space-md">
<button className="inline-flex items-center gap-1 font-label-md text-label-md text-secondary-fixed hover:text-on-primary transition-colors focus:outline-none" type="button">
<span className="material-symbols-outlined text-[16px]">swap_horiz</span>
          Switch Demo Role
        </button>
<span className="text-on-primary-container font-label-sm">·</span>
<button className="font-label-md text-label-md text-surface-dim hover:text-error transition-colors focus:outline-none" type="button">
          Log Out
        </button>
</div>
</div>
</aside>

<nav className="w-full bg-surface-container-lowest shadow-sm z-40">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex items-center justify-between overflow-x-auto no-scrollbar">
<div className="flex items-center space-x-space-lg min-w-max py-space-xs">
<Link href="#" className="inline-flex items-center gap-space-xs py-space-sm font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" >
<span className="material-symbols-outlined text-[18px]">dashboard</span>
          Overview
        </Link>
<Link href="#" className="inline-flex items-center gap-space-xs py-space-sm font-title-md text-title-md text-primary font-semibold shadow-[inset_0_-2px_0_0] shadow-primary" >
<span className="material-symbols-outlined text-[18px] text-secondary">assignment</span>
          Service Requests
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm">4 New</span>
</Link>
<Link href="#" className="inline-flex items-center gap-space-xs py-space-sm font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" >
<span className="material-symbols-outlined text-[18px]">build</span>
          Provider Services
        </Link>
<Link href="#" className="inline-flex items-center gap-space-xs py-space-sm font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" >
<span className="material-symbols-outlined text-[18px]">verified_user</span>
          Professional Profile
        </Link>
<Link href="#" className="inline-flex items-center gap-space-xs py-space-sm font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" >
<span className="material-symbols-outlined text-[18px]">receipt_long</span>
          Escrow &amp; Invoices
        </Link>
</div>
<div className="hidden lg:flex items-center gap-space-sm text-on-surface-variant font-label-sm text-label-sm">
<span className="material-symbols-outlined text-[16px] text-secondary">anchor</span>
<span>STP Concession #TN-772-PM</span>
</div>
</div>
</nav>

<div className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-xl">

<header className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg pb-space-sm">
<div className="max-w-3xl">
<div className="inline-flex items-center gap-space-xs px-2.5 py-1 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm mb-space-sm">
<span className="material-symbols-outlined text-[14px]">sailing</span>
          WESTERN MEDITERRANEAN SHIPYARD NETWORK
        </div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          Service Requests &amp; Client Quotations
        </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs leading-relaxed">
          Review incoming shipyard and technical service requests from private owners and central agency yacht brokers across the Balearics and Western Mediterranean.
        </p>
</div>
<div className="flex items-center gap-space-sm shrink-0">
<button className="inline-flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container-lowest text-primary font-body-md text-body-md shadow-sm hover:bg-surface-container transition-all" type="button">
<span className="material-symbols-outlined text-[18px] text-on-surface-variant">download</span>
          Export RFQ Registry
        </button>
<button className="inline-flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary font-body-md text-body-md shadow-sm hover:bg-primary transition-all" type="button">
<span className="material-symbols-outlined text-[18px]">add</span>
          Create Custom Quote
        </button>
</div>
</header>

<section aria-label="Operational Metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Pending Inquiries</span>
<div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[18px]">mark_email_unread</span>
</div>
</div>
<div className="mt-space-md">
<div className="font-display-hero text-headline-lg text-primary font-semibold">06</div>
<div className="flex items-center gap-1.5 mt-space-xs">
<span className="inline-block w-2 h-2 rounded-full bg-error"></span>
<span className="font-body-sm text-body-sm text-error font-medium">3 High Priority (Action needed)</span>
</div>
</div>
</div>

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Formal Quotes Submitted</span>
<div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-[18px]">request_quote</span>
</div>
</div>
<div className="mt-space-md">
<div className="font-display-hero text-headline-lg text-primary font-semibold">14</div>
<div className="flex items-center gap-1.5 mt-space-xs">
<span className="material-symbols-outlined text-[16px] text-secondary">trending_up</span>
<span className="font-body-sm text-body-sm text-on-surface-variant font-medium">€84,500 pipeline value</span>
</div>
</div>
</div>

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Booked Work Orders</span>
<div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[18px]">engineering</span>
</div>
</div>
<div className="mt-space-md">
<div className="font-display-hero text-headline-lg text-primary font-semibold">08 <span className="font-title-lg text-title-lg text-on-surface-variant font-normal">Active</span></div>
<div className="flex items-center gap-1.5 mt-space-xs">
<span className="material-symbols-outlined text-[16px] text-secondary">dock</span>
<span className="font-body-sm text-body-sm text-on-surface-variant font-medium">In shipyard drydock / STP</span>
</div>
</div>
</div>

<div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Conversion Rate</span>
<div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-on-tertiary-container">
<span className="material-symbols-outlined text-[18px]">verified</span>
</div>
</div>
<div className="mt-space-md">
<div className="flex items-baseline gap-2">
<span className="font-display-hero text-headline-lg text-primary font-semibold">68%</span>
<span className="font-label-sm text-label-sm text-secondary font-semibold">+4.2% MoM</span>
</div>
<div className="flex items-center gap-1.5 mt-space-xs">
<span className="material-symbols-outlined text-[16px] text-on-tertiary-container">military_tech</span>
<span className="font-body-sm text-body-sm text-on-surface-variant font-medium">Top 5% accredited Balearic yards</span>
</div>
</div>
</div>
</section>

<section aria-label="Table Filters" className="flex flex-col gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
<div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">

<div className="relative flex-1">
<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
<input className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant pl-10 pr-space-md py-2.5 rounded-lg text-body-md font-body-md focus:outline-none focus:bg-surface-container-lowest transition-colors" placeholder="Filter by vessel, owner, ref number, or system..." type="text"/>
</div>

<div className="flex flex-wrap sm:flex-nowrap items-center gap-space-sm">
<div className="relative min-w-[200px] flex-1 sm:flex-initial">
<select className="w-full appearance-none bg-surface-container-low text-primary font-body-md text-body-md py-2.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none">
<option>All Specialties</option>
<option>Marine Diesel Overhaul &amp; Propulsion</option>
<option>Ultrasonic Hull NDT &amp; Thickness Gauging</option>
<option>Marine Electrical &amp; CZone Systems</option>
<option>Standing Rigging &amp; Spar Hydraulics</option>
<option>Nautical Surveyor &amp; Flag State Compliance</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
</div>
<div className="relative min-w-[190px] flex-1 sm:flex-initial">
<select className="w-full appearance-none bg-surface-container-low text-primary font-body-md text-body-md py-2.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none">
<option>Urgency: High to Low</option>
<option>Urgency: Low to High</option>
<option>Date: Newest First</option>
<option>Budget: Highest First</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">sort</span>
</div>
</div>
</div>

<div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar pt-space-xs">
<button className="px-3.5 py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-medium shrink-0" type="button">
          All Requests (28)
        </button>
<button className="px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors font-label-md text-label-md font-medium shrink-0 flex items-center gap-1.5" type="button">
<span className="w-2 h-2 rounded-full bg-error"></span>
          New / Unread (6)
        </button>
<button className="px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors font-label-md text-label-md font-medium shrink-0" type="button">
          Quote Sent (8)
        </button>
<button className="px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors font-label-md text-label-md font-medium shrink-0" type="button">
          Under Negotiation (4)
        </button>
<button className="px-3.5 py-1.5 rounded-full bg-surface-container text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors font-label-md text-label-md font-medium shrink-0" type="button">
          Scheduled Work (10)
        </button>
</div>
</section>

<main aria-label="Requests Feed" className="flex flex-col gap-space-lg">

<article className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-lg transition-all hover:shadow-md">

<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm bg-surface-container-low/40 p-space-sm rounded-lg">
<div className="flex flex-wrap items-center gap-space-sm">
<span className="font-spec-num text-spec-num font-semibold text-primary">#REQ-2025-084</span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
<span className="material-symbols-outlined text-[16px]">schedule</span> Received 2 hours ago
            </span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-secondary font-medium">
<span className="material-symbols-outlined text-[16px]">pin_drop</span> RCN Palma, Pier 4 (Mallorca)
            </span>
</div>
<div className="flex items-center gap-space-xs">
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
              Action Required · New Request
            </span>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

<div className="lg:col-span-4 flex gap-space-md">
<div className="w-28 h-28 rounded-lg overflow-hidden shrink-0 bg-surface-container">
<img alt="" className="w-full h-full object-cover" src="/design/03e66b80f4.jpg"/>
</div>
<div className="flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Sail Yacht · Sloop</span>
<h2 className="font-headline-sm text-headline-sm text-primary leading-tight mt-0.5">Solaris 50 <span className="italic font-normal">‘Baleares Express’</span></h2>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">2021 · LOA: 15.40m · Beam: 4.78m</p>
</div>
<div className="mt-2 text-on-surface font-body-sm text-body-sm flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-on-surface-variant">person</span>
<span>Client: <strong>Capt. Matteo Ferrandiz</strong> (Private Owner Rep)</span>
</div>
</div>
</div>

<div className="lg:col-span-5 flex flex-col gap-space-xs bg-surface-container-low p-space-md rounded-lg">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-semibold">Requested Technical Scope</span>
<span className="px-2 py-0.5 rounded bg-surface-container-highest text-primary font-label-sm text-label-sm font-medium">Engine &amp; Propulsion</span>
</div>
<p className="font-title-md text-title-md text-primary font-medium mt-1">
              1,000h Volvo Penta D2-75 Engine Bench Overhaul &amp; Saildrive Seal Replacement
            </p>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Full diagnostic analysis, heat exchanger ultrasonic de-scaling, raw water pump rebuild, valve clearance tuning, and complete replacement of 130S saildrive diaphragm membrane before offshore voyage to Sardinia.
            </p>
<div className="grid grid-cols-2 gap-space-sm pt-space-xs mt-space-xs text-on-surface-variant font-body-sm text-body-sm">
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-primary">event</span>
<span>Target: <strong>Before 15 Nov 2025</strong></span>
</div>
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
<span className="text-secondary font-medium">Escrow Verified (Nauta Trust)</span>
</div>
</div>
</div>

<div className="lg:col-span-3 flex flex-col justify-between h-full bg-surface-container-low/60 p-space-md rounded-lg">
<div>
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Client Budget Indication</span>
<div className="font-spec-num text-headline-sm text-primary font-semibold mt-1">
                €4,000 – €6,000
              </div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Excludes shipyard crane out fees</p>
</div>
<div className="flex flex-col gap-space-xs mt-space-md">
<button className="w-full inline-flex items-center justify-center gap-1.5 px-space-md py-2 rounded-lg bg-primary text-on-primary font-body-md text-body-md shadow-sm hover:bg-primary-container transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">edit_document</span>
                Draft Quote / Proposal
              </button>
<div className="flex items-center gap-space-xs">
<button className="flex-1 py-1.5 rounded-lg bg-surface-container text-primary font-body-sm text-body-sm hover:bg-surface-container-high transition-colors text-center" type="button">
                  View Full Inquiry
                </button>
<button className="px-3 py-1.5 rounded-lg text-error hover:bg-error-container/40 font-body-sm text-body-sm transition-colors" type="button">
                  Decline
                </button>
</div>
</div>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-lg transition-all hover:shadow-md">

<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm bg-surface-container-low/40 p-space-sm rounded-lg">
<div className="flex flex-wrap items-center gap-space-sm">
<span className="font-spec-num text-spec-num font-semibold text-primary">#REQ-2025-079</span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
<span className="material-symbols-outlined text-[16px]">schedule</span> Received Yesterday · 16:40
            </span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-secondary font-medium">
<span className="material-symbols-outlined text-[16px]">anchor</span> STP Shipyard Berth 4A (Palma)
            </span>
</div>
<div className="flex items-center gap-space-xs">
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              Quote Accepted · Work Order Ready
            </span>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

<div className="lg:col-span-4 flex gap-space-md">
<div className="w-28 h-28 rounded-lg overflow-hidden shrink-0 bg-surface-container">
<img alt="" className="w-full h-full object-cover" src="/design/2ef1cc7663.jpg"/>
</div>
<div className="flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Motor Yacht · Semi-Custom</span>
<h2 className="font-headline-sm text-headline-sm text-primary leading-tight mt-0.5">Benetti Oasis 40M <span className="italic font-normal">‘Luminosa’</span></h2>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">2022 · LOA: 40.80m · Gross Tonnage: 385 GT</p>
</div>
<div className="mt-2 text-on-surface font-body-sm text-body-sm flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-on-surface-variant">apartment</span>
<span>Broker: <strong>Marina Balear S.L.</strong> (Luc Fournier)</span>
</div>
</div>
</div>

<div className="lg:col-span-5 flex flex-col gap-space-xs bg-surface-container-low p-space-md rounded-lg">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-semibold">Survey &amp; Non-Destructive Testing</span>
<span className="px-2 py-0.5 rounded bg-surface-container-highest text-primary font-label-sm text-label-sm font-medium">NDT &amp; Ultrasonic</span>
</div>
<p className="font-title-md text-title-md text-primary font-medium mt-1">
              Pre-Purchase Full Hull Ultrasonic Plate Gauging &amp; Mast NDT Testing
            </p>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Official RINA-certified ultrasonic plate thickness survey across 140 hull baseline points. High-frequency eddy current crack inspection of aluminum arch structure and hydraulic passerelle anchor joints under MYBA standard purchase protocol.
            </p>
<div className="grid grid-cols-2 gap-space-sm pt-space-xs mt-space-xs text-on-surface-variant font-body-sm text-body-sm">
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-primary">date_range</span>
<span>Survey Dates: <strong>28 – 30 Oct 2025</strong></span>
</div>
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">gavel</span>
<span className="text-primary font-medium">MYBA Mandate Escrow</span>
</div>
</div>
</div>

<div className="lg:col-span-3 flex flex-col justify-between h-full bg-surface-container-low/60 p-space-md rounded-lg">
<div>
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Agreed Contract Price</span>
<div className="font-spec-num text-headline-sm text-primary font-semibold mt-1">
                €2,400.00
              </div>
<p className="font-body-sm text-body-sm text-secondary font-medium mt-0.5 flex items-center gap-1">
<span className="material-symbols-outlined text-[14px]">lock</span> 100% Escrow Secured in Nauta
              </p>
</div>
<div className="flex flex-col gap-space-xs mt-space-md">
<button className="w-full inline-flex items-center justify-center gap-1.5 px-space-md py-2 rounded-lg bg-secondary text-on-secondary font-body-md text-body-md shadow-sm hover:bg-on-secondary-container transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                Open Work Order #WO-891
              </button>
<button className="w-full py-1.5 rounded-lg bg-surface-container text-primary font-body-sm text-body-sm hover:bg-surface-container-high transition-colors text-center" type="button">
                Review Escrow Deposit Details
              </button>
</div>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-lg transition-all hover:shadow-md">

<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-sm bg-surface-container-low/40 p-space-sm rounded-lg">
<div className="flex flex-wrap items-center gap-space-sm">
<span className="font-spec-num text-spec-num font-semibold text-primary">#REQ-2025-071</span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
<span className="material-symbols-outlined text-[16px]">schedule</span> Submitted 3 days ago
            </span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-secondary font-medium">
<span className="material-symbols-outlined text-[16px]">location_on</span> Port Adriano (Calvià, Mallorca)
            </span>
</div>
<div className="flex items-center gap-space-xs">
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm font-medium">
<span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
              Quote Pending Client Signature
            </span>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

<div className="lg:col-span-4 flex gap-space-md">
<div className="w-28 h-28 rounded-lg overflow-hidden shrink-0 bg-surface-container">
<img alt="" className="w-full h-full object-cover" src="/design/51adfda0dd.jpg"/>
</div>
<div className="flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Motor Yacht · Flybridge</span>
<h2 className="font-headline-sm text-headline-sm text-primary leading-tight mt-0.5">Sanlorenzo SL88 <span className="italic font-normal">‘Solaria’</span></h2>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">2018 · LOA: 26.76m · Twin MTU 16V</p>
</div>
<div className="mt-2 text-on-surface font-body-sm text-body-sm flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-on-surface-variant">person_check</span>
<span>Client: <strong>Dr. Markus Weber</strong> (Verified Owner)</span>
</div>
</div>
</div>

<div className="lg:col-span-5 flex flex-col gap-space-xs bg-surface-container-low p-space-md rounded-lg">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-semibold">MTU Diagnostics &amp; Spectrometry</span>
<span className="px-2 py-0.5 rounded bg-surface-container-highest text-primary font-label-sm text-label-sm font-medium">Heavy Machinery</span>
</div>
<p className="font-title-md text-title-md text-primary font-medium mt-1">
              Dual MTU 2000 M96L Borescope Cylinder Inspection &amp; Lube Oil Spectrometry
            </p>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Video endoscopic inspection of all 32 combustion chambers, exhaust valves, turbocharger compressor wheels, plus oil samples dispatch to Castrol Marine lab for wear metal particle count (Fe, Cu, Cr).
            </p>
<div className="grid grid-cols-2 gap-space-sm pt-space-xs mt-space-xs text-on-surface-variant font-body-sm text-body-sm">
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-primary">timer</span>
<span>Valid Until: <strong>05 Nov 2025</strong></span>
</div>
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">visibility</span>
<span>Viewed 3x by client</span>
</div>
</div>
</div>

<div className="lg:col-span-3 flex flex-col justify-between h-full bg-surface-container-low/60 p-space-md rounded-lg">
<div>
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Submitted Quote</span>
<div className="font-spec-num text-headline-sm text-primary font-semibold mt-1">
                €3,850.00 <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">ex. VAT</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Quote Ref: #QT-2025-419</p>
</div>
<div className="flex flex-col gap-space-xs mt-space-md">
<button className="w-full inline-flex items-center justify-center gap-1.5 px-space-md py-2 rounded-lg bg-surface-container text-primary font-body-md text-body-md shadow-sm hover:bg-surface-container-high transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">visibility</span>
                View Sent Proposal
              </button>
<button className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-surface-container-lowest text-secondary font-body-sm text-body-sm hover:bg-surface-container transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">send</span>
                Send Polite Reminder
              </button>
</div>
</div>
</div>
</article>
</main>

<aside aria-label="Sponsored Logistics Partner" className="w-full p-space-lg rounded-xl bg-[#F2F6F6] border border-dashed border-outline-variant/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
<div className="flex items-start gap-space-md">
<div className="w-12 h-12 rounded-lg bg-surface-container-lowest flex items-center justify-center text-secondary shrink-0 shadow-sm">
<span className="material-symbols-outlined text-[28px]">rv_hookup</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-2">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant font-bold">Advertisement</span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Nautical Logistics &amp; Craneage</span>
</div>
<h3 className="font-headline-sm text-title-lg text-primary mt-0.5">Transportes Náuticos Marivent</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant max-w-2xl mt-0.5">
            Heavy yacht haulage, oversized road escorts, and guaranteed 200T mobile travel lift drydock slots at STP Palma and Marina Ibiza. Certified Lloyds transport protocol.
          </p>
</div>
</div>
<div className="shrink-0 self-end md:self-center">
<Link href="/contact/" className="inline-flex items-center gap-1.5 px-space-md py-2 rounded-lg bg-primary text-on-primary font-body-md text-body-md shadow-sm hover:bg-primary-container transition-colors" >
<span>Contact Dispatch</span>
<span className="material-symbols-outlined text-[16px]">call</span>
</Link>
</div>
</aside>
</div>
</div>
      </RequirePermission>
    </main>
  );
}
