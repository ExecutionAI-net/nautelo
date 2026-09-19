import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function StaffLeads() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission permission="approve_listings_and_revisions">
<div className="flex flex-col w-full">

<div className="w-full bg-primary text-on-primary px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xs shadow-md z-40">
<div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-space-md">
<div className="flex items-center gap-1.5 font-label-md tracking-wider uppercase text-secondary-fixed">
<span className="inline-block w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
<span>Staff Console</span>
</div>
<span className="text-on-primary-container font-label-sm">|</span>
<span className="text-surface-container-highest font-medium hidden sm:inline">Commercial CRM Oversight — Screen 46 of 51</span>
</div>
<div className="flex items-center gap-space-md font-label-md">
<span className="text-surface-container-high hidden md:inline">Operated by Mediterranean Command (Palma HQ)</span>
<button className="px-2.5 py-1 bg-primary-container text-surface-bright hover:bg-secondary transition-colors rounded" type="button">Switch Demo Role</button>
<button className="text-on-primary-container hover:text-on-primary transition-colors flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">logout</span>
<span>Log Out</span>
</button>
</div>
</div>
</div>

<div className="w-full bg-surface-container-lowest shadow-sm overflow-x-auto">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex items-center gap-space-sm whitespace-nowrap min-w-max h-12">
<Link href="#" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Overview</Link>
<Link href="#" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Users</Link>
<Link href="#" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Boats</Link>
<Link href="/brokers/" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Brokers</Link>
<Link href="#" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Service Providers</Link>
<Link href="#" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Service Requests</Link>
<Link href="#" className="px-3 py-1.5 font-body-sm bg-primary-container text-on-primary font-semibold rounded shadow-sm flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[15px] text-secondary-fixed">hub</span>
<span>Leads</span>
</Link>
<Link href="#" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Subscriptions</Link>
<Link href="#" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Ads &amp; Banners</Link>
<Link href="#" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Guides &amp; Blog</Link>
<Link href="#" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Analytics</Link>
<Link href="#" className="px-3 py-1.5 font-body-sm text-on-surface-variant hover:text-primary transition-colors rounded" >Settings</Link>
</div>
</div>

<div className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-2xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="flex flex-col gap-space-xs max-w-3xl">
<div className="inline-flex items-center gap-2 self-start px-2.5 py-0.5 rounded-full bg-surface-container-high text-secondary font-label-sm uppercase tracking-wider">
<span className="material-symbols-outlined text-[14px]">shield_person</span>
<span>Commercial Intelligence &amp; Broker Lead Integrity</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Marketplace Leads &amp; Deal Pipeline Governance</h1>
<p className="font-body-md text-on-surface-variant leading-relaxed">
          Supervise incoming inquiries, high-intent buyer matchmaking, response-time SLAs of central agency brokerages, and cross-border purchase declarations across the Mediterranean basin.
        </p>
</div>
<div className="flex flex-wrap items-center gap-space-sm shrink-0">
<button className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest text-primary hover:bg-surface-container-high transition-colors font-body-md font-medium rounded-lg shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px] text-secondary">file_download</span>
<span>Export Leads Ledger (CSV)</span>
</button>
<button className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary hover:bg-primary-container transition-colors font-body-md font-medium rounded-lg shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px] text-secondary-fixed">tune</span>
<span>Configure Broker SLA Alerts</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex items-center justify-between">
<span className="font-label-md uppercase text-on-surface-variant tracking-wider">Total Leads (30 Days)</span>
<span className="p-2 rounded-lg bg-surface-container-low text-primary material-symbols-outlined text-[20px]">leaderboard</span>
</div>
<div>
<div className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">1,842</div>
<div className="flex items-center gap-1 font-body-sm text-secondary mt-1">
<span className="material-symbols-outlined text-[16px]">trending_up</span>
<span className="font-semibold">+24%</span>
<span className="text-on-surface-variant font-normal">vs. prior month</span>
</div>
</div>
<div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "76%"}}></div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex items-center justify-between">
<span className="font-label-md uppercase text-on-surface-variant tracking-wider">Median Response Time</span>
<span className="p-2 rounded-lg bg-surface-container-low text-primary material-symbols-outlined text-[20px]">timer</span>
</div>
<div>
<div className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">1.8 hrs</div>
<div className="font-body-sm text-on-surface-variant mt-1">
            Target SLA: <span className="font-semibold text-primary">&lt; 4.0 hrs</span> • <span className="text-secondary font-semibold">92%</span> Compliance
          </div>
</div>
<div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "92%"}}></div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex items-center justify-between">
<span className="font-label-md uppercase text-on-surface-variant tracking-wider">Escrow Pipeline</span>
<span className="p-2 rounded-lg bg-surface-container-low text-secondary material-symbols-outlined text-[20px]">account_balance</span>
</div>
<div>
<div className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">€64.2M</div>
<div className="font-body-sm text-on-surface-variant mt-1">
            Est. gross potential fees: <span className="font-semibold text-primary">€3.2M</span>
</div>
</div>
<div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "84%"}}></div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex items-center justify-between">
<span className="font-label-md uppercase text-on-surface-variant tracking-wider">Unattended Leads (&gt;24h)</span>
<span className="p-2 rounded-lg bg-error-container text-error material-symbols-outlined text-[20px]">warning</span>
</div>
<div>
<div className="flex items-baseline gap-2">
<span className="font-headline-lg text-headline-lg font-bold text-error tracking-tight">3</span>
<span className="font-label-sm uppercase px-2 py-0.5 rounded bg-error-container text-error font-semibold">SLA Triggered</span>
</div>
<div className="font-body-sm text-on-surface-variant mt-1">
            Alert escalated to regional broker liaisons
          </div>
</div>
<div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
<div className="bg-error h-full rounded-full" style={{"width": "15%"}}></div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
<div>
<span className="font-label-sm uppercase tracking-wider text-secondary">Conversion Matrix</span>
<h2 className="font-headline-sm text-headline-sm text-primary">High-Ticket Maritime Transaction Funnel</h2>
</div>
<div className="font-label-md text-on-surface-variant flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span>Live Synchronized with Real-Time MYBA &amp; Nauta Notary Portals</span>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-5 gap-space-sm pt-space-xs">

<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-space-sm">
<div className="flex items-center justify-between text-on-surface-variant">
<span className="font-label-sm uppercase font-semibold">Stage 01</span>
<span className="material-symbols-outlined text-[18px]">chat</span>
</div>
<div>
<div className="font-headline-sm text-headline-sm font-semibold text-primary">1,120</div>
<div className="font-body-sm font-medium text-on-surface">Initial Inquiries</div>
<div className="font-body-sm text-on-surface-variant text-[11px] mt-0.5">Portal, AI Chat &amp; MLS feeds</div>
</div>
<div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{"width": "100%"}}></div>
</div>
</div>

<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-space-sm">
<div className="flex items-center justify-between text-on-surface-variant">
<span className="font-label-sm uppercase font-semibold">Stage 02</span>
<span className="material-symbols-outlined text-[18px]">verified_user</span>
</div>
<div>
<div className="font-headline-sm text-headline-sm font-semibold text-primary">412</div>
<div className="font-body-sm font-medium text-on-surface">Verified ID &amp; NDA</div>
<div className="font-body-sm text-on-surface-variant text-[11px] mt-0.5">36.7% qualification rate</div>
</div>
<div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{"width": "36.7%"}}></div>
</div>
</div>

<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-space-sm">
<div className="flex items-center justify-between text-secondary">
<span className="font-label-sm uppercase font-semibold">Stage 03</span>
<span className="material-symbols-outlined text-[18px]">sailing</span>
</div>
<div>
<div className="font-headline-sm text-headline-sm font-semibold text-primary">184</div>
<div className="font-body-sm font-medium text-on-surface">Official Sea Trial</div>
<div className="font-body-sm text-on-surface-variant text-[11px] mt-0.5">Surveyors &amp; Captain assigned</div>
</div>
<div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "44.6%"}}></div>
</div>
</div>

<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-space-sm">
<div className="flex items-center justify-between text-secondary">
<span className="font-label-sm uppercase font-semibold">Stage 04</span>
<span className="material-symbols-outlined text-[18px]">gavel</span>
</div>
<div>
<div className="font-headline-sm text-headline-sm font-semibold text-primary">86</div>
<div className="font-body-sm font-medium text-on-surface">MOA &amp; 10% Escrow</div>
<div className="font-body-sm text-on-surface-variant text-[11px] mt-0.5">Notarial custody deposits</div>
</div>
<div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "46.7%"}}></div>
</div>
</div>

<div className="bg-surface-container-high p-space-md rounded-lg flex flex-col justify-between gap-space-sm shadow-inner">
<div className="flex items-center justify-between text-primary">
<span className="font-label-sm uppercase font-bold text-secondary">Stage 05</span>
<span className="material-symbols-outlined text-[18px]">handshake</span>
</div>
<div>
<div className="font-headline-sm text-headline-sm font-bold text-primary">40</div>
<div className="font-body-sm font-bold text-primary">Closed &amp; Disbursed</div>
<div className="font-body-sm text-on-surface-variant text-[11px] mt-0.5">Title deed registered</div>
</div>
<div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
<div className="bg-primary-container h-full rounded-full" style={{"width": "46.5%"}}></div>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-md">
<div className="flex flex-col lg:flex-row gap-space-sm items-stretch lg:items-center justify-between">

<div className="relative flex-1">
<span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
<input className="w-full pl-11 pr-4 py-2.5 bg-surface-container-low rounded-lg font-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary transition-all shadow-inner" placeholder="Search by lead name, buyer email, target yacht, or assigned broker..." type="text"/>
</div>

<div className="flex flex-wrap items-center gap-space-sm">
<div className="relative min-w-[170px]">
<select className="w-full px-3 py-2.5 bg-surface-container-low font-body-sm text-on-surface rounded-lg appearance-none cursor-pointer focus:outline-none pr-8">
<option value="">Brokerage: All</option>
<option value="marina-balear">Marina Balear Yachting</option>
<option value="fraser-monaco">Fraser Monaco</option>
<option value="nautica-balear">Nautica Balear</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
</div>
<div className="relative min-w-[170px]">
<select className="w-full px-3 py-2.5 bg-surface-container-low font-body-sm text-on-surface rounded-lg appearance-none cursor-pointer focus:outline-none pr-8">
<option value="">Category: All</option>
<option value="superyachts">Superyachts &gt;30m</option>
<option value="sailing">Sailing Yachts</option>
<option value="motor">Motor Yachts</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
</div>
<div className="relative min-w-[170px]">
<select className="w-full px-3 py-2.5 bg-surface-container-low font-body-sm text-on-surface rounded-lg appearance-none cursor-pointer focus:outline-none pr-8">
<option value="">Source: All Channels</option>
<option value="portal">Web Portal Inquiry</option>
<option value="semantic">Semantic Search Match</option>
<option value="direct">Direct Broker Referral</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
</div>
<div className="relative min-w-[150px]">
<select className="w-full px-3 py-2.5 bg-surface-container-low font-body-sm text-on-surface rounded-lg appearance-none cursor-pointer focus:outline-none pr-8">
<option value="">Status: All Health</option>
<option value="healthy">Healthy SLA</option>
<option value="pending">Pending Follow-up</option>
<option value="stalled">Stalled / At-Risk</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
</div>
<button className="p-2.5 bg-surface-container-low hover:bg-surface-container-high text-primary rounded-lg transition-colors flex items-center justify-center" type="button">
<span className="material-symbols-outlined text-[20px]">refresh</span>
</button>
</div>
</div>

<div className="flex flex-wrap items-center gap-2 pt-1">
<span className="font-label-sm uppercase text-on-surface-variant mr-1">Active Filters:</span>
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-high rounded-full font-label-md text-primary">
<span>Territory: Western Mediterranean</span>
<button className="material-symbols-outlined text-[14px] text-on-surface-variant hover:text-primary" type="button">close</button>
</span>
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-high rounded-full font-label-md text-primary">
<span>Minimum Vessel Price: &gt;€1,000,000</span>
<button className="material-symbols-outlined text-[14px] text-on-surface-variant hover:text-primary" type="button">close</button>
</span>
<button className="font-label-sm text-secondary hover:underline font-semibold ml-2" type="button">Clear all</button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
<div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="font-title-md text-title-md text-primary">Audited High-Intent Pipeline</span>
<span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary font-label-sm">5 Flagged Records</span>
</div>
<div className="font-body-sm text-on-surface-variant">
          Showing 5 of 1,842 total leads under active staff surveillance
        </div>
</div>

<div className="overflow-x-auto w-full">
<table className="w-full text-left font-body-sm text-on-surface">
<thead className="bg-surface-container font-label-sm text-on-surface-variant uppercase tracking-wider">
<tr>
<th className="py-3.5 px-4 font-semibold" scope="col">Lead &amp; Contact</th>
<th className="py-3.5 px-4 font-semibold" scope="col">Target Vessel &amp; Value</th>
<th className="py-3.5 px-4 font-semibold" scope="col">Assigned Broker / Agency</th>
<th className="py-3.5 px-4 font-semibold" scope="col">Lead Intent &amp; KYC Status</th>
<th className="py-3.5 px-4 font-semibold" scope="col">Last Touchpoint &amp; SLA</th>
<th className="py-3.5 px-4 font-semibold" scope="col">Pipeline Stage</th>
<th className="py-3.5 px-4 font-semibold text-right" scope="col">Staff Supervision Controls</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container-low">

<tr className="hover:bg-surface-container-low transition-colors">
<td className="py-4 px-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-body-md shrink-0">
                    AV
                  </div>
<div className="flex flex-col min-w-0">
<span className="font-semibold text-primary truncate">Lord Alistair Vance</span>
<span className="text-[12px] text-on-surface-variant">London, UK • Monaco</span>
<span className="font-label-sm text-secondary font-semibold">a.vance@vance-holdings.co.uk</span>
</div>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-semibold text-primary">Sanlorenzo SL88</span>
<span className="font-spec-num text-spec-num font-bold text-secondary">€4,650,000</span>
<span className="text-[11px] text-on-surface-variant">2019 • 26.8m • Palma</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-medium text-primary">Marina Balear Yachting</span>
<span className="text-[12px] text-on-surface-variant">Luc Fournier (Senior Partner)</span>
<span className="font-label-sm text-secondary">Commission Share: 50%</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary px-2 py-0.5 rounded bg-secondary-container/30 w-fit">
<span className="material-symbols-outlined text-[13px]">verified</span>
                    KYC Level 2 Approved
                  </span>
<span className="text-[11px] text-on-surface-variant font-medium">Proof of Funds: €5.2M Verified</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-medium text-primary">42 min ago</span>
<span className="text-[11px] text-on-surface-variant">Sea Trial Friday 10:00 CEST</span>
<span className="font-label-sm text-secondary flex items-center gap-0.5 mt-0.5">
<span className="material-symbols-outlined text-[12px]">check_circle</span> SLA Perfect (18m response)
                  </span>
</div>
</td>
<td className="py-4 px-4">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container font-label-md font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Sea Trial / Survey
                </span>
</td>
<td className="py-4 px-4 text-right">
<div className="inline-flex items-center gap-1.5">
<button className="px-2.5 py-1 bg-surface-container text-primary hover:bg-surface-container-high rounded text-body-sm font-medium transition-colors" type="button">
                    Audit Dossier
                  </button>
<button className="p-1 text-on-surface-variant hover:text-primary rounded" title="View Escrow Vault" type="button">
<span className="material-symbols-outlined text-[18px]">lock_open</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low transition-colors">
<td className="py-4 px-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-body-md shrink-0">
                    MC
                  </div>
<div className="flex flex-col min-w-0">
<span className="font-semibold text-primary truncate">Mateo Cardoso</span>
<span className="text-[12px] text-on-surface-variant">Madrid, ES • Cascais, PT</span>
<span className="font-label-sm text-secondary font-semibold">mateo.cardoso@iberequity.es</span>
</div>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-semibold text-primary">Custom Line 106</span>
<span className="font-spec-num text-spec-num font-bold text-secondary">€9,800,000</span>
<span className="text-[11px] text-on-surface-variant">2022 • 32.8m • Ibiza Marina</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-medium text-primary">Marina Balear Yachting</span>
<span className="text-[12px] text-on-surface-variant">Luc Fournier (Senior Partner)</span>
<span className="font-label-sm text-secondary">Notary Assigned: Palma Notaria 3</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary px-2 py-0.5 rounded bg-surface-container-high w-fit">
<span className="material-symbols-outlined text-[13px]">contract</span>
                    NDA Signed
                  </span>
<span className="text-[11px] text-on-surface-variant font-medium">Santander PB Wire Verified</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-medium text-primary">3 hours ago</span>
<span className="text-[11px] text-on-surface-variant">Awaiting Bilateral MOA Draft</span>
<span className="font-label-sm text-secondary flex items-center gap-0.5 mt-0.5">
<span className="material-symbols-outlined text-[12px]">schedule</span> SLA On Track
                  </span>
</div>
</td>
<td className="py-4 px-4">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed/50 text-primary font-label-md font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Escrow Deposit Prep
                </span>
</td>
<td className="py-4 px-4 text-right">
<div className="inline-flex items-center gap-1.5">
<button className="px-2.5 py-1 bg-primary text-on-primary hover:bg-primary-container rounded text-body-sm font-medium transition-colors" type="button">
                    Expedite Notary
                  </button>
<button className="p-1 text-on-surface-variant hover:text-primary rounded" title="View Details" type="button">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low transition-colors">
<td className="py-4 px-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-surface-container-highest text-primary flex items-center justify-center font-bold text-body-md shrink-0">
                    MW
                  </div>
<div className="flex flex-col min-w-0">
<span className="font-semibold text-primary truncate">Dr. Markus Weber</span>
<span className="text-[12px] text-on-surface-variant">Munich, DE • Palma</span>
<span className="font-label-sm text-secondary font-semibold">markus@weber-klinik.de</span>
</div>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-semibold text-primary">Benetti Oasis 40M</span>
<span className="font-spec-num text-spec-num font-bold text-secondary">€14,800,000</span>
<span className="text-[11px] text-on-surface-variant">2021 • 40.8m • Port Adriano</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-medium text-primary">Marina Balear Yachting</span>
<span className="text-[12px] text-on-surface-variant">Elena Soler (Yacht Consultant)</span>
<span className="font-label-sm text-secondary">Lead Origin: Semantic VIP Search</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary px-2 py-0.5 rounded bg-secondary-container/30 w-fit">
<span className="material-symbols-outlined text-[13px]">verified</span>
                    High-Intent Verified Buyer
                  </span>
<span className="text-[11px] text-on-surface-variant font-medium">BaFin Tax ID Confirmed</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-medium text-primary">1 day ago</span>
<span className="text-[11px] text-on-surface-variant">Surveyor RINA report pending</span>
<span className="font-label-sm text-secondary flex items-center gap-0.5 mt-0.5">
<span className="material-symbols-outlined text-[12px]">check</span> SLA Compliant
                  </span>
</div>
</td>
<td className="py-4 px-4">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-md font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
                  10% Escrow in Custody
                </span>
</td>
<td className="py-4 px-4 text-right">
<div className="inline-flex items-center gap-1.5">
<button className="px-2.5 py-1 bg-surface-container text-primary hover:bg-surface-container-high rounded text-body-sm font-medium transition-colors" type="button">
                    View Escrow Receipt
                  </button>
<button className="p-1 text-on-surface-variant hover:text-primary rounded" title="View Dossier" type="button">
<span className="material-symbols-outlined text-[18px]">visibility</span>
</button>
</div>
</td>
</tr>

<tr className="bg-error-container/10 hover:bg-error-container/20 transition-colors">
<td className="py-4 px-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-error text-on-error flex items-center justify-center font-bold text-body-md shrink-0">
                    GL
                  </div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-1.5">
<span className="font-semibold text-primary truncate">Guillaume Laurent</span>
<span className="w-2 h-2 rounded-full bg-error" title="Urgent SLA Attention"></span>
</div>
<span className="text-[12px] text-on-surface-variant">Geneva, CH</span>
<span className="font-label-sm text-secondary font-semibold">g.laurent@lac-leman-am.ch</span>
</div>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-semibold text-primary">Princess Y85</span>
<span className="font-spec-num text-spec-num font-bold text-secondary">€5,400,000</span>
<span className="text-[11px] text-on-surface-variant">2023 • 26.2m • Cannes Marina</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-medium text-primary">Fraser Yachts Monaco</span>
<span className="text-[12px] text-error font-medium">Unassigned Representative</span>
<span className="font-label-sm text-error">Broker Contact Overdue</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant px-2 py-0.5 rounded bg-surface-container-high w-fit">
<span className="material-symbols-outlined text-[13px]">hourglass_empty</span>
                    KYC Pending Submission
                  </span>
<span className="text-[11px] text-on-surface-variant">Inquiry submitted via iPad App</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-bold text-error">5 hours ago</span>
<span className="text-[11px] text-error font-semibold">Unattended — SLA Breach in 1 hr</span>
<span className="font-label-sm text-on-surface-variant mt-0.5">Staff Alert Sent (09:30 CEST)</span>
</div>
</td>
<td className="py-4 px-4">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface font-label-md font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                  Initial Inquiry
                </span>
</td>
<td className="py-4 px-4 text-right">
<div className="inline-flex items-center gap-1.5">
<button className="px-2.5 py-1 bg-error text-on-error hover:bg-error/90 rounded text-body-sm font-medium transition-colors shadow-sm" type="button">
                    Reassign Lead
                  </button>
<button className="px-2.5 py-1 bg-surface-container-high text-primary hover:bg-surface-container-highest rounded text-body-sm font-medium transition-colors" type="button">
                    Nudge Broker
                  </button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low transition-colors">
<td className="py-4 px-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-body-md shrink-0">
                    RB
                  </div>
<div className="flex flex-col min-w-0">
<span className="font-semibold text-primary truncate">Avv. Roberto Benigni</span>
<span className="text-[12px] text-on-surface-variant">Milan, IT • Portofino</span>
<span className="font-label-sm text-secondary font-semibold">roberto.benigni@studiolegale.it</span>
</div>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-semibold text-primary">Nautor Swan 54</span>
<span className="font-spec-num text-spec-num font-bold text-secondary">€1,280,000</span>
<span className="text-[11px] text-on-surface-variant">2018 • 16.5m • Genoa Marina</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-medium text-primary">Marina Balear Yachting</span>
<span className="text-[12px] text-on-surface-variant">Marco Bellini (Italian Desk)</span>
<span className="font-label-sm text-secondary">Language: Italian (Native)</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary px-2 py-0.5 rounded bg-secondary-container/30 w-fit">
<span className="material-symbols-outlined text-[13px]">check_circle</span>
                    Italian Codice Fiscale Verified
                  </span>
<span className="text-[11px] text-on-surface-variant font-medium">Banca Intesa Bank Guarantee</span>
</div>
</td>
<td className="py-4 px-4">
<div className="flex flex-col">
<span className="font-medium text-primary">Yesterday</span>
<span className="text-[11px] text-on-surface-variant">Ultrasonic hull testing scheduled</span>
<span className="font-label-sm text-secondary flex items-center gap-0.5 mt-0.5">
<span className="material-symbols-outlined text-[12px]">thumb_up</span> Client Satisfied
                  </span>
</div>
</td>
<td className="py-4 px-4">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container font-label-md font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  Sea Trial / Survey
                </span>
</td>
<td className="py-4 px-4 text-right">
<div className="inline-flex items-center gap-1.5">
<button className="px-2.5 py-1 bg-surface-container text-primary hover:bg-surface-container-high rounded text-body-sm font-medium transition-colors" type="button">
                    View RINA Log
                  </button>
<button className="p-1 text-on-surface-variant hover:text-primary rounded" title="View Dossier" type="button">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
</td>
</tr>
</tbody>
</table>
</div>

<div className="px-space-lg py-space-sm bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm">
<span className="text-body-sm text-on-surface-variant">
          Displaying Page 1 of 368 pages • Audit ledger updated 4 seconds ago
        </span>
<div className="inline-flex items-center gap-1 font-body-sm">
<button className="px-3 py-1 rounded bg-surface-container text-on-surface-variant cursor-not-allowed" disabled type="button">Previous</button>
<button className="px-3 py-1 rounded bg-primary text-on-primary font-semibold" type="button">1</button>
<button className="px-3 py-1 rounded bg-surface-container-lowest text-primary hover:bg-surface-container-high" type="button">2</button>
<button className="px-3 py-1 rounded bg-surface-container-lowest text-primary hover:bg-surface-container-high" type="button">3</button>
<span className="px-1 text-on-surface-variant">...</span>
<button className="px-3 py-1 rounded bg-surface-container-lowest text-primary hover:bg-surface-container-high" type="button">368</button>
<button className="px-3 py-1 rounded bg-surface-container-lowest text-primary hover:bg-surface-container-high" type="button">Next</button>
</div>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">

<div className="lg:col-span-2 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div>
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase tracking-wider text-secondary">SLA Velocity Benchmark</span>
<span className="font-label-md text-on-surface-variant">Top Mediterranean Central Agencies</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mt-1">Agency Inbound Response &amp; Escrow Conversion Rates</h3>
<p className="font-body-sm text-on-surface-variant mt-1">Real-time metrics measuring speed-to-first-touch, certified multilingual follow-up, and notarial contract completion.</p>
</div>
<div className="flex flex-col gap-space-md pt-space-xs">

<div className="flex flex-col gap-1.5">
<div className="flex items-center justify-between text-body-sm">
<div className="flex items-center gap-2">
<span className="font-semibold text-primary">Marina Balear Yachting (Palma &amp; Ibiza)</span>
<span className="px-1.5 py-0.5 rounded bg-secondary-container/40 text-secondary text-[11px] font-bold">Top Performer</span>
</div>
<div className="flex items-center gap-4 text-on-surface-variant font-spec-num">
<span>Avg: 1.2 hrs</span>
<span className="font-semibold text-primary">98.4% SLA Score</span>
</div>
</div>
<div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "98.4%"}}></div>
</div>
</div>

<div className="flex flex-col gap-1.5">
<div className="flex items-center justify-between text-body-sm">
<div className="flex items-center gap-2">
<span className="font-semibold text-primary">Fraser Yachts Monaco</span>
<span className="px-1.5 py-0.5 rounded bg-error-container text-error text-[11px] font-bold">Action Required</span>
</div>
<div className="flex items-center gap-4 text-on-surface-variant font-spec-num">
<span>Avg: 4.8 hrs</span>
<span className="font-semibold text-error">78.2% SLA Score</span>
</div>
</div>
<div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
<div className="bg-error h-full rounded-full" style={{"width": "78.2%"}}></div>
</div>
</div>

<div className="flex flex-col gap-1.5">
<div className="flex items-center justify-between text-body-sm">
<div className="flex items-center gap-2">
<span className="font-semibold text-primary">Nautica Balear Port Adriano</span>
<span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary text-[11px] font-bold">Compliant</span>
</div>
<div className="flex items-center gap-4 text-on-surface-variant font-spec-num">
<span>Avg: 2.1 hrs</span>
<span className="font-semibold text-primary">91.6% SLA Score</span>
</div>
</div>
<div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{"width": "91.6%"}}></div>
</div>
</div>

<div className="flex flex-col gap-1.5">
<div className="flex items-center justify-between text-body-sm">
<div className="flex items-center gap-2">
<span className="font-semibold text-primary">Sanlorenzo Côte d&apos;Azur (Antibes)</span>
<span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary text-[11px] font-bold">Compliant</span>
</div>
<div className="flex items-center gap-4 text-on-surface-variant font-spec-num">
<span>Avg: 2.4 hrs</span>
<span className="font-semibold text-primary">89.0% SLA Score</span>
</div>
</div>
<div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{"width": "89%"}}></div>
</div>
</div>
</div>
<div className="pt-space-xs flex items-center justify-between border-t border-surface-container-high text-body-sm text-on-surface-variant">
<span>Automated penalty threshold kicks in at &lt;80% SLA rate over 14 rolling calendar days.</span>
<Link href="#" className="text-secondary hover:underline font-semibold flex items-center gap-1" >
<span>Download Detailed SLA Audit</span>
<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</Link>
</div>
</div>

<div className="bg-primary text-on-primary p-space-lg rounded-xl shadow-md flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<div className="inline-flex items-center gap-1.5 text-secondary-fixed font-label-sm uppercase tracking-wider">
<span className="material-symbols-outlined text-[16px]">bolt</span>
<span>Automated Matchmaking Dispatch</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-primary">Nauta Escrow Protection Engine</h3>
<p className="font-body-sm text-surface-container-highest leading-relaxed mt-1">
            Ensure high-value maritime leads receive immediate notary-verified escrow covenants. All transactions over €1M trigger mandatory bilingual documentation in English, Spanish, and Italian.
          </p>
</div>
<div className="bg-primary-container p-space-md rounded-lg flex flex-col gap-space-xs text-body-sm">
<div className="flex items-center justify-between text-surface-bright font-medium">
<span>Active Automated Rules</span>
<span className="font-bold text-secondary-fixed">4 Online</span>
</div>
<p className="text-[12px] text-surface-container-high">
            Leads unanswered after 4 hours are auto-escalated to Nauta Concierge Broker Desk for instant buyer outreach.
          </p>
</div>
<div className="flex flex-col gap-space-xs">
<button className="w-full py-2.5 bg-secondary hover:bg-secondary/90 text-on-secondary font-body-md font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2" type="button">
<span className="material-symbols-outlined text-[18px]">verified</span>
<span>Force Run Lead Reconciliation</span>
</button>
<span className="text-center font-label-sm text-surface-container-high">Next scheduled sync in 08m 42s</span>
</div>
</div>
</div>
</div>
</div>
      </RequirePermission>
    </main>
  );
}
