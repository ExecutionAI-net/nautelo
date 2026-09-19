import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function StaffBrokers() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission permission="approve_listings_and_revisions">
<div className="flex flex-col w-full">

<div className="w-full bg-primary text-on-primary">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xs flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-space-sm">
<span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
<span className="font-label-sm uppercase tracking-wider text-on-primary-container">System Access:</span>
<span className="font-title-md text-body-sm font-semibold tracking-wide">STAFF ADMIN — Maritime Compliance &amp; Identity Desk</span>
<span className="hidden md:inline-block px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-sm">Registry Tier IV (Pan-Med)</span>
</div>
<div className="flex items-center gap-space-md">
<Link href="#" className="font-label-md text-secondary-fixed hover:text-on-primary transition-colors flex items-center gap-1" >
<span className="material-symbols-outlined text-[16px]">switch_account</span>
          Switch Demo Role
        </Link>
<span className="text-on-primary-container/40">|</span>
<Link href="#" className="font-label-md text-on-primary-container hover:text-on-primary transition-colors flex items-center gap-1" >
<span className="material-symbols-outlined text-[16px]">logout</span>
          Log Out
        </Link>
</div>
</div>
</div>

<div className="w-full bg-surface-container-lowest shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex items-center overflow-x-auto no-scrollbar py-1">
<nav className="flex items-center gap-space-sm min-w-max">
<Link href="#" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">dashboard</span>
          Overview
        </Link>
<Link href="#" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">group</span>
          Users
          <span className="font-label-sm px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">Screen 41</span>
</Link>
<Link href="#" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">sailing</span>
          Boats
          <span className="font-label-sm px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">Screen 42</span>
</Link>

<Link href="#" className="px-space-md py-space-sm text-on-primary font-label-md bg-primary rounded shadow-sm flex items-center gap-1.5 relative" >
<span className="material-symbols-outlined text-[18px] text-secondary-fixed">verified_user</span>
          Brokers
          <span className="font-label-sm px-1.5 py-0.2 rounded-full bg-secondary text-on-secondary text-[10px] ml-1">Screen 43</span>
</Link>
<Link href="#" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">home_repair_service</span>
          Service Providers
          <span className="font-label-sm px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">44</span>
</Link>
<Link href="#" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">assignment</span>
          Service Requests
          <span className="font-label-sm px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">45</span>
</Link>
<Link href="/contact/" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">contact_phone</span>
          Leads
          <span className="font-label-sm px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">46</span>
</Link>
<Link href="#" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">credit_card</span>
          Subscriptions
          <span className="font-label-sm px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">47</span>
</Link>
<Link href="#" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">ad_units</span>
          Ads &amp; Banners
          <span className="font-label-sm px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">48</span>
</Link>
<Link href="#" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">menu_book</span>
          Guides &amp; Blog
          <span className="font-label-sm px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">49</span>
</Link>
<Link href="#" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">analytics</span>
          Analytics
          <span className="font-label-sm px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">50</span>
</Link>
<Link href="#" className="px-space-sm py-space-sm text-on-surface-variant font-label-md hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">settings</span>
          Settings
          <span className="font-label-sm px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">51</span>
</Link>
</nav>
</div>
</div>

<div className="max-w-[1440px] w-full mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="max-w-3xl flex flex-col gap-space-xs">
<div className="flex items-center gap-space-xs font-label-sm uppercase tracking-widest text-secondary">
<span className="material-symbols-outlined text-[16px]">verified</span>
          Mediterranean Marine Registry Verification
        </div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Yacht Broker Agency Accreditation &amp; Governance</h1>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          Accredit professional Mediterranean yacht brokerages, inspect MYBA / ANEN credentials, audit client escrow trustee bonding, and monitor MLS syndication feeds across Spain, France, Monaco, and Italy.
        </p>
</div>
<div className="flex flex-wrap items-center gap-space-sm shrink-0">
<button className="inline-flex items-center justify-center gap-2 bg-surface-container-lowest text-primary hover:bg-surface-container px-space-md py-space-sm rounded font-label-md shadow-sm transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">file_download</span>
          Export Broker Directory
        </button>
<button className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary-container px-space-md py-space-sm rounded font-label-md shadow-sm transition-all" type="button">
<span className="material-symbols-outlined text-[18px]">add_circle</span>
          + Onboard New Brokerage
        </button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col justify-between gap-space-sm">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase text-on-surface-variant tracking-wider">Accredited Brokerages</span>
<span className="p-2 rounded bg-surface-container text-secondary flex items-center justify-center">
<span className="material-symbols-outlined text-[20px]">corporate_fare</span>
</span>
</div>
<div className="flex items-baseline justify-between mt-2">
<span className="font-headline-lg text-headline-lg text-primary font-bold">142</span>
<span className="font-label-sm text-secondary flex items-center gap-0.5">
<span className="material-symbols-outlined text-[14px]">arrow_upward</span> +4 this month
          </span>
</div>
<div className="w-full bg-surface-container-high h-1 rounded overflow-hidden">
<div className="bg-secondary h-full" style={{"width": "88%"}}></div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col justify-between gap-space-sm">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase text-on-surface-variant tracking-wider">MYBA Registered</span>
<span className="p-2 rounded bg-surface-container text-primary flex items-center justify-center">
<span className="material-symbols-outlined text-[20px]">workspace_premium</span>
</span>
</div>
<div className="flex items-baseline justify-between mt-2">
<span className="font-headline-lg text-headline-lg text-primary font-bold">68</span>
<span className="font-label-sm text-on-surface-variant">47.8% of platform</span>
</div>
<div className="w-full bg-surface-container-high h-1 rounded overflow-hidden">
<div className="bg-primary h-full" style={{"width": "48%"}}></div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col justify-between gap-space-sm">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase text-on-surface-variant tracking-wider">Pending Accreditation</span>
<span className="p-2 rounded bg-error-container text-error flex items-center justify-center">
<span className="material-symbols-outlined text-[20px]">pending_actions</span>
</span>
</div>
<div className="flex items-baseline justify-between mt-2">
<span className="font-headline-lg text-headline-lg text-error font-bold">6</span>
<span className="font-label-sm px-2 py-0.5 rounded bg-error-container text-error font-medium">Attention req.</span>
</div>
<div className="w-full bg-surface-container-high h-1 rounded overflow-hidden">
<div className="bg-error h-full" style={{"width": "25%"}}></div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col justify-between gap-space-sm">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase text-on-surface-variant tracking-wider">Managed Fleet Escrow</span>
<span className="p-2 rounded bg-surface-container text-primary flex items-center justify-center">
<span className="material-symbols-outlined text-[20px]">account_balance</span>
</span>
</div>
<div className="flex items-baseline justify-between mt-2">
<span className="font-headline-lg text-headline-lg text-primary font-bold">€412M</span>
<span className="font-label-sm text-on-surface-variant">Active Syndicate</span>
</div>
<div className="w-full bg-surface-container-high h-1 rounded overflow-hidden">
<div className="bg-secondary-fixed-dim h-full" style={{"width": "72%"}}></div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col gap-space-md">

<div className="flex flex-col md:flex-row gap-space-sm">
<div className="relative flex-1">
<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
<input className="w-full pl-10 pr-4 py-2.5 bg-surface rounded text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-all" placeholder="Search by brokerage name, CIF/NIF, MYBA number, head broker, or port city..." type="text"/>
</div>
<div className="flex items-center gap-space-xs shrink-0">
<button className="px-space-md py-2.5 bg-surface-container text-on-surface-variant hover:text-primary rounded font-label-md flex items-center gap-1.5 transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">tune</span>
            Detailed Filters
          </button>
<button className="px-space-md py-2.5 bg-surface text-on-surface-variant hover:text-error rounded font-label-md flex items-center gap-1 transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">clear_all</span>
            Reset
          </button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm pt-space-xs">

<div className="flex flex-col gap-1">
<label className="font-label-sm text-on-surface-variant">Membership Guild</label>
<div className="relative">
<select className="w-full appearance-none bg-surface text-on-surface font-body-sm px-3 py-2 rounded focus:outline-none pr-8">
<option>All Guilds &amp; Associations</option>
<option >MYBA Corporate Member</option>
<option>ANEN España (Asoc. Nac. Empresas Náuticas)</option>
<option>Yacht Brokers Association (YPA)</option>
<option>UCINA / Confindustria Nautica</option>
<option>Independent / Unaffiliated</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
</div>
</div>

<div className="flex flex-col gap-1">
<label className="font-label-sm text-on-surface-variant">Accreditation Status</label>
<div className="relative">
<select className="w-full appearance-none bg-surface text-on-surface font-body-sm px-3 py-2 rounded focus:outline-none pr-8">
<option>All Active &amp; Pending</option>
<option >Accredited &amp; Active</option>
<option>Audit In Progress (KYB)</option>
<option>Annual Renewal Due (&lt;30d)</option>
<option>Suspended / Deficient Escrow</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
</div>
</div>

<div className="flex flex-col gap-1">
<label className="font-label-sm text-on-surface-variant">Commercial Tier</label>
<div className="relative">
<select className="w-full appearance-none bg-surface text-on-surface font-body-sm px-3 py-2 rounded focus:outline-none pr-8">
<option>All Fleet Tiers</option>
<option>Sovereign Agency Tier</option>
<option>Premier Fleet Partner</option>
<option>Boutique Broker</option>
<option>Trial Evaluation</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
</div>
</div>

<div className="flex flex-col gap-1">
<label className="font-label-sm text-on-surface-variant">Primary Mediterranean Hub</label>
<div className="relative">
<select className="w-full appearance-none bg-surface text-on-surface font-body-sm px-3 py-2 rounded focus:outline-none pr-8">
<option>All Mediterranean Hubs</option>
<option>Balearics — Palma / Port Adriano</option>
<option>Barcelona — Port Vell / Marina Vela</option>
<option>Côte d&apos;Azur — Antibes / Cannes / Monaco</option>
<option>Liguria &amp; Tyrrhenian — Genoa / Porto Cervo</option>
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">expand_more</span>
</div>
</div>
</div>
</div>

<div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">

<div className="xl:col-span-8 flex flex-col gap-space-md">
<div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden">
<div className="px-space-md py-space-sm bg-surface-container-low flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="font-title-md text-title-md text-primary">Accredited Brokerage Registry</span>
<span className="font-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant">5 showing of 142</span>
</div>
<div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm">
<span>Sort:</span>
<button className="text-primary font-semibold flex items-center hover:underline" type="button">
                Active Fleet Value
                <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
</button>
</div>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface text-on-surface-variant font-label-sm uppercase tracking-wider">
<th className="py-space-sm px-space-md">Agency &amp; Brand</th>
<th className="py-space-sm px-space-sm">Guild Accreditations</th>
<th className="py-space-sm px-space-sm">Hubs &amp; Ports</th>
<th className="py-space-sm px-space-sm">Managed Fleet</th>
<th className="py-space-sm px-space-sm">Escrow &amp; AML Status</th>
<th className="py-space-sm px-space-md text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container-low font-body-sm text-on-surface">

<tr className="hover:bg-surface-container-low/50 transition-colors group">
<td className="py-space-md px-space-md">
<div className="flex items-center gap-space-sm">
<div className="w-10 h-10 rounded bg-primary-container text-on-primary flex items-center justify-center font-bold text-title-md shrink-0">
                        MB
                      </div>
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold group-hover:text-secondary transition-colors">Marina Balear Yachting S.L.</span>
<span className="font-label-sm text-on-surface-variant">CIF: B-57849102 · Established 1994</span>
<div className="flex items-center gap-1 mt-0.5">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-secondary font-medium">Verified Partner</span>
</div>
</div>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 text-primary font-medium font-body-sm">
<span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
                        MYBA #419
                      </span>
<span className="font-label-sm text-on-surface-variant">ANEN #ESP-882 · YPA</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col">
<span className="font-title-md text-on-surface text-body-sm font-medium">STP Palma &amp; Port Vell</span>
<span className="font-label-sm text-on-surface-variant">Palma de Mallorca, ES</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold">€84.5M</span>
<span className="font-label-sm text-on-surface-variant">24 Vessels Listed</span>
<span className="font-label-sm text-secondary">Premier Fleet (€890/mo)</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col gap-0.5">
<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary bg-surface-container px-2 py-0.5 rounded w-fit">
<span className="material-symbols-outlined text-[13px]">shield</span>
                        Escrow Bonded
                      </span>
<span className="font-label-sm text-on-surface-variant">€10M Lloyds Indemnity</span>
</div>
</td>
<td className="py-space-md px-space-md text-right">
<div className="flex items-center justify-end gap-1">
<button className="px-2.5 py-1.5 rounded bg-surface hover:bg-surface-container text-primary font-label-md transition-colors" type="button">
                        Manage
                      </button>
<button className="p-1.5 rounded text-on-surface-variant hover:text-primary transition-colors" title="Quick Menu" type="button">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors group">
<td className="py-space-md px-space-md">
<div className="flex items-center gap-space-sm">
<div className="w-10 h-10 rounded bg-primary text-on-primary flex items-center justify-center font-bold text-title-md shrink-0">
                        FY
                      </div>
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold group-hover:text-secondary transition-colors">Fraser Yachts Monaco / Palma</span>
<span className="font-label-sm text-on-surface-variant">RCI: MC-09412B · LYBRA Signatory</span>
<div className="flex items-center gap-1 mt-0.5">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-secondary font-medium">Sovereign Agency</span>
</div>
</div>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 text-primary font-medium font-body-sm">
<span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
                        MYBA Corp #014
                      </span>
<span className="font-label-sm text-on-surface-variant">LYBRA Trustee Desk</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col">
<span className="font-title-md text-on-surface text-body-sm font-medium">Monaco, Palma, Antibes</span>
<span className="font-label-sm text-on-surface-variant">Port Hercule Hub</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold">€310M</span>
<span className="font-label-sm text-on-surface-variant">58 Superyachts</span>
<span className="font-label-sm text-primary">Sovereign Enterprise</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col gap-0.5">
<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary bg-surface-container px-2 py-0.5 rounded w-fit">
<span className="material-symbols-outlined text-[13px]">gavel</span>
                        Full Escrow Trustee
                      </span>
<span className="font-label-sm text-on-surface-variant">Banca Monte Paschi AML Clear</span>
</div>
</td>
<td className="py-space-md px-space-md text-right">
<div className="flex items-center justify-end gap-1">
<button className="px-2.5 py-1.5 rounded bg-surface hover:bg-surface-container text-primary font-label-md transition-colors" type="button">
                        Manage
                      </button>
<button className="p-1.5 rounded text-on-surface-variant hover:text-primary transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
</td>
</tr>

<tr className="bg-surface-container-low/30 hover:bg-surface-container-low/60 transition-colors group">
<td className="py-space-md px-space-md">
<div className="flex items-center gap-space-sm">
<div className="w-10 h-10 rounded bg-tertiary-container text-tertiary-fixed flex items-center justify-center font-bold text-title-md shrink-0">
                        NB
                      </div>
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold group-hover:text-secondary transition-colors">Nautica Balear Charter &amp; Sales</span>
<span className="font-label-sm text-on-surface-variant">CIF: B-07921443</span>
<div className="flex items-center gap-1 mt-0.5">
<span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
<span className="font-label-sm text-error font-medium">Audit Pending (14d)</span>
</div>
</div>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 text-on-surface font-medium font-body-sm">
                        ANEN Assoc #914
                      </span>
<span className="font-label-sm text-on-surface-variant">No MYBA Affiliation</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col">
<span className="font-title-md text-on-surface text-body-sm font-medium">Puerto Portals</span>
<span className="font-label-sm text-on-surface-variant">Mallorca, ES</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold">€6.2M</span>
<span className="font-label-sm text-on-surface-variant">9 Vessels Listed</span>
<span className="font-label-sm text-on-surface-variant">Boutique (€290/mo)</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col gap-0.5">
<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-error bg-error-container px-2 py-0.5 rounded w-fit">
<span className="material-symbols-outlined text-[13px]">alarm</span>
                        Bond Renewal Due
                      </span>
<span className="font-label-sm text-error font-medium">Expires in 14 days</span>
</div>
</td>
<td className="py-space-md px-space-md text-right">
<div className="flex items-center justify-end gap-1">
<button className="px-2.5 py-1.5 rounded bg-primary text-on-primary font-label-md transition-colors shadow-sm hover:bg-primary-container" type="button">
                        Review
                      </button>
<button className="p-1.5 rounded text-on-surface-variant hover:text-primary transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
</td>
</tr>

<tr className="bg-surface-container-lowest hover:bg-surface-container-low/50 transition-colors group">
<td className="py-space-md px-space-md">
<div className="flex items-center gap-space-sm">
<div className="w-10 h-10 rounded bg-secondary text-on-secondary flex items-center justify-center font-bold text-title-md shrink-0">
                        CS
                      </div>
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold group-hover:text-secondary transition-colors">Costa Smeralda Yacht Brokers</span>
<span className="font-label-sm text-on-surface-variant">P.IVA: IT-02839180901 · Olbia</span>
<div className="flex items-center gap-1 mt-0.5">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-secondary font-medium">Verified Partner</span>
</div>
</div>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 text-primary font-medium font-body-sm">
<span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
                        UCINA / Confindustria
                      </span>
<span className="font-label-sm text-on-surface-variant">ISYBA Med Certified</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col">
<span className="font-title-md text-on-surface text-body-sm font-medium">Porto Cervo, Sardinia</span>
<span className="font-label-sm text-on-surface-variant">Marina di Porto Cervo</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold">€32.0M</span>
<span className="font-label-sm text-on-surface-variant">14 Vessels Listed</span>
<span className="font-label-sm text-secondary">Premier Fleet</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col gap-0.5">
<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary bg-surface-container px-2 py-0.5 rounded w-fit">
<span className="material-symbols-outlined text-[13px]">verified_user</span>
                        Certified RID &amp; VIES
                      </span>
<span className="font-label-sm text-on-surface-variant">KYB Audit Complete</span>
</div>
</td>
<td className="py-space-md px-space-md text-right">
<div className="flex items-center justify-end gap-1">
<button className="px-2.5 py-1.5 rounded bg-surface-container text-secondary font-label-md font-semibold transition-colors hover:bg-surface-container-high" type="button">
                        Inspecting
                      </button>
<button className="p-1.5 rounded text-on-surface-variant hover:text-primary transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors group">
<td className="py-space-md px-space-md">
<div className="flex items-center gap-space-sm">
<div className="w-10 h-10 rounded bg-surface-container text-on-surface-variant flex items-center justify-center font-bold text-title-md shrink-0">
                        MB
                      </div>
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold group-hover:text-secondary transition-colors">Mediterranean Blue Yachts S.L.</span>
<span className="font-label-sm text-on-surface-variant">CIF: B-57100299 · Ibiza</span>
<div className="flex items-center gap-1 mt-0.5">
<span className="w-2 h-2 rounded-full bg-outline"></span>
<span className="font-label-sm text-error font-medium">Under Review</span>
</div>
</div>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col gap-1">
<span className="inline-flex items-center gap-1 text-on-surface-variant font-body-sm">
                        Independent
                      </span>
<span className="font-label-sm text-on-surface-variant">No Guild Affiliation</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col">
<span className="font-title-md text-on-surface text-body-sm font-medium">Ibiza Marina Botafoch</span>
<span className="font-label-sm text-on-surface-variant">Balearic Islands, ES</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold">€3.1M</span>
<span className="font-label-sm text-on-surface-variant">4 Vessels Listed</span>
<span className="font-label-sm text-on-surface-variant">Boutique Broker</span>
</div>
</td>
<td className="py-space-md px-space-sm">
<div className="flex flex-col gap-0.5">
<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-error bg-error-container px-2 py-0.5 rounded w-fit">
<span className="material-symbols-outlined text-[13px]">warning</span>
                        Missing Insurance
                      </span>
<span className="font-label-sm text-on-surface-variant">Indemnity Cover Unverified</span>
</div>
</td>
<td className="py-space-md px-space-md text-right">
<div className="flex items-center justify-end gap-1">
<button className="px-2.5 py-1.5 rounded bg-surface hover:bg-surface-container text-error font-label-md transition-colors" type="button">
                        Request Proof
                      </button>
<button className="p-1.5 rounded text-on-surface-variant hover:text-primary transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
</td>
</tr>
</tbody>
</table>
</div>

<div className="px-space-md py-space-sm bg-surface-container-lowest flex items-center justify-between font-body-sm text-on-surface-variant">
<span className="font-label-sm">Displaying records 1 through 5 of 142 accredited entities</span>
<div className="flex items-center gap-1">
<button className="p-1 rounded hover:bg-surface-container text-on-surface-variant disabled:opacity-40" disabled type="button">
<span className="material-symbols-outlined text-[18px]">chevron_left</span>
</button>
<span className="px-2 py-0.5 rounded bg-primary text-on-primary font-label-sm">1</span>
<button className="px-2 py-0.5 rounded hover:bg-surface-container font-label-sm" type="button">2</button>
<button className="px-2 py-0.5 rounded hover:bg-surface-container font-label-sm" type="button">3</button>
<span className="font-label-sm px-1">...</span>
<button className="px-2 py-0.5 rounded hover:bg-surface-container font-label-sm" type="button">29</button>
<button className="p-1 rounded hover:bg-surface-container text-on-surface-variant" type="button">
<span className="material-symbols-outlined text-[18px]">chevron_right</span>
</button>
</div>
</div>
</div>

<div className="bg-surface-container-low p-space-md rounded shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md">
<div className="flex items-center gap-space-md">
<div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[24px]">gavel</span>
</div>
<div className="flex flex-col">
<span className="font-title-md text-primary">Pan-Mediterranean Maritime Escrow Directive 2025</span>
<span className="font-body-sm text-on-surface-variant">
                All client deposit accounts must undergo quarterly reconciliation with Banca d&apos;Italia or Banco de España segregated trust mandates.
              </span>
</div>
</div>
<button className="shrink-0 px-space-md py-space-sm bg-surface-container-lowest text-primary hover:bg-surface rounded font-label-md shadow-sm transition-colors" type="button">
            Audit Directive Guidelines
          </button>
</div>
</div>

<div className="xl:col-span-4 flex flex-col gap-space-md">

<div className="bg-surface-container-lowest rounded shadow-md overflow-hidden">

<div className="p-space-md bg-primary text-on-primary flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary-fixed text-[20px]">policy</span>
<span className="font-label-sm uppercase tracking-wider text-secondary-fixed">KYB Accreditation File</span>
</div>
<span className="font-label-sm px-2 py-0.5 rounded bg-primary-container text-on-primary">Dossier #KYB-772</span>
</div>

<div className="p-space-md flex flex-col gap-space-md">
<div className="flex items-start justify-between gap-space-sm">
<div className="flex flex-col">
<span className="font-headline-sm text-headline-sm text-primary">Costa Smeralda Yacht Brokers</span>
<span className="font-body-sm text-on-surface-variant">Sassari Commercial Registry: SS-199402</span>
</div>
<span className="p-2 rounded bg-surface-container-low text-secondary flex items-center justify-center">
<span className="material-symbols-outlined text-[24px]">anchor</span>
</span>
</div>

<div className="flex flex-col gap-space-xs pt-space-xs">
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant">Accreditation Verification Stream</span>

<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
<div className="flex flex-col">
<span className="font-title-md text-[13px] text-primary font-semibold">Camera di Commercio (Sassari)</span>
<span className="font-label-sm text-on-surface-variant">Registration: Active · Clean Standing</span>
</div>
</div>
<span className="font-label-sm text-secondary font-semibold">VALIDATED</span>
</div>

<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
<div className="flex flex-col">
<span className="font-title-md text-[13px] text-primary font-semibold">EU VAT VIES Validation</span>
<span className="font-label-sm text-on-surface-variant">VAT: IT-02839180901 Verified</span>
</div>
</div>
<span className="font-label-sm text-secondary font-semibold">VALIDATED</span>
</div>

<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
<div className="flex flex-col">
<span className="font-title-md text-[13px] text-primary font-semibold">AML Officer Designation</span>
<span className="font-label-sm text-on-surface-variant">Avv. Matteo Rossi (Ord. Sassari)</span>
</div>
</div>
<span className="font-label-sm text-secondary font-semibold">REGISTERED</span>
</div>

<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
<div className="flex flex-col">
<span className="font-title-md text-[13px] text-primary font-semibold">Client Trust Escrow Account</span>
<span className="font-label-sm text-on-surface-variant">Intesa Sanpaolo Dedicated IBAN</span>
</div>
</div>
<span className="font-label-sm text-secondary font-semibold">AUDITED</span>
</div>
</div>

<div className="p-space-sm rounded bg-surface-container flex flex-col gap-2">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase text-on-surface-variant">Syndicate MLS Status</span>
<span className="font-label-sm text-secondary font-semibold">14 vessels online</span>
</div>
<div className="w-full bg-surface-container-highest h-2 rounded overflow-hidden flex">
<div className="bg-secondary h-full" style={{"width": "75%"}} title="Direct Listings"></div>
<div className="bg-primary h-full" style={{"width": "25%"}} title="Co-Brokerage"></div>
</div>
<div className="flex items-center justify-between text-on-surface-variant font-label-sm">
<span>Direct: 11 Vessels</span>
<span>Co-Brokerage: 3 Vessels</span>
</div>
</div>

<div className="flex flex-col gap-space-xs pt-space-xs">
<button className="w-full py-2.5 px-space-md bg-secondary text-on-secondary hover:bg-secondary-container hover:text-on-secondary-container rounded font-label-md flex items-center justify-center gap-2 transition-all shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">verified</span>
                Renew MYBA Trust Seal (Valid to 2026)
              </button>
<button className="w-full py-2 px-space-md bg-surface-container text-on-surface-variant hover:text-primary rounded font-label-md flex items-center justify-center gap-2 transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
                Send Formal Compliance Notice
              </button>
<button className="w-full py-2 px-space-md bg-surface text-error hover:bg-error-container/40 rounded font-label-md flex items-center justify-center gap-2 transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">block</span>
                Suspend Syndicate Feed
              </button>
</div>
<div className="pt-space-xs border-t border-surface-container">
<span className="font-label-sm text-on-surface-variant leading-tight block">
                Last reviewed by Auditor Elena Soler (ID #NAUTA-88) on 12 Feb 2025. Next automated trust verification scheduled in 90 days.
              </span>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col gap-space-sm">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase text-on-surface-variant tracking-wider">Escrow Custody Syndicate</span>
<span className="material-symbols-outlined text-secondary text-[18px]">assured_workload</span>
</div>
<p className="font-body-sm text-on-surface-variant">
            Cross-border currency clearing for EUR, GBP, and USD deposits is handled under Nauta&apos;s central custodial reserve via CaixaBank Marine Private Desk.
          </p>
<div className="flex items-center justify-between pt-1">
<span className="font-title-md text-[13px] text-primary">Daily Escrow Cap: €50M</span>
<Link href="#" className="font-label-md text-secondary hover:underline" >Auditor Portal →</Link>
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
