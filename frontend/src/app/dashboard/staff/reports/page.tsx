import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function StaffReports() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission permission="configure_products_and_settings">
<div className="flex flex-col w-full">

<div className="w-full bg-surface-container-low shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop overflow-x-auto no-scrollbar">
<div className="flex items-center gap-space-xs py-space-xs min-w-max text-body-sm font-body-sm text-on-surface-variant">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-highest text-primary font-label-md text-label-md tracking-wider mr-space-xs uppercase">
<span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span> Staff Console
        </span>
<Link href="#" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Overview</Link>
<Link href="#" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Users</Link>
<Link href="#" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Boats</Link>
<Link href="/brokers/" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Brokers</Link>
<Link href="#" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Service Providers</Link>
<Link href="#" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Service Requests</Link>
<Link href="#" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Leads</Link>
<Link href="#" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Subscriptions</Link>
<Link href="#" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Ads &amp; Banners</Link>
<Link href="#" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Guides &amp; Blog</Link>

<Link href="#" className="px-3 py-1.5 rounded bg-primary text-on-primary font-semibold shadow-sm flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[16px]">query_stats</span>
          Analytics
        </Link>
<Link href="#" className="px-3 py-1.5 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant" >Settings</Link>
</div>
</div>
</div>

<div className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-xl">

<div className="relative overflow-hidden bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl shadow-sm">
<div className="absolute -right-20 -top-24 w-96 h-96 rounded-full bg-secondary/5 blur-3xl pointer-events-none"></div>
<div className="absolute right-1/3 bottom-0 w-64 h-32 rounded-full bg-surface-tint/5 blur-2xl pointer-events-none"></div>
<div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="max-w-3xl flex flex-col gap-space-xs">
<div className="flex items-center gap-2">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">Maritime Financial Governance</span>
<span className="text-outline-variant">·</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Audited Daily Ledger</span>
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-secondary-fixed text-on-secondary-fixed font-medium">Santander &amp; Intesa Live</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Financial Intelligence, Marketplace GMV &amp; Escrow Analytics</h1>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Supervise platform transaction velocity, brokerage commissions, escrow yields, subscription recurring revenue, and territorial liquidity across Spain, Italy, and the Western Mediterranean.
          </p>
</div>

<div className="bg-surface-container-low rounded-lg p-space-md flex items-center gap-space-md shrink-0 shadow-sm">
<div className="w-10 h-10 rounded-full bg-secondary-fixed-dim text-on-secondary-fixed flex items-center justify-center">
<span className="material-symbols-outlined text-[22px]">verified_user</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Escrow Integrity</span>
<span className="font-title-md text-title-md text-primary font-semibold">100% Segregated</span>
<span className="font-body-sm text-body-sm text-secondary font-medium">0 Unreconciled Discrepancies</span>
</div>
</div>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">Gross Merchandise Value (YTD)</span>
<span className="p-1.5 rounded-full bg-surface-container text-primary material-symbols-outlined text-[18px]">anchor</span>
</div>
<div className="my-space-sm flex flex-col">
<div className="flex items-baseline gap-space-xs">
<span className="font-headline-lg text-headline-lg text-primary tracking-tight font-headline-lg">€142.8M</span>
<span className="font-label-md text-label-md text-secondary font-medium flex items-center">
<span className="material-symbols-outlined text-[14px]">trending_up</span> +34.8% y/y
            </span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Vessel sales under Nauta notarized escrow</span>
</div>
<div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{"width": "78%"}}></div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">Platform Net Revenue (Q2)</span>
<span className="p-1.5 rounded-full bg-surface-container text-secondary material-symbols-outlined text-[18px]">payments</span>
</div>
<div className="my-space-sm flex flex-col">
<div className="flex items-baseline gap-space-xs">
<span className="font-headline-lg text-headline-lg text-primary tracking-tight font-headline-lg">€348,200</span>
<span className="font-label-md text-label-md text-secondary font-medium flex items-center">
<span className="material-symbols-outlined text-[14px]">arrow_upward</span> +22.5% vs Q1
            </span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Take-rates, SaaS &amp; marine RFQ commissions</span>
</div>
<div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "64%"}}></div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">Active In-Escrow Deposits</span>
<span className="p-1.5 rounded-full bg-surface-container text-tertiary-fixed-dim material-symbols-outlined text-[18px]">account_balance</span>
</div>
<div className="my-space-sm flex flex-col">
<div className="flex items-baseline gap-space-xs">
<span className="font-headline-lg text-headline-lg text-primary tracking-tight font-headline-lg">€64.2M</span>
<span className="font-label-md text-label-md text-on-surface-variant font-medium">38 Vessels</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Held with Banco Santander &amp; Intesa Sanpaolo</span>
</div>
<div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
<div className="bg-on-tertiary-container h-full rounded-full" style={{"width": "82%"}}></div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">Escrow Completion Rate</span>
<span className="p-1.5 rounded-full bg-surface-container text-secondary material-symbols-outlined text-[18px]">fact_check</span>
</div>
<div className="my-space-sm flex flex-col">
<div className="flex items-baseline gap-space-xs">
<span className="font-headline-lg text-headline-lg text-primary tracking-tight font-headline-lg">96.4%</span>
<span className="font-label-md text-label-md text-secondary font-medium">Optimal</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">3.2 day avg notary settlement speed</span>
</div>
<div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "96.4%"}}></div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-space-md">

<div className="flex flex-wrap items-center gap-space-sm">

<div className="flex items-center bg-surface-container-low rounded-lg px-3 py-2 text-on-surface gap-2 cursor-pointer shadow-sm hover:bg-surface-container transition-colors">
<span className="material-symbols-outlined text-secondary text-[18px]">calendar_today</span>
<div className="flex flex-col text-left">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Timeframe</span>
<span className="font-body-sm text-body-sm font-semibold text-primary">Q2 2025 (Apr 1 – Jun 30)</span>
</div>
<span className="material-symbols-outlined text-on-surface-variant text-[16px] ml-1">expand_more</span>
</div>

<div className="flex items-center bg-surface-container-low rounded-lg px-3 py-2 text-on-surface gap-2 cursor-pointer shadow-sm hover:bg-surface-container transition-colors">
<span className="material-symbols-outlined text-secondary text-[18px]">explore</span>
<div className="flex flex-col text-left">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Territory</span>
<span className="font-body-sm text-body-sm font-semibold text-primary">Western Mediterranean (All)</span>
</div>
<span className="material-symbols-outlined text-on-surface-variant text-[16px] ml-1">expand_more</span>
</div>

<div className="inline-flex items-center p-1 rounded-lg bg-surface-container-low font-label-md text-label-md">
<button className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-semibold shadow-xs transition-all" type="button">EUR (€)</button>
<button className="px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface transition-all" type="button">GBP (£)</button>
<button className="px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface transition-all" type="button">USD ($)</button>
</div>
</div>

<div className="flex flex-wrap items-center gap-space-sm shrink-0">
<button className="inline-flex items-center gap-1.5 bg-surface-container-low hover:bg-surface-container text-primary font-body-sm text-body-sm font-semibold px-space-md py-2.5 rounded-lg transition-colors shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">table_view</span>
          Export Financial Ledger (XLSX/PDF)
        </button>
<button className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold px-space-md py-2.5 rounded-lg transition-colors shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
          Generate Auditor Report (Factura Ordinaria)
        </button>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">

<div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-md">
<div>
<div className="flex items-center gap-2">
<span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
<h2 className="font-headline-sm text-headline-sm text-primary">Transaction Volume &amp; Revenue Breakdown (Monthly)</h2>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Escrow settlement throughput matched with platform monetization streams</p>
</div>
<div className="flex items-center gap-3">
<span className="font-label-sm text-label-sm text-on-surface-variant">Aggregation: Monthly</span>
<span className="px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-primary font-semibold">EUR Net</span>
</div>
</div>

<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-space-lg">
<div className="bg-surface-container-low p-2.5 rounded-lg">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-primary"></span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Escrow Closings</span>
</div>
<span className="font-spec-num text-spec-num text-primary font-semibold block mt-0.5">€198.6k /mo</span>
</div>
<div className="bg-surface-container-low p-2.5 rounded-lg">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Broker Subs</span>
</div>
<span className="font-spec-num text-spec-num text-primary font-semibold block mt-0.5">€68.4k /mo</span>
</div>
<div className="bg-surface-container-low p-2.5 rounded-lg">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-surface-tint"></span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Service RFQs</span>
</div>
<span className="font-spec-num text-spec-num text-primary font-semibold block mt-0.5">€42.8k /mo</span>
</div>
<div className="bg-surface-container-low p-2.5 rounded-lg">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Media Sponsorships</span>
</div>
<span className="font-spec-num text-spec-num text-primary font-semibold block mt-0.5">€38.4k /mo</span>
</div>
</div>

<div className="w-full h-72 relative flex items-end">
<svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 740 240">
<defs>
<linearGradient id="areaGradientPrimary" x1="0" x2="0" y1="0" y2="1">
<stop offset="0%" stopColor="#001520" stopOpacity="0.18"></stop>
<stop offset="100%" stopColor="#001520" stopOpacity="0.0"></stop>
</linearGradient>
<linearGradient id="areaGradientTeal" x1="0" x2="0" y1="0" y2="1">
<stop offset="0%" stopColor="#00696e" stopOpacity="0.25"></stop>
<stop offset="100%" stopColor="#00696e" stopOpacity="0.0"></stop>
</linearGradient>
</defs>

<line stroke="#eae8e3" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="740" y1="20" y2="20"></line>
<line stroke="#eae8e3" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="740" y1="80" y2="80"></line>
<line stroke="#eae8e3" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="740" y1="140" y2="140"></line>
<line stroke="#eae8e3" strokeWidth="1" x1="0" x2="740" y1="200" y2="200"></line>

<path d="M 40 180 Q 150 140 260 120 T 480 70 T 700 35 L 700 200 L 40 200 Z" fill="url(#areaGradientTeal)"></path>
<path d="M 40 180 Q 150 140 260 120 T 480 70 T 700 35" fill="none" stroke="#00696e" strokeLinecap="round" strokeWidth="2.5"></path>


<g transform="translate(60, 0)">
<rect fill="#001520" height="40" rx="3" width="28" x="0" y="160"></rect>
<rect fill="#00696e" height="15" rx="2" width="28" x="0" y="145"></rect>
<rect fill="#496171" height="10" rx="2" width="28" x="0" y="135"></rect>
<rect fill="#e3c286" height="7" rx="2" width="28" x="0" y="128"></rect>
</g>

<g transform="translate(180, 0)">
<rect fill="#001520" height="60" rx="3" width="28" x="0" y="140"></rect>
<rect fill="#00696e" height="18" rx="2" width="28" x="0" y="122"></rect>
<rect fill="#496171" height="12" rx="2" width="28" x="0" y="110"></rect>
<rect fill="#e3c286" height="8" rx="2" width="28" x="0" y="102"></rect>
</g>

<g transform="translate(300, 0)">
<rect fill="#001520" height="80" rx="3" width="28" x="0" y="120"></rect>
<rect fill="#00696e" height="22" rx="2" width="28" x="0" y="98"></rect>
<rect fill="#496171" height="13" rx="2" width="28" x="0" y="85"></rect>
<rect fill="#e3c286" height="9" rx="2" width="28" x="0" y="76"></rect>
</g>

<g transform="translate(420, 0)">
<rect fill="#001520" height="100" rx="3" width="28" x="0" y="100"></rect>
<rect fill="#00696e" height="26" rx="2" width="28" x="0" y="74"></rect>
<rect fill="#496171" height="16" rx="2" width="28" x="0" y="58"></rect>
<rect fill="#e3c286" height="11" rx="2" width="28" x="0" y="47"></rect>
</g>

<g transform="translate(540, 0)">
<rect fill="#001520" height="115" rx="3" width="28" x="0" y="85"></rect>
<rect fill="#00696e" height="29" rx="2" width="28" x="0" y="56"></rect>
<rect fill="#496171" height="18" rx="2" width="28" x="0" y="38"></rect>
<rect fill="#e3c286" height="13" rx="2" width="28" x="0" y="25"></rect>
</g>

<g transform="translate(660, 0)">
<rect fill="#001520" height="130" rx="3" width="28" x="0" y="70"></rect>
<rect fill="#00696e" height="32" rx="2" width="28" x="0" y="38"></rect>
<rect fill="#496171" height="20" rx="2" width="28" x="0" y="18"></rect>
<rect fill="#e3c286" height="14" rx="2" width="28" x="0" y="4"></rect>
</g>

<circle cx="674" cy="35" fill="#00696e" r="4" stroke="#ffffff" strokeWidth="2"></circle>
<rect fill="#102a38" height="20" rx="4" width="108" x="620" y="-18"></rect>
<text fill="#ffffff" font-family="Plus Jakarta Sans" font-size="10" font-weight="600" text-anchor="middle" x="674" y="-4">Peak €348.2k /mo</text>
</svg>
</div>

<div className="grid grid-cols-6 pt-space-xs text-center font-label-md text-label-md text-on-surface-variant font-medium">
<span>Jan 2025</span>
<span>Feb 2025</span>
<span>Mar 2025</span>
<span>Apr 2025</span>
<span>May 2025</span>
<span className="text-primary font-bold">Jun 2025 (Current)</span>
</div>

<div className="mt-space-md pt-space-sm border-t border-surface-container flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
<span>*Includes escrow take (1.2% avg) on closing, recurrent brokerage CRM SaaS, and vetted survey leads.</span>
<Link href="#" className="text-secondary hover:underline font-semibold flex items-center gap-1" >
            Reconcile Notary Logs <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</Link>
</div>
</div>

<div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="flex items-center justify-between mb-space-xs">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">Territorial Distribution</span>
<span className="material-symbols-outlined text-on-surface-variant text-[18px]">public</span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary">Territorial Market Liquidity</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Capital distribution across key Mediterranean maritime hubs</p>
</div>

<div className="relative w-48 h-48 mx-auto my-space-md flex items-center justify-center">
<svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">


<circle cx="80" cy="80" fill="transparent" r="60" stroke="#001520" strokeDasharray="165.87 377" strokeDashoffset="0" strokeWidth="20"></circle>

<circle cx="80" cy="80" fill="transparent" r="60" stroke="#00696e" strokeDasharray="105.55 377" strokeDashoffset="-165.87" strokeWidth="20"></circle>

<circle cx="80" cy="80" fill="transparent" r="60" stroke="#496171" strokeDasharray="60.31 377" strokeDashoffset="-271.42" strokeWidth="20"></circle>

<circle cx="80" cy="80" fill="transparent" r="60" stroke="#e3c286" strokeDasharray="45.23 377" strokeDashoffset="-331.73" strokeWidth="20"></circle>
</svg>

<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
<span className="font-spec-num text-spec-num font-bold text-primary">€142.8M</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Active GMV</span>
</div>
</div>

<div className="flex flex-col gap-space-xs">
<div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2">
<span className="w-3 h-3 rounded-full bg-primary shrink-0"></span>
<span className="font-body-sm text-body-sm text-primary font-medium">Balearic Islands (ES)</span>
</div>
<div className="text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">44%</span>
<span className="font-label-sm text-label-sm text-on-surface-variant block">€62.8M</span>
</div>
</div>
<div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2">
<span className="w-3 h-3 rounded-full bg-secondary shrink-0"></span>
<span className="font-body-sm text-body-sm text-primary font-medium">Liguria &amp; Italian Riviera (IT)</span>
</div>
<div className="text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">28%</span>
<span className="font-label-sm text-label-sm text-on-surface-variant block">€40.0M</span>
</div>
</div>
<div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2">
<span className="w-3 h-3 rounded-full bg-surface-tint shrink-0"></span>
<span className="font-body-sm text-body-sm text-primary font-medium">Costa Smeralda &amp; Tyrrhenian</span>
</div>
<div className="text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">16%</span>
<span className="font-label-sm text-label-sm text-on-surface-variant block">€22.8M</span>
</div>
</div>
<div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2">
<span className="w-3 h-3 rounded-full bg-tertiary-fixed-dim shrink-0"></span>
<span className="font-body-sm text-body-sm text-primary font-medium">French Riviera &amp; Monaco</span>
</div>
<div className="text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">12%</span>
<span className="font-label-sm text-label-sm text-on-surface-variant block">€17.2M</span>
</div>
</div>
</div>
<button className="mt-space-md w-full py-2 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary font-label-md text-label-md font-semibold transition-colors flex items-center justify-center gap-1.5" type="button">
<span className="material-symbols-outlined text-[16px]">map</span>
          View Geospatial Liquidity Heatmap
        </button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
<div className="p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-md bg-surface-container-low">
<div className="flex flex-col">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[22px]">location_searching</span>
<h2 className="font-headline-sm text-headline-sm text-primary">Key Regional Hub Performance &amp; Escrow Yields</h2>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">Live audit of nautical listings volume, closing velocity, take-rates, and notary risk profiles</p>
</div>
<div className="flex items-center gap-space-xs">
<div className="relative">
<input className="bg-surface-container-lowest text-on-surface font-body-sm text-body-sm px-3 py-1.5 pl-8 rounded-lg shadow-inner outline-none focus:ring-1 focus:ring-secondary w-56" placeholder="Filter by port or marina..." type="text"/>
<span className="material-symbols-outlined text-outline text-[16px] absolute left-2.5 top-2">search</span>
</div>
<button className="p-2 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:text-primary transition-colors shadow-xs" type="button">
<span className="material-symbols-outlined text-[18px]">tune</span>
</button>
</div>
</div>

<div className="overflow-x-auto w-full">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-surface-container text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
<th className="py-3 px-space-md">Regional Nautical Hub</th>
<th className="py-3 px-space-md text-right">Active Listings</th>
<th className="py-3 px-space-md text-right">Escrow GMV</th>
<th className="py-3 px-space-md text-right">Escrow Turnaround</th>
<th className="py-3 px-space-md text-right">Platform Take</th>
<th className="py-3 px-space-md text-center">Risk Index</th>
<th className="py-3 px-space-md text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container font-body-sm text-body-sm text-on-surface">

<tr className="hover:bg-surface-container-low transition-colors group">
<td className="py-space-md px-space-md">
<div className="flex items-center gap-space-sm">
<div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary font-bold">
<span className="material-symbols-outlined text-[18px]">sailing</span>
</div>
<div>
<span className="font-title-md text-title-md text-primary font-semibold block">Palma de Mallorca &amp; Port Adriano</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Balearic Command Center · Spain</span>
</div>
</div>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">412</span>
<span className="block text-label-sm font-label-sm text-secondary">+14 this week</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">€58.4M</span>
<span className="block text-label-sm font-label-sm text-on-surface-variant">40.9% of Total</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">4.1 days</span>
<span className="block text-label-sm font-label-sm text-secondary">Santander Notary API</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">€124,500</span>
<span className="block text-label-sm font-label-sm text-secondary font-medium">+18.4%</span>
</td>
<td className="py-space-md px-space-md text-center">
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-label-sm bg-secondary-container text-on-secondary-container font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Low (0.2%)
                </span>
</td>
<td className="py-space-md px-space-md text-right">
<button className="px-2.5 py-1.5 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary transition-all font-label-md text-label-md font-semibold" type="button">
                  Audit Hub
                </button>
</td>
</tr>

<tr className="hover:bg-surface-container-low transition-colors group">
<td className="py-space-md px-space-md">
<div className="flex items-center gap-space-sm">
<div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary font-bold">
<span className="material-symbols-outlined text-[18px]">directions_boat</span>
</div>
<div>
<span className="font-title-md text-title-md text-primary font-semibold block">Genoa &amp; Portofino (Liguria)</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Tirreno Marittimo Node · Italy</span>
</div>
</div>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">284</span>
<span className="block text-label-sm font-label-sm text-secondary">+8 this week</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">€39.2M</span>
<span className="block text-label-sm font-label-sm text-on-surface-variant">27.4% of Total</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">3.8 days</span>
<span className="block text-label-sm font-label-sm text-secondary">Intesa FastTrack</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">€88,200</span>
<span className="block text-label-sm font-label-sm text-secondary font-medium">+14.2%</span>
</td>
<td className="py-space-md px-space-md text-center">
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-label-sm bg-secondary-container text-on-secondary-container font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Low (0.1%)
                </span>
</td>
<td className="py-space-md px-space-md text-right">
<button className="px-2.5 py-1.5 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary transition-all font-label-md text-label-md font-semibold" type="button">
                  Audit Hub
                </button>
</td>
</tr>

<tr className="hover:bg-surface-container-low transition-colors group">
<td className="py-space-md px-space-md">
<div className="flex items-center gap-space-sm">
<div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary font-bold">
<span className="material-symbols-outlined text-[18px]">deck</span>
</div>
<div>
<span className="font-title-md text-title-md text-primary font-semibold block">Porto Cervo &amp; Olbia (Sardinia)</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Costa Smeralda Luxury Terminal · Italy</span>
</div>
</div>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">146</span>
<span className="block text-label-sm font-label-sm text-on-surface-variant font-medium">Megayacht bias</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">€26.8M</span>
<span className="block text-label-sm font-label-sm text-on-surface-variant">High Avg Ticket (€1.8M)</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">4.6 days</span>
<span className="block text-label-sm font-label-sm text-on-surface-variant">Flag Registry Transfer</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">€62,400</span>
<span className="block text-label-sm font-label-sm text-secondary font-medium">+29.1%</span>
</td>
<td className="py-space-md px-space-md text-center">
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-label-sm bg-surface-container-high text-primary font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-outline"></span> Minimal
                </span>
</td>
<td className="py-space-md px-space-md text-right">
<button className="px-2.5 py-1.5 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary transition-all font-label-md text-label-md font-semibold" type="button">
                  Audit Hub
                </button>
</td>
</tr>

<tr className="hover:bg-surface-container-low transition-colors group">
<td className="py-space-md px-space-md">
<div className="flex items-center gap-space-sm">
<div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-primary font-bold">
<span className="material-symbols-outlined text-[18px]">location_city</span>
</div>
<div>
<span className="font-title-md text-title-md text-primary font-semibold block">Barcelona Port Vell &amp; Marina Vela</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Catalan Commercial Cluster · Spain</span>
</div>
</div>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">198</span>
<span className="block text-label-sm font-label-sm text-secondary">+19 this week</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">€18.4M</span>
<span className="block text-label-sm font-label-sm text-on-surface-variant">12.9% of Total</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">3.4 days</span>
<span className="block text-label-sm font-label-sm text-secondary font-medium">Fastest In Network</span>
</td>
<td className="py-space-md px-space-md text-right">
<span className="font-spec-num text-spec-num font-semibold text-primary">€43,100</span>
<span className="block text-label-sm font-label-sm text-secondary font-medium">+8.7%</span>
</td>
<td className="py-space-md px-space-md text-center">
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-label-sm bg-secondary-container text-on-secondary-container font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Low
                </span>
</td>
<td className="py-space-md px-space-md text-right">
<button className="px-2.5 py-1.5 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary transition-all font-label-md text-label-md font-semibold" type="button">
                  Audit Hub
                </button>
</td>
</tr>
</tbody>
</table>
</div>

<div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm text-body-sm font-body-sm text-on-surface-variant">
<span>Showing 4 of 18 Western Mediterranean Operational Hubs</span>
<div className="flex items-center gap-2">
<button className="px-3 py-1 rounded bg-surface-container-lowest text-on-surface shadow-xs disabled:opacity-50" disabled type="button">Previous</button>
<span className="px-2 font-semibold text-primary">Page 1 of 5</span>
<button className="px-3 py-1 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-xs" type="button">Next</button>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border-l-4 border-secondary flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg">
<div className="flex items-start gap-space-md">
<div className="w-12 h-12 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[24px]">gavel</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-2">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">Regulatory Guarantee</span>
<span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container text-primary font-medium">Daily Sync: 04:00 CET</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary font-semibold mt-0.5">Bank Custody &amp; Anti-Money Laundering (AML) Directive 2018/843</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-4xl">
            Automated cryptographic daily ledger reconciliation completed. Client funds are maintained in isolated, ring-fenced fiduciary trust accounts under continuous oversight of Banca d&apos;Italia and Banco de España. Notary-verified signatures are sealed via Nauta Smart Settlement with 256-bit AES encryption.
          </p>
</div>
</div>
<div className="flex items-center gap-space-sm shrink-0 w-full md:w-auto justify-end">
<button className="px-4 py-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary font-body-sm text-body-sm font-semibold transition-colors flex items-center gap-1.5 shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">verified</span>
          View Custody Certificates
        </button>
<button className="px-4 py-2.5 rounded-lg bg-secondary text-on-secondary hover:bg-on-secondary-fixed-variant transition-colors font-body-sm text-body-sm font-semibold flex items-center gap-1.5 shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">download_for_offline</span>
          AML Ledger 2025-Q2
        </button>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
<div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between">
<div>
<div className="flex items-center justify-between text-on-surface-variant mb-1">
<span className="font-label-sm text-label-sm uppercase tracking-wider">Brokerage Retention</span>
<span className="material-symbols-outlined text-[18px]">handshake</span>
</div>
<span className="font-headline-sm text-headline-sm text-primary">98.2%</span>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">SaaS annual renewals across 140+ certified naval brokers in the Western Mediterranean basin.</p>
</div>
<div className="mt-space-md pt-space-xs border-t border-surface-container flex items-center justify-between">
<span className="font-label-sm text-label-sm text-secondary font-semibold">Churn: 1.8%</span>
<Link href="#" className="text-primary hover:underline font-label-md text-label-md font-semibold" >Details</Link>
</div>
</div>
<div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between">
<div>
<div className="flex items-center justify-between text-on-surface-variant mb-1">
<span className="font-label-sm text-label-sm uppercase tracking-wider">Average Deal Ticket</span>
<span className="material-symbols-outlined text-[18px]">speed</span>
</div>
<span className="font-headline-sm text-headline-sm text-primary">€842,000</span>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Cross-segment mean across motor yachts (62%) and performance sailing vessels (38%).</p>
</div>
<div className="mt-space-md pt-space-xs border-t border-surface-container flex items-center justify-between">
<span className="font-label-sm text-label-sm text-secondary font-semibold">Median: €620,000</span>
<Link href="#" className="text-primary hover:underline font-label-md text-label-md font-semibold" >Details</Link>
</div>
</div>
<div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between">
<div>
<div className="flex items-center justify-between text-on-surface-variant mb-1">
<span className="font-label-sm text-label-sm uppercase tracking-wider">Maritime FX Settlement</span>
<span className="material-symbols-outlined text-[18px]">currency_exchange</span>
</div>
<span className="font-headline-sm text-headline-sm text-primary">€18.6M Cross-border</span>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">GBP/USD to EUR conversions cleared through European Central Bank wholesale spot spreads.</p>
</div>
<div className="mt-space-md pt-space-xs border-t border-surface-container flex items-center justify-between">
<span className="font-label-sm text-label-sm text-secondary font-semibold">Spread Take: 0.18%</span>
<Link href="#" className="text-primary hover:underline font-label-md text-label-md font-semibold" >Details</Link>
</div>
</div>
</div>
</div>
</div>
      </RequirePermission>
    </main>
  );
}
