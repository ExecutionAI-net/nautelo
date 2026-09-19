import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function BrokerLeads() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<div className="w-full bg-primary text-on-primary py-space-xs px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-space-sm font-label-sm text-label-sm uppercase tracking-wider">
<div className="flex items-center gap-space-sm">
<span className="inline-block w-2 h-2 rounded-full bg-secondary-fixed"></span>
<span>Prototype Mode: Yacht Broker Seller</span>
<span className="text-on-primary-container">/</span>
<span className="text-secondary-fixed-dim">Marina Balear Yachting (STP Palma)</span>
</div>
<div className="flex items-center gap-space-md">
<Link href="#" className="text-on-primary-container hover:text-on-primary transition-colors flex items-center gap-1" >
<span className="material-symbols-outlined text-[14px]">swap_horiz</span> Switch Demo Role
        </Link>
<span className="text-on-primary-container">·</span>
<Link href="#" className="text-on-primary-container hover:text-on-primary transition-colors flex items-center gap-1" >
<span className="material-symbols-outlined text-[14px]">logout</span> Log Out
        </Link>
</div>
</div>
</div>

<div className="max-w-[1440px] w-full mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-lg md:py-space-xl flex flex-col gap-space-xl">

<div className="flex flex-col gap-space-md">
<div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pb-space-sm">
<div>
<div className="flex items-center gap-space-xs text-on-surface-variant font-label-md text-label-md uppercase tracking-wider mb-space-xs">
<span>Brokerage CRM</span>
<span>/</span>
<span className="text-secondary font-semibold">Deal Flow &amp; Mandates</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Leads &amp; Commercial Pipeline</h1>
</div>

<div className="flex items-center gap-space-md bg-surface-container-lowest p-space-sm rounded-xl shadow-sm">
<div className="px-space-md py-space-xs">
<span className="block font-label-sm text-label-sm uppercase text-on-surface-variant">Active Pipeline Value</span>
<span className="font-spec-num text-spec-num font-bold text-primary">€42,850,000</span>
</div>
<div className="h-8 w-px bg-surface-container-high"></div>
<div className="px-space-md py-space-xs">
<span className="block font-label-sm text-label-sm uppercase text-on-surface-variant">Active Escrow</span>
<span className="font-spec-num text-spec-num font-bold text-secondary">€2,945,000</span>
</div>
<button className="bg-primary hover:bg-primary-container text-on-primary px-space-md py-space-sm rounded-lg font-title-md text-title-md inline-flex items-center gap-space-xs shadow-sm transition-all" id="quick-new-lead-btn">
<span className="material-symbols-outlined text-[18px]">add</span>
<span>New Lead</span>
</button>
</div>
</div>

<div className="flex items-center gap-space-xs overflow-x-auto pb-space-xs scrollbar-none bg-surface-container-low p-1.5 rounded-xl">
<Link href="#" className="px-space-md py-space-xs rounded-lg font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" >
          Overview
        </Link>
<Link href="#" className="px-space-md py-space-xs rounded-lg font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" >
          Fleet
        </Link>
<Link href="#" className="px-space-md py-space-xs rounded-lg font-title-md text-title-md bg-surface-container-lowest text-primary font-semibold shadow-sm whitespace-nowrap flex items-center gap-2" >
<span>Leads</span>
<span className="px-1.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-label-sm font-label-sm">22</span>
</Link>
<Link href="#" className="px-space-md py-space-xs rounded-lg font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" >
          Team
        </Link>
<Link href="/services/professionals/" className="px-space-md py-space-xs rounded-lg font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" >
          Services
        </Link>
<Link href="#" className="px-space-md py-space-xs rounded-lg font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" >
          Company Profile
        </Link>
<Link href="#" className="px-space-md py-space-xs rounded-lg font-title-md text-title-md text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" >
          Subscription
        </Link>
</div>
</div>

<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
<div className="flex items-center gap-space-sm flex-1 max-w-lg">
<div className="relative w-full">
<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
<input className="w-full pl-10 pr-4 py-2 bg-surface-container-low rounded-lg text-on-surface font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest transition-all" placeholder="Filter by vessel model, client name, tax residency or STP berth..." type="text"/>
</div>
<div className="relative">
<button className="px-3 py-2 bg-surface-container-low text-on-surface-variant hover:text-primary rounded-lg font-body-md text-body-md inline-flex items-center gap-1.5 shrink-0">
<span className="material-symbols-outlined text-[18px]">tune</span>
<span className="hidden md:inline">Brokers: All</span>
</button>
</div>
</div>

<div className="flex items-center gap-space-md shrink-0 justify-between sm:justify-end">
<div className="hidden lg:flex items-center gap-2 px-space-sm py-1 bg-surface-container-low rounded-lg">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-label-sm text-on-surface-variant">STP Palma Berth Access Valid</span>
</div>
<div className="inline-flex p-1 bg-surface-container-low rounded-lg">
<button className="px-space-md py-1 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md shadow-sm inline-flex items-center gap-1.5" id="btn-view-kanban">
<span className="material-symbols-outlined text-[16px]">view_kanban</span>
<span>Kanban</span>
</button>
<button className="px-space-md py-1 rounded-lg text-on-surface-variant hover:text-primary font-label-md text-label-md inline-flex items-center gap-1.5 transition-colors" id="btn-view-list">
<span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
<span>List</span>
</button>
</div>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-space-md overflow-x-auto pb-space-lg items-start" id="kanban-view">

<div className="bg-surface-container-low rounded-xl p-space-sm flex flex-col gap-space-sm min-w-[280px]">
<div className="flex items-center justify-between px-space-xs py-1">
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-outline"></span>
<h3 className="font-title-md text-title-md text-primary">New Inquiries</h3>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-semibold">5</span>
</div>
<div className="text-on-surface-variant font-label-sm text-label-sm px-space-xs">Total potential: €16.4M</div>

<div className="flex flex-col gap-space-sm mt-space-xs">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5">
<div className="flex items-center justify-between mb-space-xs">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Web Portal</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">2h ago</span>
</div>
<h4 className="font-title-lg text-title-lg text-primary">Guillaume Laurent</h4>
<div className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">Geneva, CH · Private Family Office</div>
<div className="bg-surface-container-low p-2 rounded-lg mb-space-sm">
<div className="font-spec-num text-spec-num font-semibold text-primary">Princess Y85 (2022)</div>
<div className="font-label-sm text-label-sm text-on-surface-variant">Asking: €5,400,000</div>
</div>
<div className="flex items-center justify-between pt-space-xs">
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
<span className="material-symbols-outlined text-[14px]">flag</span> KYC Pending
              </span>
<span className="font-label-sm text-label-sm text-primary font-medium">Luc F.</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5">
<div className="flex items-center justify-between mb-space-xs">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Direct Referral</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">5h ago</span>
</div>
<h4 className="font-title-lg text-title-lg text-primary">Helena von Berg</h4>
<div className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">Hamburg / Ibiza · Skipper Direct</div>
<div className="bg-surface-container-low p-2 rounded-lg mb-space-sm">
<div className="font-spec-num text-spec-num font-semibold text-primary">Solaris 50 (2021)</div>
<div className="font-label-sm text-label-sm text-on-surface-variant">Asking: €920,000</div>
</div>
<div className="flex items-center justify-between pt-space-xs">
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary bg-secondary-fixed/30 px-2 py-0.5 rounded-full">
<span className="material-symbols-outlined text-[14px]">call</span> Needs Follow-up
              </span>
<span className="font-label-sm text-label-sm text-primary font-medium">Elena S.</span>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-low rounded-xl p-space-sm flex flex-col gap-space-sm min-w-[280px]">
<div className="flex items-center justify-between px-space-xs py-1">
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-surface-tint"></span>
<h3 className="font-title-md text-title-md text-primary">Qualified / NDA</h3>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-semibold">4</span>
</div>
<div className="text-on-surface-variant font-label-sm text-label-sm px-space-xs">Total potential: €11.2M</div>

<div className="flex flex-col gap-space-sm mt-space-xs">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5">
<div className="flex items-center justify-between mb-space-xs">
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded">
<span className="material-symbols-outlined text-[13px]">verified_user</span> NDA Signed
              </span>
<span className="font-label-sm text-label-sm text-on-surface-variant">1d ago</span>
</div>
<h4 className="font-title-lg text-title-lg text-primary">Mateo Cardoso</h4>
<div className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">Madrid / Cascais · Private UHNW</div>
<div className="bg-surface-container-low p-2 rounded-lg mb-space-sm">
<div className="font-spec-num text-spec-num font-semibold text-primary">Custom Line 106</div>
<div className="font-label-sm text-label-sm text-on-surface-variant">Target: €9,800,000</div>
</div>
<div className="flex items-center justify-between pt-space-xs">
<span className="font-label-sm text-label-sm text-on-surface-variant">Proof of Funds: Santander PB</span>
<span className="font-label-sm text-label-sm text-primary font-medium">Luc F.</span>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-low rounded-xl p-space-sm flex flex-col gap-space-sm min-w-[280px]">
<div className="flex items-center justify-between px-space-xs py-1">
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<h3 className="font-title-md text-title-md text-primary">Sea Trial / Survey</h3>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-semibold">3</span>
</div>
<div className="text-on-surface-variant font-label-sm text-label-sm px-space-xs">Inspection Phase: STP Palma</div>
<div className="flex flex-col gap-space-sm mt-space-xs">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-md cursor-pointer transition-all hover:-translate-y-1 relative overflow-hidden group">
<div className="absolute top-0 left-0 w-1.5 h-full bg-secondary"></div>
<div className="flex items-center justify-between mb-space-xs">
<span className="font-label-sm text-label-sm font-semibold tracking-wider text-secondary uppercase">High Priority Deal</span>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-semibold">Fri 10:00</span>
</div>
<h4 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">Lord Alistair Vance</h4>
<div className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">London, UK / Monaco · Vance Maritime Trust</div>
<div className="bg-surface-container-low p-space-sm rounded-lg mb-space-sm">
<div className="flex justify-between items-baseline mb-0.5">
<span className="font-title-md text-title-md text-primary font-semibold">Sanlorenzo SL88</span>
<span className="font-spec-num text-spec-num font-bold text-primary">€4,650,000</span>
</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">2018 · 26.8m · 2x MTU 2000hp</div>
</div>

<div className="flex items-center gap-2 p-2 rounded-lg bg-surface-container text-primary font-label-sm text-label-sm mb-space-sm">
<span className="material-symbols-outlined text-[16px] text-secondary">sailing</span>
<span>Sea Trial: Friday at STP Palma Berth 42</span>
</div>
<div className="flex items-center justify-between pt-space-xs">
<div className="flex items-center gap-1.5">
<div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-sm text-[10px]">LF</div>
<span className="font-label-sm text-label-sm text-on-surface font-medium">Luc Fournier</span>
</div>
<span className="font-label-sm text-label-sm text-secondary font-semibold">KYC Level 2 ✓</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-md cursor-pointer transition-all hover:-translate-y-1 relative overflow-hidden group">
<div className="absolute top-0 left-0 w-1.5 h-full bg-surface-tint"></div>
<div className="flex items-center justify-between mb-space-xs">
<span className="font-label-sm text-label-sm font-semibold tracking-wider text-surface-tint uppercase">Survey Active</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Today</span>
</div>
<h4 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">Avv. Roberto Benigni</h4>
<div className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">Milan, IT · Benigni &amp; Partners Nautical</div>
<div className="bg-surface-container-low p-space-sm rounded-lg mb-space-sm">
<div className="flex justify-between items-baseline mb-0.5">
<span className="font-title-md text-title-md text-primary font-semibold">Nautor Swan 54</span>
<span className="font-spec-num text-spec-num font-bold text-primary">€1,280,000</span>
</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">2019 · 16.5m · Yanmar 110hp</div>
</div>

<div className="p-2 rounded-lg bg-surface-container text-primary font-label-sm text-label-sm mb-space-sm flex flex-col gap-1">
<div className="flex justify-between text-on-surface-variant">
<span>RINA Hull &amp; Engine Audit</span>
<span className="font-semibold text-secondary">65% Done</span>
</div>
<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full w-[65%]"></div>
</div>
</div>
<div className="flex items-center justify-between pt-space-xs">
<div className="flex items-center gap-1.5">
<div className="w-6 h-6 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-sm text-[10px]">MB</div>
<span className="font-label-sm text-label-sm text-on-surface font-medium">Marco B.</span>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant">Surveyor: Ing. R. Valli</span>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-low rounded-xl p-space-sm flex flex-col gap-space-sm min-w-[280px]">
<div className="flex items-center justify-between px-space-xs py-1">
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span>
<h3 className="font-title-md text-title-md text-primary">Escrow Deposit Held</h3>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-semibold">2</span>
</div>
<div className="text-on-surface-variant font-label-sm text-label-sm px-space-xs">Escrow Secured: €1.88M</div>
<div className="flex flex-col gap-space-sm mt-space-xs">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-md cursor-pointer transition-all hover:-translate-y-1 relative overflow-hidden group">
<div className="absolute top-0 left-0 w-1.5 h-full bg-tertiary-container"></div>
<div className="flex items-center justify-between mb-space-xs">
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-tertiary-fixed-variant bg-tertiary-fixed/60 px-2 py-0.5 rounded font-semibold">
<span className="material-symbols-outlined text-[13px]">account_balance</span> 10% Escrow In Bank
              </span>
<span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">Closing Nov 14</span>
</div>
<h4 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">Dr. Markus Weber</h4>
<div className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">Munich / Palma · Weber MedTech AG</div>
<div className="bg-surface-container-low p-space-sm rounded-lg mb-space-sm">
<div className="flex justify-between items-baseline mb-0.5">
<span className="font-title-md text-title-md text-primary font-semibold">Benetti Oasis 40M</span>
<span className="font-spec-num text-spec-num font-bold text-primary">€14,800,000</span>
</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">2023 · 40.8m · Tri-deck Displacement</div>
</div>

<div className="p-2.5 rounded-lg bg-surface-container text-primary font-label-sm text-label-sm mb-space-sm">
<div className="flex justify-between items-center mb-1">
<span className="text-on-surface-variant">Deposit Amount</span>
<span className="font-spec-num text-spec-num font-bold text-secondary">€1,480,000</span>
</div>
<div className="text-on-surface-variant text-[11px]">Held at Santander Corporate ESC-ES-9921</div>
</div>
<div className="flex items-center justify-between pt-space-xs">
<div className="flex items-center gap-1.5">
<div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-sm text-[10px]">LF</div>
<span className="font-label-sm text-label-sm text-on-surface font-medium">Luc Fournier</span>
</div>
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary font-semibold">
<span className="material-symbols-outlined text-[14px]">gavel</span> Legal Draft Ready
              </span>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-low rounded-xl p-space-sm flex flex-col gap-space-sm min-w-[280px]">
<div className="flex items-center justify-between px-space-xs py-1">
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-secondary-fixed-dim"></span>
<h3 className="font-title-md text-title-md text-primary">Closed / Disbursed</h3>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-semibold">8</span>
</div>
<div className="text-on-surface-variant font-label-sm text-label-sm px-space-xs">YTD Commission: €924,000</div>
<div className="flex flex-col gap-space-sm mt-space-xs">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5 opacity-90 hover:opacity-100">
<div className="flex items-center justify-between mb-space-xs">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">Commission Paid</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">3d ago</span>
</div>
<h4 className="font-title-lg text-title-lg text-primary">Captain Lars Lindqvist</h4>
<div className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">Stockholm, SE · For North Seas LLC</div>
<div className="bg-surface-container-low p-2 rounded-lg mb-space-sm">
<div className="font-spec-num text-spec-num font-semibold text-primary">Ferretti 720</div>
<div className="font-label-sm text-label-sm text-secondary font-medium">Sold: €2,750,000 (5% Net Comm)</div>
</div>
<div className="flex items-center justify-between pt-space-xs">
<span className="font-label-sm text-label-sm text-on-surface-variant">Delivery: Port Adriano</span>
<span className="font-label-sm text-label-sm text-primary font-medium">Elena S.</span>
</div>
</div>
</div>
</div>
</div>

<div className="hidden bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden" id="list-view">
<div className="overflow-x-auto">
<table className="w-full text-left">
<thead className="bg-surface-container-low text-on-surface-variant font-label-md text-label-md uppercase tracking-wider">
<tr>
<th className="px-space-md py-space-sm">Client / Entity</th>
<th className="px-space-md py-space-sm">Vessel Interest</th>
<th className="px-space-md py-space-sm">Stage</th>
<th className="px-space-md py-space-sm">Valuation / Asking</th>
<th className="px-space-md py-space-sm">Assigned Broker</th>
<th className="px-space-md py-space-sm">Next Action</th>
<th className="px-space-md py-space-sm text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container-high font-body-md text-body-md">
<tr className="hover:bg-surface-container-low/50 cursor-pointer transition-colors">
<td className="px-space-md py-space-md">
<div className="font-title-md text-title-md text-primary font-semibold">Lord Alistair Vance</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">London, UK / Monaco</div>
</td>
<td className="px-space-md py-space-md">
<div className="font-medium text-primary">Sanlorenzo SL88 (2018)</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">STP Palma Berth 42</div>
</td>
<td className="px-space-md py-space-md">
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary bg-secondary-fixed/40 px-2.5 py-1 rounded-full font-semibold">
                  Sea Trial Scheduled
                </span>
</td>
<td className="px-space-md py-space-md font-spec-num text-spec-num font-semibold text-primary">€4,650,000</td>
<td className="px-space-md py-space-md">Luc Fournier</td>
<td className="px-space-md py-space-md text-error font-medium font-body-sm text-body-sm">Trial Friday 10:00</td>
<td className="px-space-md py-space-md text-right">
<button className="text-secondary hover:text-primary font-label-md text-label-md font-semibold">View Details</button>
</td>
</tr>
<tr className="hover:bg-surface-container-low/50 cursor-pointer transition-colors">
<td className="px-space-md py-space-md">
<div className="font-title-md text-title-md text-primary font-semibold">Avv. Roberto Benigni</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">Milan, IT</div>
</td>
<td className="px-space-md py-space-md">
<div className="font-medium text-primary">Swan 54 (2019)</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">Yanmar 110hp</div>
</td>
<td className="px-space-md py-space-md">
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-surface-tint bg-surface-container-high px-2.5 py-1 rounded-full font-semibold">
                  Survey &amp; Engine Audit
                </span>
</td>
<td className="px-space-md py-space-md font-spec-num text-spec-num font-semibold text-primary">€1,280,000</td>
<td className="px-space-md py-space-md">Marco B.</td>
<td className="px-space-md py-space-md text-on-surface-variant font-body-sm text-body-sm">RINA Surveyor report due</td>
<td className="px-space-md py-space-md text-right">
<button className="text-secondary hover:text-primary font-label-md text-label-md font-semibold">View Details</button>
</td>
</tr>
<tr className="hover:bg-surface-container-low/50 cursor-pointer transition-colors">
<td className="px-space-md py-space-md">
<div className="font-title-md text-title-md text-primary font-semibold">Dr. Markus Weber</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">Munich / Palma</div>
</td>
<td className="px-space-md py-space-md">
<div className="font-medium text-primary">Benetti Oasis 40M (2023)</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">Tri-deck Displacement</div>
</td>
<td className="px-space-md py-space-md">
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-tertiary-fixed-variant bg-tertiary-fixed/60 px-2.5 py-1 rounded-full font-semibold">
                  10% Escrow Verified
                </span>
</td>
<td className="px-space-md py-space-md font-spec-num text-spec-num font-semibold text-primary">€14,800,000</td>
<td className="px-space-md py-space-md">Luc Fournier</td>
<td className="px-space-md py-space-md text-secondary font-medium font-body-sm text-body-sm">Final Bill of Sale Drafting</td>
<td className="px-space-md py-space-md text-right">
<button className="text-secondary hover:text-primary font-label-md text-label-md font-semibold">View Details</button>
</td>
</tr>
</tbody>
</table>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">
<div className="lg:col-span-2 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="flex items-center gap-space-xs font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider mb-space-sm">
<span className="material-symbols-outlined text-[16px]">verified</span>
<span>Maritime Escrow &amp; Legal Compliance Standard</span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary mb-space-sm">Santander Maritime Escrow Integration Active</h2>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-space-lg">
            Client funds are held in ring-fenced fiduciary accounts in compliance with Real Decreto 1027/1989 and Italian Codice della Navigazione. Escrow release triggers automatically upon mutual electronic signature of the Closing Protocol and Sea Protocol.
          </p>
</div>
<div className="flex flex-wrap items-center gap-space-lg pt-space-md border-t border-surface-container">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[20px]">schedule</span>
<span className="font-label-md text-label-md text-primary">Average Time to Close: <strong>18.4 Days</strong></span>
</div>
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[20px]">security</span>
<span className="font-label-md text-label-md text-primary">All Surveyors: <strong>RINA / IIMS Certified</strong></span>
</div>
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[20px]">description</span>
<span className="font-label-md text-label-md text-primary">Standard MYBA MOA Pre-loaded</span>
</div>
</div>
</div>

<div className="bg-primary text-on-primary p-space-xl rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed mb-space-sm">Brokerage Target Q4</div>
<div className="font-display-hero text-display-hero-mobile lg:text-display-hero tracking-tight leading-none mb-space-xs text-on-primary">
            €24.2M
          </div>
<div className="font-body-md text-body-md text-on-primary-container">
            Achieved: 78% of €31.0M seasonal mandate volume.
          </div>
</div>
<div className="pt-space-lg">
<div className="w-full bg-primary-container h-2 rounded-full overflow-hidden mb-2">
<div className="bg-secondary-fixed h-full rounded-full w-[78%]"></div>
</div>
<div className="flex justify-between font-label-sm text-label-sm text-on-primary-container">
<span>STP Palma Yard: 9 berths active</span>
<span className="text-secondary-fixed font-semibold">+14% vs Q3</span>
</div>
</div>
</div>
</div>
</div>

<div className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-50 hidden opacity-0 transition-opacity duration-300" id="drawer-backdrop"></div>
<div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-surface-container-lowest shadow-2xl z-50 transform translate-x-full transition-transform duration-300 overflow-y-auto flex flex-col justify-between" id="lead-drawer">

<div>
<div className="p-space-lg bg-surface-container-low flex items-center justify-between sticky top-0 z-10">
<div className="flex items-center gap-space-sm">
<span className="font-label-sm text-label-sm uppercase tracking-wider px-2.5 py-1 rounded bg-secondary text-on-secondary font-semibold" id="drawer-tag">Sea Trial Scheduled</span>
<span className="text-on-surface-variant font-label-sm text-label-sm" id="drawer-id">Mandate #MB-2024-88</span>
</div>
<button className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors">
<span className="material-symbols-outlined text-[22px]">close</span>
</button>
</div>

<div className="p-space-lg md:p-space-xl flex flex-col gap-space-xl">

<div className="flex flex-col gap-space-xs">
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight" id="drawer-client-name">Lord Alistair Vance</h2>
<p className="font-body-lg text-body-lg text-on-surface-variant" id="drawer-client-sub">London, UK / Monaco · Vance Maritime Investment Trust</p>
</div>

<div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm p-space-md bg-surface-container-low rounded-xl">
<div>
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">KYC Compliance</span>
<span className="font-spec-num text-spec-num font-semibold text-secondary flex items-center gap-1 mt-0.5" id="drawer-kyc">
<span className="material-symbols-outlined text-[16px]">verified</span> Level 2 Approved
            </span>
</div>
<div>
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">Budget Range</span>
<span className="font-spec-num text-spec-num font-semibold text-primary mt-0.5" id="drawer-budget">€4.5M – €5.2M</span>
</div>
<div>
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">Assigned Agent</span>
<span className="font-spec-num text-spec-num font-semibold text-primary mt-0.5" id="drawer-agent">Luc Fournier</span>
</div>
</div>

<div className="flex flex-col gap-space-sm">
<div className="flex justify-between items-center">
<h3 className="font-title-lg text-title-lg text-primary">Vessel Under Negotiation</h3>
<Link href="#" className="text-secondary hover:text-primary font-label-md text-label-md font-semibold" >Open Fleet Spec →</Link>
</div>
<div className="bg-surface-container-low p-space-md rounded-xl flex flex-col sm:flex-row gap-space-md items-start sm:items-center">
<div className="w-full sm:w-32 h-24 rounded-lg bg-surface-container-high shrink-0 overflow-hidden relative">
<img alt="" className="w-full h-full object-cover" src="/design/3f7f9a8d9e.jpg"/>
</div>
<div className="flex-1 min-w-0">
<div className="flex justify-between items-baseline mb-1">
<h4 className="font-headline-sm text-headline-sm text-primary truncate" id="drawer-vessel-title">Sanlorenzo SL88</h4>
<span className="font-spec-num text-spec-num font-bold text-primary" id="drawer-vessel-price">€4,650,000</span>
</div>
<div className="font-body-sm text-body-sm text-on-surface-variant mb-space-xs" id="drawer-vessel-specs">Year 2018 · Length 26.8m · 2x MTU 2000hp · Flag: Cayman Islands</div>
<div className="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary bg-surface-container-lowest px-2 py-0.5 rounded shadow-xs" id="drawer-vessel-berth">
<span className="material-symbols-outlined text-[14px]">location_on</span> STP Palma de Mallorca · Berth 42
              </div>
</div>
</div>
</div>

<div className="flex flex-col gap-space-xs">
<h3 className="font-title-lg text-title-lg text-primary">Upcoming Critical Milestone</h3>
<div className="bg-surface-container-low p-space-md rounded-xl flex items-start gap-space-md">
<div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[20px]">sailing</span>
</div>
<div className="flex-1">
<div className="flex justify-between items-center mb-1">
<span className="font-title-md text-title-md text-primary font-semibold" id="drawer-milestone-title">Official Sea Trial &amp; Engine Testing</span>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-error-container text-on-error-container font-semibold">Friday, 10:00 CEST</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant" id="drawer-milestone-desc">
                Sea trial route: STP Palma to Cabrera channel (30 knots sustained test). Skippered by Capt. Juan Morro. Fuel log &amp; vibration telemetry to be verified by Lloyds surveyor.
              </p>
</div>
</div>
</div>

<div className="flex flex-col gap-space-sm">
<div className="flex justify-between items-center">
<h3 className="font-title-lg text-title-lg text-primary">Recent Touchpoints</h3>
<button className="text-secondary hover:text-primary font-label-md text-label-md font-semibold inline-flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">history</span> Full Log
            </button>
</div>
<div className="flex flex-col gap-space-sm" id="drawer-touchpoints">
<div className="p-space-sm bg-surface-container-low rounded-lg flex items-start gap-3">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">phone_in_talk</span>
<div className="flex-1">
<div className="flex justify-between text-label-sm font-label-sm text-on-surface-variant">
<span className="font-semibold text-primary">Call with Representative (Nicholas Drake)</span>
<span>Yesterday 16:40</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Confirmed client arriving at Son Sant Joan Airport by private flight on Thursday evening. Car transfer arranged to Hotel Es Princep.
                </p>
</div>
</div>
<div className="p-space-sm bg-surface-container-low rounded-lg flex items-start gap-3">
<span className="material-symbols-outlined text-surface-tint text-[18px] mt-0.5">description</span>
<div className="flex-1">
<div className="flex justify-between text-label-sm font-label-sm text-on-surface-variant">
<span className="font-semibold text-primary">MYBA Memorandum of Agreement Drafted</span>
<span>2 days ago</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  10% deposit terms verified. Special clause inserted for stabilizer gyro service warranty extension.
                </p>
</div>
</div>
</div>
</div>
</div>
</div>

<div className="p-space-lg bg-surface-container-low border-t border-surface-container-high sticky bottom-0 flex flex-col sm:flex-row items-center justify-between gap-space-md">
<div className="flex items-center gap-space-sm w-full sm:w-auto">
<button className="flex-1 sm:flex-none px-space-md py-space-sm bg-surface-container-lowest hover:bg-surface-container text-primary rounded-lg font-title-md text-title-md inline-flex items-center justify-center gap-2 shadow-sm transition-all">
<span className="material-symbols-outlined text-[18px]">phone</span>
<span>Log Call</span>
</button>
<button className="flex-1 sm:flex-none px-space-md py-space-sm bg-surface-container-lowest hover:bg-surface-container text-primary rounded-lg font-title-md text-title-md inline-flex items-center justify-center gap-2 shadow-sm transition-all">
<span className="material-symbols-outlined text-[18px]">person_add</span>
<span>Assign Agent</span>
</button>
</div>
<button className="w-full sm:w-auto px-space-lg py-space-sm bg-primary hover:bg-primary-container text-on-primary rounded-lg font-title-md text-title-md inline-flex items-center justify-center gap-2 shadow-sm transition-all">
<span className="material-symbols-outlined text-[18px]">send_time_extension</span>
<span>Send Escrow Contract</span>
</button>
</div>
</div>


</div>
      </RequirePermission>
    </main>
  );
}
