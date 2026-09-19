import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function StaffBoats() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission permission="approve_listings_and_revisions">
<div className="flex flex-col w-full">

<div className="w-full bg-primary text-on-primary">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xs flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-space-sm">
<span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-secondary-fixed"></span>
<span className="font-label-sm tracking-wider uppercase text-on-primary font-semibold">Staff Admin</span>
<span className="text-outline-variant">/</span>
<span className="font-body-sm text-on-primary-container">Maritime Compliance &amp; Identity Desk</span>
<span className="hidden md:inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest bg-primary-container text-on-primary-container">Screen 42 of 51</span>
</div>
<div className="flex items-center gap-space-md font-body-sm">
<Link href="#" className="inline-flex items-center gap-1 text-on-primary-container hover:text-on-primary transition-colors" >
<span className="material-symbols-outlined text-[16px]">swap_horiz</span>
<span>Switch Demo Role</span>
</Link>
<span className="text-outline-variant">·</span>
<Link href="#" className="inline-flex items-center gap-1 text-on-primary-container hover:text-error-container transition-colors" >
<span className="material-symbols-outlined text-[16px]">logout</span>
<span>Log Out</span>
</Link>
</div>
</div>
</div>

<div className="w-full bg-surface-container-lowest shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop overflow-x-auto">
<nav className="flex items-center gap-space-md whitespace-nowrap min-w-max py-space-xs">
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors" >Overview</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" >
<span>Users</span>
<span className="font-label-sm text-[10px] text-outline px-1.5 py-0.2 rounded bg-surface-container">41</span>
</Link>
<Link href="#" className="py-space-sm font-title-md text-primary border-b-2 border-primary transition-colors flex items-center gap-1 font-semibold" >
<span>Boats</span>
<span className="font-label-sm text-[10px] text-on-secondary px-1.5 py-0.2 rounded bg-secondary font-bold">ACTIVE</span>
</Link>
<Link href="/brokers/" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" >
<span>Brokers</span>
<span className="font-label-sm text-[10px] text-outline px-1.5 py-0.2 rounded bg-surface-container">43</span>
</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" >
<span>Service Providers</span>
<span className="font-label-sm text-[10px] text-outline px-1.5 py-0.2 rounded bg-surface-container">44</span>
</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" >
<span>Service Requests</span>
<span className="font-label-sm text-[10px] text-outline px-1.5 py-0.2 rounded bg-surface-container">45</span>
</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" >
<span>Leads</span>
<span className="font-label-sm text-[10px] text-outline px-1.5 py-0.2 rounded bg-surface-container">46</span>
</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" >
<span>Subscriptions</span>
<span className="font-label-sm text-[10px] text-outline px-1.5 py-0.2 rounded bg-surface-container">47</span>
</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" >
<span>Ads &amp; Banners</span>
<span className="font-label-sm text-[10px] text-outline px-1.5 py-0.2 rounded bg-surface-container">48</span>
</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" >
<span>Guides &amp; Blog</span>
<span className="font-label-sm text-[10px] text-outline px-1.5 py-0.2 rounded bg-surface-container">49</span>
</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" >
<span>Analytics</span>
<span className="font-label-sm text-[10px] text-outline px-1.5 py-0.2 rounded bg-surface-container">50</span>
</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" >
<span>Settings</span>
<span className="font-label-sm text-[10px] text-outline px-1.5 py-0.2 rounded bg-surface-container">51</span>
</Link>
</nav>
</div>
</div>

<div className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="flex flex-col gap-space-xs max-w-3xl">
<div className="inline-flex items-center gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[20px]">verified_user</span>
<span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">Maritime Directorate · Registry Control</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Vessel Inventory &amp; Registry Management</h1>
<p className="font-body-md text-body-md text-on-surface-variant">
          Oversee all active, pending, and archived vessel listings across Spanish Lista 6ª/7ª, Italian RID, and international flags. Validate HIN numbers, CE conformity, and ownership titles before public release.
        </p>
</div>
<div className="flex flex-wrap items-center gap-space-sm shrink-0">
<button className="inline-flex items-center gap-space-xs bg-surface-container hover:bg-surface-container-high text-primary font-title-md text-title-md px-space-md py-space-sm rounded-lg shadow-sm transition-all" type="button">
<span className="material-symbols-outlined text-[20px]">download</span>
<span>Export Fleet Registry (XLSX)</span>
</button>
<button className="inline-flex items-center gap-space-xs bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md px-space-md py-space-sm rounded-lg shadow-md transition-all" type="button">
<span className="material-symbols-outlined text-[20px]">add_moderator</span>
<span>+ Add Manual Verification</span>
</button>
</div>
</div>

<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-space-md">
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-xs">
<div className="flex items-center justify-between text-on-surface-variant">
<span className="font-label-sm uppercase tracking-wider">Total Vessels</span>
<span className="material-symbols-outlined text-on-surface-variant text-[18px]">directions_boat</span>
</div>
<div className="font-headline-md text-headline-md text-primary font-bold">1,482</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Entire Mediterranean catalog</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-xs">
<div className="flex items-center justify-between text-tertiary-container">
<span className="font-label-sm uppercase tracking-wider text-on-tertiary-fixed-variant">Pending Verification</span>
<span className="material-symbols-outlined text-tertiary-fixed-dim text-[18px]">pending_actions</span>
</div>
<div className="font-headline-md text-headline-md text-on-tertiary-container font-bold">14</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">4 flagged Spanish Lista 6ª</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-xs">
<div className="flex items-center justify-between text-secondary">
<span className="font-label-sm uppercase tracking-wider">Active on Marketplace</span>
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
</div>
<div className="font-headline-md text-headline-md text-secondary font-bold">1,290</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Public live with verified HIN</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-xs">
<div className="flex items-center justify-between text-primary-container">
<span className="font-label-sm uppercase tracking-wider text-primary">Under Escrow</span>
<span className="material-symbols-outlined text-primary text-[18px]">lock_clock</span>
</div>
<div className="font-headline-md text-headline-md text-primary font-bold">86</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Deposit held in notary account</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-xs col-span-2 md:col-span-1">
<div className="flex items-center justify-between text-on-surface-variant">
<span className="font-label-sm uppercase tracking-wider text-outline">Stolen / Blacklist</span>
<span className="material-symbols-outlined text-outline text-[18px]">gavel</span>
</div>
<div className="font-headline-md text-headline-md text-primary font-bold">0</div>
<span className="font-body-sm text-body-sm text-secondary flex items-center gap-1">
<span className="material-symbols-outlined text-[14px]">shield</span> Registry sync clear
        </span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-md">
<div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-space-md">

<div className="relative flex-1">
<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
<input className="w-full bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary transition-all" placeholder="Search by vessel name, HIN / Hull ID, Spanish Matrícula, Italian RID, or shipyard..." type="text" value=""/>
</div>
<div className="flex flex-wrap items-center gap-space-sm">

<div className="relative min-w-[150px]">
<select className="w-full appearance-none bg-surface-container-low text-on-surface font-body-sm text-body-sm px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer pr-8">
<option>Status: All Statuses</option>
<option>Status: Verified &amp; Live</option>
<option >Status: Pending Review (14)</option>
<option>Status: Escrow Active (86)</option>
<option>Status: Incomplete Draft</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-[18px]">expand_more</span>
</div>

<div className="relative min-w-[150px]">
<select className="w-full appearance-none bg-surface-container-low text-on-surface font-body-sm text-body-sm px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer pr-8">
<option >Category: All Categories</option>
<option>Motor Yacht</option>
<option>Sailing Yacht</option>
<option>Catamaran</option>
<option>Day Boat / RIB</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-[18px]">expand_more</span>
</div>

<div className="relative min-w-[170px]">
<select className="w-full appearance-none bg-surface-container-low text-on-surface font-body-sm text-body-sm px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer pr-8">
<option >Flag: All Jurisdictions</option>
<option>Spain (Lista 7ª Private)</option>
<option>Spain (Lista 6ª Chárter)</option>
<option>Italy (Registro Diporto RID)</option>
<option>Malta / UK / Cayman Islands</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-[18px]">expand_more</span>
</div>

<div className="relative min-w-[140px]">
<select className="w-full appearance-none bg-surface-container-low text-on-surface font-body-sm text-body-sm px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer pr-8">
<option >Agency / Seller: All</option>
<option>Central Broker Agency</option>
<option>Private Owner Direct</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-[18px]">expand_more</span>
</div>
<button className="p-2.5 bg-surface-container-low hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-primary transition-colors" title="Reset Filters" type="button">
<span className="material-symbols-outlined text-[20px]">filter_list_off</span>
</button>
</div>
</div>

<div className="flex flex-wrap items-center gap-space-xs pt-space-xs font-label-sm text-label-sm text-on-surface-variant">
<span className="text-outline uppercase tracking-wider mr-1">Quick Filters:</span>
<button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold hover:bg-secondary-fixed-dim transition-all" type="button">
<span>Requires Apostille Verification (6)</span>
</button>
<button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-all" type="button">
<span>Spanish Lista 6ª Active (182)</span>
</button>
<button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-all" type="button">
<span>Italian RID Verified (312)</span>
</button>
<button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-all" type="button">
<span>Commercial Passenger Survey Expiring</span>
</button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
<div className="overflow-x-auto">
<table className="w-full text-left font-body-md text-body-md border-collapse">
<thead>
<tr className="bg-surface-container-low text-on-surface-variant font-label-md text-label-md uppercase tracking-wider">
<th className="py-space-md px-space-md font-semibold" scope="col">Vessel Details</th>
<th className="py-space-md px-space-md font-semibold" scope="col">Specs &amp; Hull</th>
<th className="py-space-md px-space-md font-semibold" scope="col">Seller / Broker</th>
<th className="py-space-md px-space-md font-semibold" scope="col">Asking Price &amp; VAT</th>
<th className="py-space-md px-space-md font-semibold" scope="col">Flag &amp; Matrícula</th>
<th className="py-space-md px-space-md font-semibold" scope="col">Compliance Status</th>
<th className="py-space-md px-space-md font-semibold text-right" scope="col">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container">

<tr className="hover:bg-surface-bright transition-colors">
<td className="py-space-md px-space-md align-top">
<div className="flex items-start gap-space-sm">
<div className="w-16 h-12 rounded-lg bg-surface-container-high overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/1fe92292a7.jpg"/>
</div>
<div className="flex flex-col">
<span className="font-headline-sm text-headline-sm text-primary leading-tight">Luminosa</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Benetti Oasis 40M (2022)</span>
<span className="font-label-sm text-label-sm text-outline mt-0.5">HIN: IT-BEN40082E222</span>
</div>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col font-body-sm text-body-sm">
<span className="font-spec-num text-spec-num text-primary font-medium">40.80m · 8.50m Beam</span>
<span className="text-on-surface-variant">Tri-deck GRP / Teak</span>
<span className="text-outline">Twin MAN V12-1400hp</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col">
<span className="font-title-md text-title-md text-primary">Marina Balear Yachting</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Luc Fournier (Central Agent)</span>
<span className="font-label-sm text-secondary flex items-center gap-0.5 mt-0.5">
<span className="material-symbols-outlined text-[14px]">verified</span> MYBA Form Registered
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-bold text-lg">€14,800,000</span>
<span className="font-label-sm text-label-sm uppercase tracking-wide text-outline">Excl. VAT (Offshore)</span>
<span className="font-body-sm text-[11px] text-on-surface-variant">Tasa 0a Not Applicable</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col font-body-sm text-body-sm">
<div className="inline-flex items-center gap-1 text-primary font-medium">
<span className="material-symbols-outlined text-[16px] text-secondary">flag</span>
<span>Cayman Islands</span>
</div>
<span className="text-outline font-label-sm">REG: 742190 George Town</span>
<span className="text-secondary font-label-sm mt-0.5">Commercial Code CY-1</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-1 items-start">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    Verified &amp; Live
                  </span>
<span className="font-body-sm text-[11px] text-on-surface-variant">Survey audit valid thru 2026</span>
</div>
</td>
<td className="py-space-md px-space-md align-top text-right">
<div className="inline-flex items-center gap-space-xs">
<button className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container-high text-primary transition-colors" title="Inspect Listing" type="button">
<span className="material-symbols-outlined text-[18px]">visibility</span>
</button>
<button className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container-high text-primary transition-colors" title="Edit Flags &amp; Registry" type="button">
<span className="material-symbols-outlined text-[18px]">edit_document</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-bright transition-colors bg-surface-container-low/40">
<td className="py-space-md px-space-md align-top">
<div className="flex items-start gap-space-sm">
<div className="w-16 h-12 rounded-lg bg-surface-container-high overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/bde2264d46.jpg"/>
</div>
<div className="flex flex-col">
<span className="font-headline-sm text-headline-sm text-primary leading-tight">Solaria</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Sanlorenzo SL88 (2018)</span>
<span className="font-label-sm text-label-sm text-outline mt-0.5">HIN: IT-SLZ00881G818</span>
</div>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col font-body-sm text-body-sm">
<span className="font-spec-num text-spec-num text-primary font-medium">26.76m · 6.75m Beam</span>
<span className="text-on-surface-variant">Planing GRP Hull</span>
<span className="text-outline">Twin MTU 16V 2000 M96</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col">
<span className="font-title-md text-title-md text-primary">Marina Balear Yachting</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Co-brokerage with Palma Nautic</span>
<span className="font-label-sm text-on-surface-variant mt-0.5">Notary: Bufete Morell Palma</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-bold text-lg">€4,650,000</span>
<span className="font-label-sm text-label-sm uppercase tracking-wide text-secondary font-semibold">VAT Paid (ES 21%)</span>
<span className="font-body-sm text-[11px] text-on-surface-variant">Spanish IEDMT Paid</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col font-body-sm text-body-sm">
<div className="inline-flex items-center gap-1 text-primary font-medium">
<span className="material-symbols-outlined text-[16px] text-secondary">flag</span>
<span>Spain (Lista 7ª)</span>
</div>
<span className="text-outline font-label-sm">Matrícula: 6ª-BA-2-118-18</span>
<span className="text-on-surface-variant font-label-sm mt-0.5">Base: Palma de Mallorca</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-1 items-start">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-sm font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                    Escrow Active
                  </span>
<span className="font-body-sm text-[11px] text-on-surface-variant">Sea trial pending Friday</span>
</div>
</td>
<td className="py-space-md px-space-md align-top text-right">
<div className="inline-flex items-center gap-space-xs">
<button className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container-high text-primary transition-colors" title="View Escrow &amp; Audit Trail" type="button">
<span className="material-symbols-outlined text-[18px]">history_edu</span>
</button>
<button className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container-high text-primary transition-colors" title="Details" type="button">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-bright transition-colors">
<td className="py-space-md px-space-md align-top">
<div className="flex items-start gap-space-sm">
<div className="w-16 h-12 rounded-lg bg-surface-container-high overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/70e2f6a151.jpg"/>
</div>
<div className="flex flex-col">
<span className="font-headline-sm text-headline-sm text-primary leading-tight">Baleares Express</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Solaris 50 (2021)</span>
<span className="font-label-sm text-label-sm text-outline mt-0.5">HIN: IT-SOL50034B121</span>
</div>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col font-body-sm text-body-sm">
<span className="font-spec-num text-spec-num text-primary font-medium">15.40m · 4.78m Beam</span>
<span className="text-on-surface-variant">Performance Cruiser / Sail</span>
<span className="text-outline">Volvo Penta D2-75 Saildrive</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col">
<span className="font-title-md text-title-md text-primary">Carlos Méndez de Vigo</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Private Seller (Direct Owner)</span>
<span className="font-label-sm text-secondary flex items-center gap-0.5 mt-0.5">
<span className="material-symbols-outlined text-[14px]">id_card</span> DNI Verified ES
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-bold text-lg">€685,000</span>
<span className="font-label-sm text-label-sm uppercase tracking-wide text-secondary font-semibold">VAT Paid (ES 21%)</span>
<span className="font-body-sm text-[11px] text-on-surface-variant">Modelo 06 Exemption Cleared</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col font-body-sm text-body-sm">
<div className="inline-flex items-center gap-1 text-primary font-medium">
<span className="material-symbols-outlined text-[16px] text-secondary">flag</span>
<span>Spain (Lista 7ª)</span>
</div>
<span className="text-outline font-label-sm">Matrícula: 7ª-PM-1-420-21</span>
<span className="text-on-surface-variant font-label-sm mt-0.5">Berth: RCNP Palma #B-42</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-1 items-start">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    Verified &amp; Live
                  </span>
<span className="font-body-sm text-[11px] text-on-surface-variant">RINA inspection uploaded</span>
</div>
</td>
<td className="py-space-md px-space-md align-top text-right">
<div className="inline-flex items-center gap-space-xs">
<button className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container-high text-primary transition-colors" title="Inspect Listing" type="button">
<span className="material-symbols-outlined text-[18px]">visibility</span>
</button>
<button className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container-high text-primary transition-colors" title="Edit Inspection Record" type="button">
<span className="material-symbols-outlined text-[18px]">rule</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-bright transition-colors bg-tertiary-fixed/10">
<td className="py-space-md px-space-md align-top">
<div className="flex items-start gap-space-sm">
<div className="w-16 h-12 rounded-lg bg-surface-container-high overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/ecd1c4eccb.jpg"/>
</div>
<div className="flex flex-col">
<span className="font-headline-sm text-headline-sm text-primary leading-tight">Perla Nera</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Riva 76 Bahamas (2020)</span>
<span className="font-label-sm text-label-sm text-outline mt-0.5">HIN: IT-RIV76019K920</span>
</div>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col font-body-sm text-body-sm">
<span className="font-spec-num text-spec-num text-primary font-medium">23.25m · 5.75m Beam</span>
<span className="text-on-surface-variant">Convertible Hardtop GRP</span>
<span className="text-outline">Twin MAN V12-1800</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col">
<span className="font-title-md text-title-md text-primary">Marco Tavaglione</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Private Seller (Milano/Genova)</span>
<span className="font-label-sm text-on-tertiary-fixed-variant flex items-center gap-0.5 mt-0.5">
<span className="material-symbols-outlined text-[14px]">help</span> Codice Fiscale Pending Check
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-bold text-lg">€2,890,000</span>
<span className="font-label-sm text-label-sm uppercase tracking-wide text-secondary font-semibold">VAT Paid (IT 22%)</span>
<span className="font-body-sm text-[11px] text-on-surface-variant">Italian Fattura Originale attached</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col font-body-sm text-body-sm">
<div className="inline-flex items-center gap-1 text-primary font-medium">
<span className="material-symbols-outlined text-[16px] text-secondary">flag</span>
<span>Italy (RID Diporto)</span>
</div>
<span className="text-outline font-label-sm">RID Genova: #GE-9912-D</span>
<span className="text-on-surface-variant font-label-sm mt-0.5">Registro Telematico Centralizzato</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-1 items-start">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
                    Pending Verification
                  </span>
<span className="font-body-sm text-[11px] text-on-tertiary-fixed-variant">Awaiting Bill of Sale Apostille</span>
</div>
</td>
<td className="py-space-md px-space-md align-top text-right">
<div className="inline-flex items-center gap-space-xs">
<button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-primary text-on-primary font-label-sm hover:bg-primary-container transition-colors" title="Review Title Deeds" type="button">
<span className="material-symbols-outlined text-[16px]">fact_check</span>
<span>Review Docs</span>
</button>
<button className="p-1.5 rounded bg-surface-container-low hover:bg-secondary hover:text-on-secondary text-primary transition-colors" title="Approve Listing" type="button">
<span className="material-symbols-outlined text-[18px]">check</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-bright transition-colors">
<td className="py-space-md px-space-md align-top">
<div className="flex items-start gap-space-sm">
<div className="w-16 h-12 rounded-lg bg-surface-container-high overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/40179181d3.jpg"/>
</div>
<div className="flex flex-col">
<span className="font-headline-sm text-headline-sm text-primary leading-tight">Ventura</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Axopar 37 Sun-Top (2016)</span>
<span className="font-label-sm text-label-sm text-outline mt-0.5">HIN: FI-AXO37105H616</span>
</div>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col font-body-sm text-body-sm">
<span className="font-spec-num text-spec-num text-primary font-medium">11.20m · 3.30m Beam</span>
<span className="text-on-surface-variant">Twin Stepped Hull / T-Top</span>
<span className="text-outline">Twin Mercury Verado 350hp</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col">
<span className="font-title-md text-title-md text-primary">Jaume Soler Pons</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Private Seller (Menorca)</span>
<span className="font-label-sm text-outline flex items-center gap-0.5 mt-0.5">
<span className="material-symbols-outlined text-[14px]">schedule</span> Registered 3 days ago
                  </span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-bold text-lg">€165,000</span>
<span className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">Est. Market Value</span>
<span className="font-body-sm text-[11px] text-on-surface-variant">VAT Paid verification needed</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col font-body-sm text-body-sm">
<div className="inline-flex items-center gap-1 text-primary font-medium">
<span className="material-symbols-outlined text-[16px] text-secondary">flag</span>
<span>Spain (Lista 7ª)</span>
</div>
<span className="text-outline font-label-sm">Matrícula: 7ª-IB-3-882-16</span>
<span className="text-on-surface-variant font-label-sm mt-0.5">Puerto Mahón</span>
</div>
</td>
<td className="py-space-md px-space-md align-top">
<div className="flex flex-col gap-1 items-start">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                    Incomplete Draft
                  </span>
<span className="font-body-sm text-[11px] text-error">Requires High-Res Hull Photos</span>
</div>
</td>
<td className="py-space-md px-space-md align-top text-right">
<div className="inline-flex items-center gap-space-xs">
<button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-surface-container-high hover:bg-surface-container text-primary font-label-sm transition-colors" title="Send Upload Reminder Email" type="button">
<span className="material-symbols-outlined text-[16px]">outgoing_mail</span>
<span>Nudge Seller</span>
</button>
<button className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container-high text-primary transition-colors" title="Manage Record" type="button">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
</td>
</tr>
</tbody>
</table>
</div>

<div className="bg-surface-container-low px-space-md py-space-sm flex flex-col sm:flex-row items-center justify-between gap-space-sm font-body-sm text-body-sm text-on-surface-variant">
<div className="flex items-center gap-space-sm">
<span>Showing <strong className="text-primary font-semibold">1 to 5</strong> of 1,482 vessels</span>
<span className="text-outline-variant">·</span>
<label className="flex items-center gap-1 text-on-surface">
<span>Rows per page:</span>
<select className="bg-surface-container-lowest text-on-surface px-2 py-1 rounded text-body-sm focus:outline-none">
<option>5</option>
<option >25</option>
<option>50</option>
<option>100</option>
</select>
</label>
</div>
<div className="flex items-center gap-1">
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface-variant hover:text-primary disabled:opacity-50" disabled type="button">
<span className="material-symbols-outlined text-[18px] align-middle">chevron_left</span>
</button>
<button className="px-3 py-1 rounded bg-primary text-on-primary font-semibold" type="button">1</button>
<button className="px-3 py-1 rounded bg-surface-container-lowest hover:bg-surface-container text-primary" type="button">2</button>
<button className="px-3 py-1 rounded bg-surface-container-lowest hover:bg-surface-container text-primary" type="button">3</button>
<span className="px-2 text-outline">...</span>
<button className="px-3 py-1 rounded bg-surface-container-lowest hover:bg-surface-container text-primary" type="button">297</button>
<button className="px-2.5 py-1 rounded bg-surface-container-lowest text-primary hover:bg-surface-container" type="button">
<span className="material-symbols-outlined text-[18px] align-middle">chevron_right</span>
</button>
</div>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-sm">
<div className="inline-flex items-center gap-space-xs text-secondary">
<span className="material-symbols-outlined text-[22px]">policy</span>
<span className="font-label-sm uppercase tracking-wider font-semibold">Flag &amp; Matriculation Audits</span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary">Spanish Tasa 0a &amp; Italian RID Harmonization</h2>
<p className="font-body-md text-body-md text-on-surface-variant">
            Cross-checking vessel registries against Spain’s Dirección General de la Marina Mercante (DGMM) and Italy’s ATN (Archivio Telematico Nautico). Listings with uncertified charter status (Lista 6ª) are withheld from public indexing until tax clearances are verified.
          </p>
</div>
<div className="flex flex-col gap-space-xs font-body-sm bg-surface-container-low p-space-sm rounded-lg">
<div className="flex items-center justify-between">
<span className="text-on-surface-variant">Spanish Agencia Tributaria (Mod. 576):</span>
<span className="text-secondary font-semibold">99.2% Cleared</span>
</div>
<div className="flex items-center justify-between">
<span className="text-on-surface-variant">Italian Certificato di Sicurezza:</span>
<span className="text-secondary font-semibold">Up to date</span>
</div>
<div className="flex items-center justify-between">
<span className="text-on-surface-variant">CE Builder Plate Conformity (ISO 10087):</span>
<span className="text-primary font-semibold">Manual review required</span>
</div>
</div>
<button className="inline-flex items-center justify-center gap-space-xs bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md py-space-sm px-space-md rounded-lg transition-all shadow-sm" type="button">
<span className="material-symbols-outlined text-[20px]">sync</span>
<span>Trigger Automatic AIS / Registry Cross-Check</span>
</button>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-sm">
<div className="inline-flex items-center gap-space-xs text-secondary">
<span className="material-symbols-outlined text-[22px]">verified</span>
<span className="font-label-sm uppercase tracking-wider font-semibold">Surveyor Validation</span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary">Apostilled CE Declarations &amp; Liens</h2>
<p className="font-body-md text-body-md text-on-surface-variant">
            All private boats sold above €100,000 must present non-encumbrance certificates (Certificado de Cargas / Estratto Registro Diporto) to guarantee vessels are free of maritime mortgages or unpaid shipyard liens before escrow opens.
          </p>
</div>

<div className="bg-surface-container-low p-space-sm rounded-lg flex items-center gap-space-md">
<div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
<svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
<path className="text-surface-container-high" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5"></path>
<path className="text-secondary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="94, 100" strokeLinecap="round" strokeWidth="3.5"></path>
</svg>
<span className="absolute font-label-md font-bold text-primary">94%</span>
</div>
<div className="flex flex-col">
<span className="font-title-md text-title-md text-primary">1,393 of 1,482 Audited</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">89 vessels have pending maritime hypothec reviews.</span>
</div>
</div>
<div className="flex items-center gap-space-sm">
<button className="w-full inline-flex items-center justify-center gap-1 bg-surface-container hover:bg-surface-container-high text-primary font-title-md text-title-md py-space-sm px-space-md rounded-lg transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
<span>Batch Clear Verified Liens</span>
</button>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-sm">
<div className="inline-flex items-center gap-space-xs text-secondary">
<span className="material-symbols-outlined text-[22px]">anchor</span>
<span className="font-label-sm uppercase tracking-wider font-semibold">Active Fleet Berths</span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary">Key Mediterranean Hubs</h2>
<p className="font-body-md text-body-md text-on-surface-variant">
            Live geographic distribution of listings undergoing on-site surveyor visits and pre-purchase trial runs across the Balearic, Ligurian, and Tyrrhenian seas.
          </p>
</div>
<div className="w-full h-32 bg-cover bg-center rounded-lg shadow-inner relative flex items-end p-space-sm" style={{}}>
<div className="bg-primary/90 backdrop-blur-sm text-on-primary px-2.5 py-1 rounded text-body-sm flex items-center justify-between w-full">
<span className="font-semibold">Palma &amp; Port Adriano Cluster</span>
<span className="font-label-sm bg-secondary px-1.5 py-0.5 rounded text-on-secondary">412 Vessels</span>
</div>
</div>
<div className="grid grid-cols-2 gap-2 text-body-sm">
<div className="p-2 rounded bg-surface-container-low flex flex-col">
<span className="text-on-surface-variant font-label-sm">Genoa / Portofino</span>
<span className="font-bold text-primary">284 Vessels</span>
</div>
<div className="p-2 rounded bg-surface-container-low flex flex-col">
<span className="text-on-surface-variant font-label-sm">Barcelona / Costa Brava</span>
<span className="font-bold text-primary">198 Vessels</span>
</div>
</div>
</div>
</div>
</div>
</div>
      </RequirePermission>
    </main>
  );
}
