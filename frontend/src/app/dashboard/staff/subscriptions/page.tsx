import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function StaffSubscriptions() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission permission="approve_listings_and_revisions">
<div className="flex flex-col w-full">

<div className="w-full bg-primary text-on-primary py-space-xs px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-space-sm">
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-label-sm uppercase tracking-wider text-[10px]">
<span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed animate-pulse"></span>
          Console Active
        </span>
<span className="font-spec-num text-on-primary/90 text-label-md tracking-wide">
          STAFF CONSOLE • Billing &amp; Subscriptions — Screen 47 of 51
        </span>
</div>
<div className="flex items-center gap-space-md font-label-md">
<span className="text-on-primary-container hidden sm:inline">Operator: Helena Valls (Maritime Tax Officer)</span>
<button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-primary-container hover:bg-primary/80 text-on-primary transition-colors text-label-sm" type="button">
<span className="material-symbols-outlined text-[14px]">swap_horiz</span>
          Switch Demo Role
        </button>
<button className="inline-flex items-center gap-1 text-on-primary-container hover:text-on-primary transition-colors text-label-sm" type="button">
<span className="material-symbols-outlined text-[14px]">logout</span>
          Log Out
        </button>
</div>
</div>
</div>

<div className="w-full bg-surface-container-low border-b border-surface-container-highest">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop overflow-x-auto no-scrollbar">
<nav className="flex items-center gap-1 min-w-max py-1.5">
<Link href="#" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Overview</Link>
<Link href="#" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Users</Link>
<Link href="#" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Boats</Link>
<Link href="/brokers/" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Brokers</Link>
<Link href="#" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Service Providers</Link>
<Link href="#" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Service Requests</Link>
<Link href="#" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Leads</Link>
<Link href="#" className="px-3 py-1.5 rounded bg-primary-container text-on-primary font-label-md text-label-md shadow-sm" >Subscriptions</Link>
<Link href="#" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Ads &amp; Banners</Link>
<Link href="#" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Guides &amp; Blog</Link>
<Link href="#" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Analytics</Link>
<Link href="#" className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" >Settings</Link>
</nav>
</div>
</div>

<div className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-2xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="flex flex-col gap-space-xs max-w-3xl">
<div className="inline-flex items-center gap-2">
<span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm uppercase tracking-widest text-[11px]">
            B2B REVENUE &amp; MLS SYNDICATION LICENSING
          </span>
<span className="text-outline text-label-sm uppercase tracking-widest">Directive 2006/112/EC</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          Subscription Tiers &amp; B2B Billing Oversight
        </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
          Supervise active corporate plans, broker tier allocations, recurring revenue, SEPA direct debit mandates, and automatic invoicing under Spanish and European Union VAT compliance protocols.
        </p>
</div>
<div className="flex flex-wrap items-center gap-space-sm shrink-0">
<button className="inline-flex items-center gap-2 px-space-md py-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-title-md text-title-md transition-all shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">receipt_long</span>
          Export Tax Ledger (Factura Ordinaria)
        </button>
<button className="inline-flex items-center gap-2 px-space-md py-space-sm rounded-lg bg-primary text-on-primary hover:bg-primary-container font-title-md text-title-md transition-all shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">add_circle</span>
          + Grant Custom Subscription Plan
        </button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
<div className="flex items-start justify-between">
<div className="flex flex-col">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Monthly Recurring Revenue</span>
<span className="font-display-hero text-headline-lg text-primary tracking-tight mt-1">€68,450</span>
</div>
<div className="w-10 h-10 rounded-lg bg-secondary-fixed/30 flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-[22px]">payments</span>
</div>
</div>
<div className="mt-space-md pt-space-xs flex items-center justify-between text-body-sm">
<span className="inline-flex items-center font-spec-num text-secondary font-semibold gap-0.5">
<span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            +12.4% MoM
          </span>
<span className="text-on-surface-variant">vs. €60,890 previous month</span>
</div>

<div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary opacity-75"></div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
<div className="flex items-start justify-between">
<div className="flex flex-col">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Active Brokerage Entities</span>
<span className="font-display-hero text-headline-lg text-primary tracking-tight mt-1">128</span>
</div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[22px]">corporate_fare</span>
</div>
</div>
<div className="mt-space-md pt-space-xs flex items-center gap-2 text-body-sm text-on-surface-variant flex-wrap">
<span className="bg-surface-container-low px-1.5 py-0.5 rounded text-[11px] font-spec-num font-medium">Boutique: 42</span>
<span className="bg-surface-container-low px-1.5 py-0.5 rounded text-[11px] font-spec-num font-medium text-secondary">Premier: 72</span>
<span className="bg-surface-container-low px-1.5 py-0.5 rounded text-[11px] font-spec-num font-medium text-on-tertiary-container">Sovereign: 14</span>
</div>
<div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-container opacity-75"></div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
<div className="flex items-start justify-between">
<div className="flex flex-col">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Annual Run-Rate (ARR)</span>
<span className="font-display-hero text-headline-lg text-primary tracking-tight mt-1">€821,400</span>
</div>
<div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[22px]">trending_up</span>
</div>
</div>
<div className="mt-space-md pt-space-xs flex items-center justify-between text-body-sm text-on-surface-variant">
<span className="font-spec-num text-primary font-medium">Average B2B Yield: €640/mo</span>
<span className="text-[12px] bg-secondary-fixed/40 text-on-secondary-fixed-variant px-1.5 py-0.5 rounded">98.2% Retention</span>
</div>
<div className="absolute bottom-0 left-0 right-0 h-1 bg-primary opacity-60"></div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
<div className="flex items-start justify-between">
<div className="flex flex-col">
<span className="font-label-sm text-label-sm uppercase text-error tracking-wider font-semibold">Overdue • Grace Period Active</span>
<span className="font-display-hero text-headline-lg text-error tracking-tight mt-1">2 Accounts</span>
</div>
<div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error">
<span className="material-symbols-outlined text-[22px]">warning</span>
</div>
</div>
<div className="mt-space-md pt-space-xs flex items-center justify-between text-body-sm text-on-surface-variant">
<span className="font-spec-num text-error font-medium">€1,780 at default risk</span>
<span className="text-[11px] bg-error-container text-on-error-container px-2 py-0.5 rounded-full font-medium">7 Days Grace Remaining</span>
</div>
<div className="absolute bottom-0 left-0 right-0 h-1 bg-error"></div>
</div>
</div>

<div className="flex flex-col gap-space-md">
<div className="flex items-center justify-between">
<div>
<h2 className="font-headline-sm text-headline-sm text-primary">Corporate Licensing Tiers</h2>
<p className="font-body-md text-body-md text-on-surface-variant">Real-time quotas, syndication feeds, and legal seat distributions across authorized tiers.</p>
</div>
<span className="font-label-md text-label-md text-secondary">3 Active B2B Catalog Tiers</span>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md relative hover:shadow-md transition-all">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Entry Brokerage</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-spec-num text-[12px] font-semibold">42 Agencies</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary">Boutique Broker</h3>
<div className="flex items-baseline gap-1 my-1">
<span className="font-spec-num text-headline-lg font-bold text-primary">€290</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">/ month + IVA</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">Designed for independent yacht brokers in Balearic and Ligurian harbors managing limited luxury inventory.</p>
</div>
<div className="flex flex-col gap-2 pt-space-xs text-body-sm">
<div className="flex items-center justify-between py-1 bg-surface-container-low px-2 rounded">
<span className="text-on-surface-variant">Inventory Limit</span>
<span className="font-spec-num text-primary font-semibold">Max 5 Vessels</span>
</div>
<div className="flex items-center justify-between py-1 bg-surface-container-low px-2 rounded">
<span className="text-on-surface-variant">Authorized Broker Seats</span>
<span className="font-spec-num text-primary font-semibold">2 Seats</span>
</div>
<div className="flex items-center justify-between py-1 bg-surface-container-low px-2 rounded">
<span className="text-on-surface-variant">Syndication / Escrow</span>
<span className="text-on-surface font-medium">Standard Escrow Desk</span>
</div>
</div>
<div className="flex items-center justify-between pt-2">
<span className="text-label-sm text-on-surface-variant font-label-sm uppercase">Monthly Yield: €12,180</span>
<button className="text-secondary hover:text-primary font-label-md text-label-md inline-flex items-center gap-1 font-semibold" type="button">
              Edit Tier Specs <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</button>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md flex flex-col justify-between gap-space-md relative overflow-hidden">
<div className="absolute top-0 right-0 bg-secondary text-on-secondary px-3 py-0.5 rounded-bl-lg font-label-sm text-[10px] tracking-widest uppercase font-semibold">
            Core Fleet Tier (56%)
          </div>
<div className="flex flex-col gap-space-xs">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">Flagship Mediterranean Tier</span>
<span className="px-2 py-0.5 rounded-full bg-secondary-fixed/50 text-on-secondary-fixed-variant font-spec-num text-[12px] font-semibold">72 Agencies</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary">Premier Fleet</h3>
<div className="flex items-baseline gap-1 my-1">
<span className="font-spec-num text-headline-lg font-bold text-primary">€890</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">/ month + IVA</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">High-volume central agencies requiring bidirectional MLS feeds to YachtWorld, Boatshop24, and MYBA Net.</p>
</div>
<div className="flex flex-col gap-2 pt-space-xs text-body-sm">
<div className="flex items-center justify-between py-1 bg-surface-container-low px-2 rounded">
<span className="text-on-surface-variant">Inventory Limit</span>
<span className="font-spec-num text-primary font-semibold">Max 25 Vessels</span>
</div>
<div className="flex items-center justify-between py-1 bg-surface-container-low px-2 rounded">
<span className="text-on-surface-variant">Authorized Broker Seats</span>
<span className="font-spec-num text-primary font-semibold">10 Seats</span>
</div>
<div className="flex items-center justify-between py-1 bg-surface-container-low px-2 rounded">
<span className="text-on-surface-variant">MLS Integration</span>
<span className="text-secondary font-semibold">Full MYBA &amp; YW Sync</span>
</div>
</div>
<div className="flex items-center justify-between pt-2">
<span className="text-label-sm text-on-surface-variant font-label-sm uppercase">Monthly Yield: €64,080</span>
<button className="text-secondary hover:text-primary font-label-md text-label-md inline-flex items-center gap-1 font-semibold" type="button">
              Edit Tier Specs <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</button>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between gap-space-md relative hover:shadow-md transition-all">
<div className="flex flex-col gap-space-xs">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-tertiary-container uppercase tracking-wider font-semibold">Enterprise &amp; Superyacht</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-spec-num text-[12px] font-semibold">14 Agencies</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary">Sovereign Agency</h3>
<div className="flex items-baseline gap-1 my-1">
<span className="font-spec-num text-headline-lg font-bold text-primary">€1,850</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">/ month + IVA</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">Global mega-brokerages requiring custom REST API hooks, escrow escrow officer allocation, and white-label tools.</p>
</div>
<div className="flex flex-col gap-2 pt-space-xs text-body-sm">
<div className="flex items-center justify-between py-1 bg-surface-container-low px-2 rounded">
<span className="text-on-surface-variant">Inventory Limit</span>
<span className="font-spec-num text-primary font-semibold">Unlimited Vessels</span>
</div>
<div className="flex items-center justify-between py-1 bg-surface-container-low px-2 rounded">
<span className="text-on-surface-variant">Authorized Broker Seats</span>
<span className="font-spec-num text-primary font-semibold">Unlimited Global Seats</span>
</div>
<div className="flex items-center justify-between py-1 bg-surface-container-low px-2 rounded">
<span className="text-on-surface-variant">Legal &amp; Webhooks</span>
<span className="text-primary font-semibold">Dedicated Maritime Counsel</span>
</div>
</div>
<div className="flex items-center justify-between pt-2">
<span className="text-label-sm text-on-surface-variant font-label-sm uppercase">Monthly Yield: €25,900</span>
<button className="text-secondary hover:text-primary font-label-md text-label-md inline-flex items-center gap-1 font-semibold" type="button">
              Edit Tier Specs <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</button>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">

<div className="p-space-md bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-md">
<div className="flex flex-wrap items-center gap-space-sm flex-1">
<div className="relative min-w-[280px] flex-1 max-w-md">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">search</span>
<input className="w-full pl-9 pr-3 py-2 bg-surface-container-lowest rounded-lg text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-secondary shadow-sm" placeholder="Search by brokerage name, CIF/NIF, or VAT ID..." type="text"/>
</div>
<div className="flex items-center gap-2">
<select className="px-3 py-2 bg-surface-container-lowest rounded-lg text-body-sm text-on-surface font-label-md focus:outline-none shadow-sm">
<option>All Tiers (3 Active)</option>
<option>Premier Fleet</option>
<option>Boutique Broker</option>
<option>Sovereign Agency</option>
<option>Verified Marine Yard Partner</option>
</select>
<select className="px-3 py-2 bg-surface-container-lowest rounded-lg text-body-sm text-on-surface font-label-md focus:outline-none shadow-sm">
<option>Payment: All Statuses</option>
<option>Active / Valid SEPA</option>
<option>Overdue / Grace Period (2)</option>
<option>Wire / Escrow Advance</option>
</select>
</div>
</div>
<div className="flex items-center gap-space-sm">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Showing 5 of 128 accounts</span>
<button className="p-2 rounded bg-surface-container hover:bg-surface-container-high text-primary transition-colors" title="Reload Ledger" type="button">
<span className="material-symbols-outlined text-[18px]">refresh</span>
</button>
</div>
</div>

<div className="w-full overflow-x-auto">
<table className="w-full text-left text-body-sm">
<thead className="bg-surface-container text-on-surface-variant font-label-sm uppercase tracking-wider text-[11px]">
<tr>
<th className="py-3 px-space-md font-semibold">Subscribed Entity / CIF</th>
<th className="py-3 px-space-md font-semibold">Tier &amp; Billing Cycle</th>
<th className="py-3 px-space-md font-semibold">Capacity &amp; Seats</th>
<th className="py-3 px-space-md font-semibold">Recurring Fee &amp; Renewal</th>
<th className="py-3 px-space-md font-semibold">Payment Mandate</th>
<th className="py-3 px-space-md font-semibold">VIES / Tax Compliance</th>
<th className="py-3 px-space-md font-semibold text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container-highest">

<tr className="hover:bg-surface-container-low/60 transition-colors">
<td className="py-4 px-space-md">
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold">Marina Balear Yachting S.L.</span>
<div className="flex items-center gap-1.5 text-on-surface-variant font-spec-num text-[12px] mt-0.5">
<span className="font-medium text-primary">ES-B07892104</span>
<span>•</span>
<span>Port Adriano, Mallorca</span>
</div>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col gap-0.5">
<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-fixed/50 text-on-secondary-fixed-variant text-[11px] font-label-sm font-semibold w-max">
                    Premier Fleet Tier
                  </span>
<span className="text-on-surface-variant text-[12px]">Annual Billing (-15% pre-paid)</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col gap-1">
<div className="flex items-center justify-between text-[12px]">
<span className="font-spec-num text-primary font-semibold">18 / 25 Vessels</span>
<span className="text-on-surface-variant">72% load</span>
</div>
<div className="w-28 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "72%"}}></div>
</div>
<span className="text-[11px] text-on-surface-variant">6 of 10 Agent Seats Active</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col">
<span className="font-spec-num text-title-md font-semibold text-primary">€10,680.00 <span className="text-[12px] font-normal text-on-surface-variant">/ yr</span></span>
<span className="text-[12px] text-on-surface-variant">Renews 15 Jan 2026</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col">
<div className="inline-flex items-center gap-1.5 text-primary font-medium text-[12px]">
<span className="material-symbols-outlined text-[16px] text-secondary">account_balance</span>
                    Banco Santander B2B SEPA
                  </div>
<span className="text-[11px] text-secondary font-label-sm font-semibold">Mandate ES-9014-ACTIVE</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container text-primary font-label-sm text-[11px]">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
                  VIES Valid (Spain VAT 21%)
                </div>
</td>
<td className="py-4 px-space-md text-right">
<div className="flex items-center justify-end gap-1.5">
<button className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md transition-all shadow-sm" type="button">
                    Manage Tier
                  </button>
<button className="p-1 rounded text-on-surface-variant hover:text-primary transition-colors" title="View Invoices" type="button">
<span className="material-symbols-outlined text-[20px]">description</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/60 transition-colors">
<td className="py-4 px-space-md">
<div className="flex flex-col">
<div className="flex items-center gap-1.5">
<span className="font-title-md text-primary font-semibold">Fraser Yachts Monaco</span>
<span className="w-2 h-2 rounded-full bg-secondary" title="Enterprise Priority"></span>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-spec-num text-[12px] mt-0.5">
<span className="font-medium text-primary">FR-09412899</span>
<span>•</span>
<span>Port Hercule, Monaco</span>
</div>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col gap-0.5">
<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-container text-on-primary text-[11px] font-label-sm font-semibold w-max">
                    Sovereign Agency Tier
                  </span>
<span className="text-on-surface-variant text-[12px]">Monthly Corporate Cycle</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col gap-1">
<div className="flex items-center justify-between text-[12px]">
<span className="font-spec-num text-primary font-semibold">58 Vessels</span>
<span className="text-secondary font-medium">Unlimited Cap</span>
</div>
<div className="w-28 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{"width": "100%"}}></div>
</div>
<span className="text-[11px] text-on-surface-variant">18 Broker Seats (Unlimited)</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col">
<span className="font-spec-num text-title-md font-semibold text-primary">€1,850.00 <span className="text-[12px] font-normal text-on-surface-variant">/ mo</span></span>
<span className="text-[12px] text-on-surface-variant">Renews 01 Jun 2025</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col">
<div className="inline-flex items-center gap-1.5 text-primary font-medium text-[12px]">
<span className="material-symbols-outlined text-[16px] text-on-surface-variant">assured_workload</span>
                    Intl Wire / Escrow Trust
                  </div>
<span className="text-[11px] text-on-surface-variant font-label-sm">Standard 30-Day Terms</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-secondary-fixed/30 text-on-secondary-fixed-variant font-label-sm text-[11px]">
<span className="material-symbols-outlined text-[14px]">shield</span>
                  VIES Reverse Charge (0%)
                </div>
</td>
<td className="py-4 px-space-md text-right">
<div className="flex items-center justify-end gap-1.5">
<button className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md transition-all shadow-sm" type="button">
                    Manage Tier
                  </button>
<button className="p-1 rounded text-on-surface-variant hover:text-primary transition-colors" title="View Invoices" type="button">
<span className="material-symbols-outlined text-[20px]">description</span>
</button>
</div>
</td>
</tr>

<tr className="bg-error-container/20 hover:bg-error-container/30 transition-colors">
<td className="py-4 px-space-md">
<div className="flex flex-col">
<div className="flex items-center gap-1.5">
<span className="font-title-md text-primary font-semibold">Nautica Balear Charter &amp; Sales</span>
<span className="inline-flex items-center px-1.5 py-0.2 rounded bg-error text-on-error text-[10px] font-label-sm">Dunning</span>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-spec-num text-[12px] mt-0.5">
<span className="font-medium text-primary">ES-B07921443</span>
<span>•</span>
<span>Marina Palma Cuarentena</span>
</div>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col gap-0.5">
<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-label-sm font-semibold w-max">
                    Boutique Broker Tier
                  </span>
<span className="text-error text-[12px] font-medium">Grace Period • Expiring 4 Days</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col gap-1">
<div className="flex items-center justify-between text-[12px]">
<span className="font-spec-num text-error font-bold">9 Vessels</span>
<span className="text-error text-[11px] font-semibold">Limit 5 Exceeded</span>
</div>
<div className="w-28 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
<div className="bg-error h-full rounded-full" style={{"width": "100%"}}></div>
</div>
<span className="text-[11px] text-error font-medium">Upgrade Required for Feed Sync</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col">
<span className="font-spec-num text-title-md font-semibold text-error">€290.00 <span className="text-[12px] font-normal text-on-surface-variant">/ mo</span></span>
<span className="text-[12px] text-error font-medium">Failed on 12 May 2025</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col">
<div className="inline-flex items-center gap-1.5 text-error font-medium text-[12px]">
<span className="material-symbols-outlined text-[16px]">credit_card_off</span>
                    Visa Corporate •• 4018
                  </div>
<span className="text-[11px] text-error font-label-sm font-medium">Declined: Expired Mandate</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container text-on-surface-variant font-label-sm text-[11px]">
<span>Spanish IVA (21%) Applied</span>
</div>
</td>
<td className="py-4 px-space-md text-right">
<div className="flex items-center justify-end gap-1.5">
<button className="px-2.5 py-1 rounded bg-error text-on-error hover:bg-error/90 font-label-md text-label-md transition-all shadow-sm" type="button">
                    Resolve Payment
                  </button>
<button className="p-1 rounded text-error hover:bg-error/10 transition-colors" title="Send Dunning Notice" type="button">
<span className="material-symbols-outlined text-[20px]">forward_to_inbox</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/60 transition-colors">
<td className="py-4 px-space-md">
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold">Costa Smeralda Yacht Brokers</span>
<div className="flex items-center gap-1.5 text-on-surface-variant font-spec-num text-[12px] mt-0.5">
<span className="font-medium text-primary">IT-02839180901</span>
<span>•</span>
<span>Porto Cervo, Sardinia</span>
</div>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col gap-0.5">
<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-fixed/50 text-on-secondary-fixed-variant text-[11px] font-label-sm font-semibold w-max">
                    Premier Fleet Tier
                  </span>
<span className="text-on-surface-variant text-[12px]">Monthly Recurring Cycle</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col gap-1">
<div className="flex items-center justify-between text-[12px]">
<span className="font-spec-num text-primary font-semibold">14 / 25 Vessels</span>
<span className="text-on-surface-variant">56% load</span>
</div>
<div className="w-28 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "56%"}}></div>
</div>
<span className="text-[11px] text-on-surface-variant">4 of 10 Seats Active</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col">
<span className="font-spec-num text-title-md font-semibold text-primary">€890.00 <span className="text-[12px] font-normal text-on-surface-variant">/ mo</span></span>
<span className="text-[12px] text-on-surface-variant">Renews 12 Jun 2025</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col">
<div className="inline-flex items-center gap-1.5 text-primary font-medium text-[12px]">
<span className="material-symbols-outlined text-[16px] text-secondary">account_balance</span>
                    Intesa Sanpaolo SEPA B2B
                  </div>
<span className="text-[11px] text-secondary font-label-sm font-semibold">Mandate IT-8902-ACTIVE</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-secondary-fixed/30 text-on-secondary-fixed-variant font-label-sm text-[11px]">
<span className="material-symbols-outlined text-[14px]">verified</span>
                  VIES Cross-Border (IT)
                </div>
</td>
<td className="py-4 px-space-md text-right">
<div className="flex items-center justify-end gap-1.5">
<button className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md transition-all shadow-sm" type="button">
                    Manage Tier
                  </button>
<button className="p-1 rounded text-on-surface-variant hover:text-primary transition-colors" title="View Invoices" type="button">
<span className="material-symbols-outlined text-[20px]">description</span>
</button>
</div>
</td>
</tr>

<tr className="hover:bg-surface-container-low/60 transition-colors">
<td className="py-4 px-space-md">
<div className="flex flex-col">
<span className="font-title-md text-primary font-semibold">Talleres Navales del Mediterráneo</span>
<div className="flex items-center gap-1.5 text-on-surface-variant font-spec-num text-[12px] mt-0.5">
<span className="font-medium text-primary">ES-B07992140</span>
<span>•</span>
<span>Valencia Shipyard Zone</span>
</div>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col gap-0.5">
<span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high text-primary text-[11px] font-label-sm font-semibold w-max">
                    Verified Yard Annual Partner
                  </span>
<span className="text-on-surface-variant text-[12px]">Annual Direct Debit</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col gap-1">
<div className="flex items-center justify-between text-[12px]">
<span className="font-spec-num text-primary font-semibold">Unlimited RFQs</span>
<span className="text-secondary font-medium">Yard Verified</span>
</div>
<div className="w-28 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
<div className="bg-primary-container h-full rounded-full" style={{"width": "100%"}}></div>
</div>
<span className="text-[11px] text-on-surface-variant">14 Certified Marine Mechanics</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col">
<span className="font-spec-num text-title-md font-semibold text-primary">€3,400.00 <span className="text-[12px] font-normal text-on-surface-variant">/ yr</span></span>
<span className="text-[12px] text-on-surface-variant">Renews 18 Nov 2025</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="flex flex-col">
<div className="inline-flex items-center gap-1.5 text-primary font-medium text-[12px]">
<span className="material-symbols-outlined text-[16px] text-secondary">account_balance</span>
                    CaixaBank Direct Debit
                  </div>
<span className="text-[11px] text-secondary font-label-sm font-semibold">Mandate ES-3329-ACTIVE</span>
</div>
</td>
<td className="py-4 px-space-md">
<div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container text-primary font-label-sm text-[11px]">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
                  VIES Valid (Spain VAT 21%)
                </div>
</td>
<td className="py-4 px-space-md text-right">
<div className="flex items-center justify-end gap-1.5">
<button className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md transition-all shadow-sm" type="button">
                    Manage Tier
                  </button>
<button className="p-1 rounded text-on-surface-variant hover:text-primary transition-colors" title="View Invoices" type="button">
<span className="material-symbols-outlined text-[20px]">description</span>
</button>
</div>
</td>
</tr>
</tbody>
</table>
</div>

<div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-2">
<span className="text-on-surface-variant font-label-sm uppercase text-[11px]">Rows per ledger page:</span>
<select className="bg-surface-container-lowest px-2 py-1 rounded text-on-surface font-spec-num text-[12px] shadow-sm">
<option>10</option>
<option>25</option>
<option>50</option>
</select>
<span className="text-on-surface-variant text-[12px]">Page 1 of 13</span>
</div>
<div className="flex items-center gap-1">
<button className="p-1.5 rounded bg-surface-container text-on-surface-variant hover:text-primary disabled:opacity-50" disabled type="button">
<span className="material-symbols-outlined text-[18px]">chevron_left</span>
</button>
<button className="px-3 py-1 rounded bg-primary text-on-primary font-label-md text-label-md" type="button">1</button>
<button className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md" type="button">2</button>
<button className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md" type="button">3</button>
<span className="px-1 text-on-surface-variant">•••</span>
<button className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md" type="button">13</button>
<button className="p-1.5 rounded bg-surface-container text-on-surface-variant hover:text-primary" type="button">
<span className="material-symbols-outlined text-[18px]">chevron_right</span>
</button>
</div>
</div>
</div>

<div className="bg-primary-container text-on-primary rounded-xl p-space-lg shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg relative overflow-hidden">
<div className="flex items-start gap-space-md">
<div className="w-12 h-12 rounded-lg bg-surface-container-lowest/10 flex items-center justify-center shrink-0 text-secondary-fixed">
<span className="material-symbols-outlined text-[28px]">gavel</span>
</div>
<div className="flex flex-col gap-1 max-w-2xl">
<div className="flex items-center gap-2">
<span className="font-label-sm text-secondary-fixed text-[11px] uppercase tracking-wider font-semibold">
              Legal Compliance Architecture
            </span>
<span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed"></span>
<span className="text-on-primary-container text-[12px]">Council Directive 2006/112/EC &amp; Real Decreto 1619/2012</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-on-primary">
            EU Cross-Border Digital Services &amp; Marine Notary Withholding
          </h3>
<p className="font-body-sm text-body-sm text-on-primary-container">
            All recurring B2B subscriptions automatically execute real-time VIES database validation prior to debiting. Reverse charge exemptions applied strictly to non-resident EU operators with qualified corporate maritime licensing.
          </p>
</div>
</div>
<div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-start md:items-end gap-space-sm shrink-0">
<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-lowest/15 text-on-primary text-label-sm font-label-sm">
<span className="w-2 h-2 rounded-full bg-secondary-fixed animate-ping"></span>
          AEAT (Spain) &amp; Agenzia delle Entrate (Italy): <strong className="text-secondary-fixed">ACTIVE</strong>
</div>
<button className="inline-flex items-center gap-1.5 px-space-md py-2 rounded-lg bg-secondary text-on-secondary hover:bg-secondary-fixed hover:text-on-secondary-fixed font-label-md text-label-md transition-all shadow-sm" type="button">
<span className="material-symbols-outlined text-[16px]">verified_user</span>
          Run Manual VIES Batch Audit
        </button>
</div>
</div>
</div>
</div>

      </RequirePermission>
    </main>
  );
}
