import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function BrokerSubscription() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<aside className="w-full bg-primary-container text-on-primary-container px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xs text-body-sm flex flex-wrap items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-sm min-w-0">
<span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-secondary-fixed animate-pulse shrink-0"></span>
<span className="font-label-sm tracking-wider uppercase text-on-primary">PROTOTYPE MODE: YACHT BROKER SELLER</span>
<span className="hidden sm:inline text-outline-variant">|</span>
<span className="hidden sm:inline font-body-sm text-on-primary-container truncate">Marina Balear Yachting S.L. · Port Adriano (Mallorca)</span>
</div>
<div className="flex items-center gap-space-md shrink-0">
<button className="font-label-sm text-on-primary hover:text-secondary-fixed transition-colors flex items-center gap-1 uppercase tracking-wider" type="button">
<span className="material-symbols-outlined text-[15px]">swap_horiz</span>
        Switch Demo Role
      </button>
<span className="text-outline-variant">·</span>
<button className="font-label-sm text-on-primary-container hover:text-on-primary transition-colors flex items-center gap-1 uppercase tracking-wider" type="button">
<span className="material-symbols-outlined text-[15px]">logout</span>
        Log Out
      </button>
</div>
</aside>

<section className="w-full bg-surface-container-lowest shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex items-center justify-between overflow-x-auto no-scrollbar py-space-xs">
<nav className="flex items-center gap-space-lg shrink-0">
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors" >Overview</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors" >Fleet</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors" >Leads</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors" >Team</Link>
<Link href="/services/" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors" >Services</Link>
<Link href="#" className="py-space-sm font-body-md text-on-surface-variant hover:text-primary transition-colors" >Company Profile</Link>
<Link href="#" className="py-space-sm font-title-md text-primary relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-secondary" >Subscription</Link>
</nav>
<div className="hidden lg:flex items-center gap-space-sm pl-space-lg text-body-sm text-on-surface-variant">
<span className="material-symbols-outlined text-[18px] text-secondary">verified_user</span>
<span>Central Agency ID: <strong className="font-spec-num text-primary">ES-PM-88210</strong></span>
</div>
</div>
</div>
</section>

<div className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-2xl">

<header className="flex flex-col gap-space-xs">
<div className="flex items-center gap-space-sm">
<span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">COMMERCIAL BILLING &amp; PORTAL TIER</span>
<span className="text-outline-variant font-label-sm">•</span>
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant">MYBA &amp; YACHTFOLIO MLS SYNC</span>
</div>
<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
<div className="flex flex-col gap-space-xs max-w-3xl">
<h1 className="font-headline-lg text-headline-lg text-primary">Brokerage Membership &amp; MLS Syndication Plan</h1>
<p className="font-body-lg text-body-lg text-on-surface-variant">Review your Mediterranean Central Agency capacity, MLS syndication feeds (MYBA YachtFolio &amp; YachtWorld), and multi-agent seat allocations.</p>
</div>
<div className="flex items-center gap-space-sm self-start lg:self-auto shrink-0">
<button className="bg-surface-container-high hover:bg-surface-container text-primary font-body-md px-space-md py-space-sm rounded transition-colors flex items-center gap-2" type="button">
<span className="material-symbols-outlined text-[18px]">receipt_long</span>
            Download Tax Ledger
          </button>
<button className="bg-primary hover:bg-primary-container text-on-primary font-body-md px-space-md py-space-sm rounded transition-colors flex items-center gap-2 shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">upgrade</span>
            Upgrade Tier
          </button>
</div>
</div>
</header>

<section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">

<div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between gap-space-xl relative overflow-hidden">
<div className="absolute -right-16 -top-16 w-64 h-64 bg-secondary/5 rounded-full blur-3xl pointer-events-none"></div>
<div className="flex flex-col gap-space-md">
<div className="flex flex-wrap items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-sm">
<span className="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm tracking-wide uppercase font-semibold">Current Plan</span>
<span className="px-space-sm py-0.5 rounded-full bg-surface-container-low text-on-surface font-label-sm flex items-center gap-1">
<span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary"></span>
                Active · Renews 15 Jan 2026
              </span>
</div>
<span className="font-label-sm tracking-widest text-on-surface-variant uppercase">Contract ID: NB-CA-4491-EU</span>
</div>
<div className="flex flex-col md:flex-row md:items-baseline justify-between gap-space-sm pt-space-xs">
<div>
<h2 className="font-headline-md text-headline-md text-primary">Mediterranean Premier Fleet Tier</h2>
<p className="font-body-md text-body-md text-on-surface-variant">Full syndicate connectivity across Palma, Monaco, Genoa, and Barcelona marinas.</p>
</div>
<div className="flex flex-col items-start md:items-end">
<div className="flex items-baseline gap-1">
<span className="font-headline-lg text-headline-lg text-primary">€890</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">/ month</span>
</div>
<span className="font-label-sm text-secondary font-medium">Billed Annually (€10,680.00 / yr ex. VAT)</span>
</div>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg pt-space-md">

<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-sm">
<div className="flex justify-between items-center font-body-sm">
<span className="font-title-md text-title-md text-primary flex items-center gap-1.5">
<span className="material-symbols-outlined text-[18px] text-secondary">sailing</span>
                Active Vessel Listings
              </span>
<span className="font-spec-num text-spec-num text-primary font-semibold">18 <span className="text-on-surface-variant font-normal">/ 25 used</span></span>
</div>
<div className="w-full bg-surface-container-highest rounded-full h-2.5 overflow-hidden">
<div className="bg-secondary h-full rounded-full transition-all duration-500" style={{"width": "72%"}}></div>
</div>
<div className="flex justify-between items-center font-label-sm text-on-surface-variant">
<span>72% capacity utilized</span>
<span className="text-primary font-medium">7 slots remaining</span>
</div>
</div>

<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-sm">
<div className="flex justify-between items-center font-body-sm">
<span className="font-title-md text-title-md text-primary flex items-center gap-1.5">
<span className="material-symbols-outlined text-[18px] text-secondary">group</span>
                Certified Agent Seats
              </span>
<span className="font-spec-num text-spec-num text-primary font-semibold">6 <span className="text-on-surface-variant font-normal">/ 10 active</span></span>
</div>
<div className="w-full bg-surface-container-highest rounded-full h-2.5 overflow-hidden">
<div className="bg-primary h-full rounded-full transition-all duration-500" style={{"width": "60%"}}></div>
</div>
<div className="flex justify-between items-center font-label-sm text-on-surface-variant">
<span>60% allocation</span>
<span className="text-primary font-medium">4 seats available</span>
</div>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md pt-space-xs text-body-sm">
<div className="flex items-start gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">translate</span>
<div>
<p className="font-title-md text-body-md text-primary">AI Translation Requests</p>
<p className="text-body-sm text-on-surface-variant">Unlimited European Syndication (ES, IT, EN, FR, DE) with maritime legal accuracy verification.</p>
</div>
</div>
<div className="flex items-start gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">account_balance</span>
<div>
<p className="font-title-md text-body-md text-primary">Escrow Ledger Integration</p>
<p className="text-body-sm text-on-surface-variant">Included · Direct API connection for Santander Corporate and CaixaBank B2B Deposit Vaults.</p>
</div>
</div>
</div>

<div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-sm text-body-sm bg-surface-container-low -mx-space-xl -mb-space-xl px-space-xl py-space-md">
<span className="text-on-surface-variant flex items-center gap-1.5">
<span className="material-symbols-outlined text-[18px] text-on-surface-variant">sync</span>
            Next automatic renewal scheduled for <strong>January 15, 2026</strong>
</span>
<div className="flex items-center gap-space-md">
<button className="text-on-surface-variant hover:text-error text-label-md transition-colors uppercase tracking-wider font-semibold" type="button">Cancel Subscription</button>
<button className="text-secondary hover:text-primary text-label-md transition-colors uppercase tracking-wider font-semibold" type="button">Change Cycle</button>
</div>
</div>
</div>

<div className="lg:col-span-4 flex flex-col gap-space-lg">

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
<div className="flex items-center justify-between">
<h3 className="font-title-lg text-title-lg text-primary">MLS Feed Status</h3>
<span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm font-semibold uppercase">Operational</span>
</div>
<div className="flex flex-col gap-space-sm">
<div className="flex items-center justify-between p-space-sm rounded bg-surface-container-low">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">hub</span>
<div>
<p className="font-title-md text-body-md text-primary leading-tight">MYBA YachtFolio</p>
<p className="font-label-sm text-on-surface-variant">Central Listing Protocol</p>
</div>
</div>
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
</div>
<div className="flex items-center justify-between p-space-sm rounded bg-surface-container-low">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">public</span>
<div>
<p className="font-title-md text-body-md text-primary leading-tight">YachtWorld MLS</p>
<p className="font-label-sm text-on-surface-variant">Global Feed Sync active</p>
</div>
</div>
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
</div>
<div className="flex items-center justify-between p-space-sm rounded bg-surface-container-low">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">anchor</span>
<div>
<p className="font-title-md text-body-md text-primary leading-tight">Nauta Pan-Mediterranean</p>
<p className="font-label-sm text-on-surface-variant">Instant 3-language publish</p>
</div>
</div>
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
</div>
</div>
<div className="pt-space-xs text-body-sm text-on-surface-variant flex items-center justify-between">
<span>Last feed sync: 14 mins ago</span>
<button className="text-secondary hover:text-primary font-semibold text-label-md uppercase tracking-wider" type="button">Sync Now</button>
</div>
</div>

<div className="bg-surface-container p-space-lg rounded-xl flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<span className="font-label-sm tracking-widest text-on-surface-variant uppercase font-semibold">DEDICATED ACCOUNT OFFICER</span>
<h4 className="font-title-lg text-title-lg text-primary">Matteo Vianello</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">Senior Maritime Legal &amp; Syndication Liaison · Nauta Palma Office</p>
</div>
<div className="flex items-center gap-space-sm pt-space-xs">
<Link href="#" className="flex-1 bg-surface-container-lowest hover:bg-surface text-primary text-center py-space-sm px-space-sm rounded font-body-sm text-body-sm font-medium transition-colors shadow-sm" >
              Email Officer
            </Link>
<Link href="#" className="flex-1 bg-primary text-on-primary hover:bg-primary-container text-center py-space-sm px-space-sm rounded font-body-sm text-body-sm font-medium transition-colors" >
              Schedule Call
            </Link>
</div>
</div>
</div>
</section>

<section className="flex flex-col gap-space-lg">
<div className="flex flex-col gap-space-xs">
<span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">COMMERCIAL CAPACITY SELECTION</span>
<h2 className="font-headline-md text-headline-md text-primary">Scalable Membership Tiers</h2>
<p className="font-body-md text-body-md text-on-surface-variant">Upgrade or adjust your agency tier in real-time as your seasonal central agency vessel portfolio shifts.</p>
</div>
<div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg items-stretch">

<div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between gap-space-xl">
<div className="flex flex-col gap-space-md">
<div className="flex justify-between items-start">
<div>
<h3 className="font-headline-sm text-headline-sm text-primary">Boutique Broker</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">For independent maritime brokers and bespoke charter consultants.</p>
</div>
</div>
<div className="flex items-baseline gap-1 py-space-xs">
<span className="font-headline-lg text-headline-lg text-primary">€290</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">/ month</span>
</div>
<div className="flex flex-col gap-space-sm text-body-md text-on-surface pt-space-sm">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">check</span>
<span>Up to <strong>5 Active Vessel Listings</strong></span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">check</span>
<span><strong>2 Certified Agent Seats</strong></span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">check</span>
<span>Nauta Regional Direct Portal</span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">check</span>
<span>Standard Escrow Account Support</span>
</div>
<div className="flex items-center gap-space-sm text-outline">
<span className="material-symbols-outlined text-[18px]">close</span>
<span className="line-through">MYBA YachtFolio automated feed</span>
</div>
<div className="flex items-center gap-space-sm text-outline">
<span className="material-symbols-outlined text-[18px]">close</span>
<span className="line-through">Dedicated Nautical Legal Officer</span>
</div>
</div>
</div>
<button className="w-full bg-surface-container-high hover:bg-surface-container text-primary font-body-md py-space-sm px-space-md rounded transition-colors text-center" type="button">
            Downgrade to Boutique
          </button>
</div>

<div className="bg-primary text-on-primary rounded-xl p-space-xl shadow-xl flex flex-col justify-between gap-space-xl relative overflow-hidden">
<div className="absolute top-0 right-0 bg-secondary px-space-md py-1 rounded-bl-lg font-label-sm uppercase tracking-widest text-on-secondary font-semibold">
            Active Tier
          </div>
<div className="flex flex-col gap-space-md">
<div>
<h3 className="font-headline-sm text-headline-sm text-on-primary">Premier Fleet</h3>
<p className="font-body-sm text-body-sm text-on-primary-container">For established agencies operating primary berths across Spain and Italy.</p>
</div>
<div className="flex items-baseline gap-1 py-space-xs">
<span className="font-headline-lg text-headline-lg text-on-primary">€890</span>
<span className="font-body-sm text-body-sm text-on-primary-container">/ month</span>
</div>
<div className="flex flex-col gap-space-sm text-body-md text-on-primary pt-space-sm">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary-fixed text-[18px]">check</span>
<span>Up to <strong>25 Active Vessel Listings</strong></span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary-fixed text-[18px]">check</span>
<span><strong>10 Certified Agent Seats</strong></span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary-fixed text-[18px]">check</span>
<span>Live <strong>MYBA YachtFolio &amp; YachtWorld</strong> MLS sync</span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary-fixed text-[18px]">check</span>
<span>Unlimited AI Maritime Translations</span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary-fixed text-[18px]">check</span>
<span>Santander &amp; CaixaBank Escrow Vault Ledger</span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary-fixed text-[18px]">check</span>
<span>Quarterly VAT Compliance Audits</span>
</div>
</div>
</div>
<button className="w-full bg-surface-container-lowest/15 text-on-primary font-body-md py-space-sm px-space-md rounded cursor-default text-center font-medium" disabled type="button">
            Currently Enrolled
          </button>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between gap-space-xl">
<div className="flex flex-col gap-space-md">
<div className="flex justify-between items-start">
<div>
<h3 className="font-headline-sm text-headline-sm text-primary">Sovereign Agency</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">For international superyacht brokerages and multijurisdictional fleets.</p>
</div>
</div>
<div className="flex items-baseline gap-1 py-space-xs">
<span className="font-headline-lg text-headline-lg text-primary">€1,850</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">/ month</span>
</div>
<div className="flex flex-col gap-space-sm text-body-md text-on-surface pt-space-sm">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">check</span>
<span><strong>Unlimited Vessel Listings</strong></span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">check</span>
<span><strong>Unlimited Multi-Agent Seats</strong></span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">check</span>
<span>Custom Private API &amp; Webhook Data Streams</span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">check</span>
<span>Dedicated Escrow Officer &amp; Notary Liaison</span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">check</span>
<span>Editorial Feature Placements in Nauta Quarterly</span>
</div>
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">check</span>
<span>24/7 Priority Telephone Dispatch</span>
</div>
</div>
</div>
<button className="w-full bg-primary hover:bg-primary-container text-on-primary font-body-md py-space-sm px-space-md rounded transition-colors text-center shadow-sm" type="button">
            Upgrade to Sovereign
          </button>
</div>
</div>
</section>

<section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">

<div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col gap-space-lg">
<div className="flex items-center justify-between">
<div className="flex flex-col gap-0.5">
<h3 className="font-headline-sm text-headline-sm text-primary">Payment Instruments</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Manage maritime corporate debit channels and SEPA mandates.</p>
</div>
<button className="text-secondary hover:text-primary font-body-md font-semibold flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[18px]">add</span>
            Add Method
          </button>
</div>
<div className="flex flex-col gap-space-sm">

<div className="p-space-md rounded-lg bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-md">
<div className="w-12 h-12 rounded bg-surface-container-lowest flex items-center justify-center text-primary shadow-xs">
<span className="material-symbols-outlined text-[24px]">account_balance</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-space-xs">
<span className="font-title-md text-title-md text-primary">Banco Santander S.A.</span>
<span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm font-semibold uppercase">Default B2B</span>
</div>
<span className="font-spec-num text-spec-num text-on-surface-variant">ES91 •••• •••• •••• •••• 4018</span>
<span className="font-label-sm text-on-surface-variant">SEPA Direct Debit Mandate ID: B2B-ES-992140</span>
</div>
</div>
<div className="flex items-center gap-space-sm self-end sm:self-center">
<button className="text-on-surface-variant hover:text-primary p-1.5 rounded transition-colors" title="Manage Mandate" type="button">
<span className="material-symbols-outlined text-[20px]">edit</span>
</button>
</div>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-md">
<div className="w-12 h-12 rounded bg-surface-container-lowest flex items-center justify-center text-primary shadow-xs">
<span className="material-symbols-outlined text-[24px]">credit_card</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-space-xs">
<span className="font-title-md text-title-md text-primary">Visa Corporate Commercial</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm font-semibold uppercase">Backup</span>
</div>
<span className="font-spec-num text-spec-num text-on-surface-variant">•••• •••• •••• 8832 · Exp 09/27</span>
<span className="font-label-sm text-on-surface-variant">Cardholder: Marina Balear Yachting S.L.</span>
</div>
</div>
<div className="flex items-center gap-space-sm self-end sm:self-center">
<button className="text-on-surface-variant hover:text-primary p-1.5 rounded transition-colors" title="Set as primary" type="button">
<span className="material-symbols-outlined text-[20px]">star</span>
</button>
<button className="text-on-surface-variant hover:text-error p-1.5 rounded transition-colors" title="Remove method" type="button">
<span className="material-symbols-outlined text-[20px]">delete</span>
</button>
</div>
</div>
</div>
</div>

<div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between gap-space-lg">
<div className="flex flex-col gap-space-sm">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-headline-sm text-primary">Tax &amp; Legal Entity</h3>
<button className="text-secondary hover:text-primary font-body-sm font-semibold" type="button">Edit Info</button>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">Invoices are calculated according to EU VIES cross-border VAT exemptions.</p>
<div className="flex flex-col gap-space-xs pt-space-xs text-body-sm">
<div className="flex justify-between py-1">
<span className="text-on-surface-variant">Legal Name</span>
<span className="font-medium text-primary text-right">Marina Balear Yachting S.L.</span>
</div>
<div className="flex justify-between py-1">
<span className="text-on-surface-variant">Spanish CIF / VAT ID</span>
<span className="font-spec-num text-primary font-medium">ES-B57893201</span>
</div>
<div className="flex justify-between py-1">
<span className="text-on-surface-variant">Registered Office</span>
<span className="text-on-surface text-right">Muelle Central s/n, Port Adriano, 07180 El Toro, Calvià, Mallorca</span>
</div>
<div className="flex justify-between py-1">
<span className="text-on-surface-variant">Billing Contact</span>
<span className="text-primary text-right">accounting@marinabalear.es</span>
</div>
</div>
</div>
<div className="p-space-sm bg-surface-container-low rounded text-label-sm text-on-surface-variant flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0">verified</span>
<span>VIES EU VAT Status: <strong>VALIDATED</strong> for Reverse Charge applicability.</span>
</div>
</div>
</section>

<section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
<div className="p-space-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
<div className="flex flex-col gap-0.5">
<h3 className="font-headline-sm text-headline-sm text-primary">Billing History &amp; Official Tax Invoices</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Download certified Spanish Factura Ordinaria receipts and fiscal summaries.</p>
</div>
<div className="flex items-center gap-space-sm">
<button className="bg-surface-container-low hover:bg-surface-container text-primary text-body-sm px-space-md py-space-xs rounded transition-colors flex items-center gap-1.5 font-medium" type="button">
<span className="material-symbols-outlined text-[18px]">calendar_month</span>
            Fiscal Year 2025
          </button>
<button className="bg-surface-container-low hover:bg-surface-container text-primary text-body-sm px-space-md py-space-xs rounded transition-colors flex items-center gap-1.5 font-medium" type="button">
<span className="material-symbols-outlined text-[18px]">file_download</span>
            Export All (.ZIP)
          </button>
</div>
</div>

<div className="w-full overflow-x-auto">
<table className="w-full text-left text-body-md">
<thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
<tr>
<th className="py-space-sm px-space-xl" scope="col">Date</th>
<th className="py-space-sm px-space-md" scope="col">Invoice ID</th>
<th className="py-space-sm px-space-md" scope="col">Description</th>
<th className="py-space-sm px-space-md" scope="col">Amount</th>
<th className="py-space-sm px-space-md" scope="col">Payment Method</th>
<th className="py-space-sm px-space-md" scope="col">Status</th>
<th className="py-space-sm px-space-xl text-right" scope="col">Download</th>
</tr>
</thead>
<tbody className="divide-y-0">

<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-space-md px-space-xl font-spec-num text-on-surface whitespace-nowrap">15 Jan 2025</td>
<td className="py-space-md px-space-md font-spec-num font-semibold text-primary whitespace-nowrap">#INV-2025-014</td>
<td className="py-space-md px-space-md text-on-surface-variant whitespace-nowrap">Premier Fleet Tier · Annual Subscription 2025–2026</td>
<td className="py-space-md px-space-md font-spec-num font-semibold text-primary whitespace-nowrap">€10,680.00 <span className="text-body-sm font-normal text-on-surface-variant">(incl. 21% IVA)</span></td>
<td className="py-space-md px-space-md text-on-surface-variant whitespace-nowrap">
<span className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">account_balance</span>
                  SEPA Santander (•••• 4018)
                </span>
</td>
<td className="py-space-md px-space-md whitespace-nowrap">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-semibold bg-secondary-container text-on-secondary-container">Paid</span>
</td>
<td className="py-space-md px-space-xl text-right whitespace-nowrap">
<button className="text-secondary hover:text-primary font-body-sm font-medium inline-flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[18px]">download</span>
                  PDF
                </button>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-space-md px-space-xl font-spec-num text-on-surface whitespace-nowrap">15 Jan 2024</td>
<td className="py-space-md px-space-md font-spec-num font-semibold text-primary whitespace-nowrap">#INV-2024-009</td>
<td className="py-space-md px-space-md text-on-surface-variant whitespace-nowrap">Premier Fleet Tier · Annual Subscription 2024–2025</td>
<td className="py-space-md px-space-md font-spec-num font-semibold text-primary whitespace-nowrap">€10,680.00 <span className="text-body-sm font-normal text-on-surface-variant">(incl. 21% IVA)</span></td>
<td className="py-space-md px-space-md text-on-surface-variant whitespace-nowrap">
<span className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">account_balance</span>
                  SEPA Santander (•••• 4018)
                </span>
</td>
<td className="py-space-md px-space-md whitespace-nowrap">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-semibold bg-secondary-container text-on-secondary-container">Paid</span>
</td>
<td className="py-space-md px-space-xl text-right whitespace-nowrap">
<button className="text-secondary hover:text-primary font-body-sm font-medium inline-flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[18px]">download</span>
                  PDF
                </button>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-space-md px-space-xl font-spec-num text-on-surface whitespace-nowrap">03 Jun 2023</td>
<td className="py-space-md px-space-md font-spec-num font-semibold text-primary whitespace-nowrap">#INV-2023-088</td>
<td className="py-space-md px-space-md text-on-surface-variant whitespace-nowrap">Add-on: Superyacht Palma Boat Show Sponsored Placement (x3 vessels)</td>
<td className="py-space-md px-space-md font-spec-num font-semibold text-primary whitespace-nowrap">€1,450.00 <span className="text-body-sm font-normal text-on-surface-variant">(incl. 21% IVA)</span></td>
<td className="py-space-md px-space-md text-on-surface-variant whitespace-nowrap">
<span className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">credit_card</span>
                  Visa Corporate (•••• 8832)
                </span>
</td>
<td className="py-space-md px-space-md whitespace-nowrap">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-semibold bg-secondary-container text-on-secondary-container">Paid</span>
</td>
<td className="py-space-md px-space-xl text-right whitespace-nowrap">
<button className="text-secondary hover:text-primary font-body-sm font-medium inline-flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[18px]">download</span>
                  PDF
                </button>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-space-md px-space-xl font-spec-num text-on-surface whitespace-nowrap">15 Jan 2023</td>
<td className="py-space-md px-space-md font-spec-num font-semibold text-primary whitespace-nowrap">#INV-2023-002</td>
<td className="py-space-md px-space-md text-on-surface-variant whitespace-nowrap">Boutique Broker Tier · Initial Commercial Onboarding</td>
<td className="py-space-md px-space-md font-spec-num font-semibold text-primary whitespace-nowrap">€3,480.00 <span className="text-body-sm font-normal text-on-surface-variant">(incl. 21% IVA)</span></td>
<td className="py-space-md px-space-md text-on-surface-variant whitespace-nowrap">
<span className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">account_balance</span>
                  SEPA Santander (•••• 4018)
                </span>
</td>
<td className="py-space-md px-space-md whitespace-nowrap">
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-semibold bg-secondary-container text-on-secondary-container">Paid</span>
</td>
<td className="py-space-md px-space-xl text-right whitespace-nowrap">
<button className="text-secondary hover:text-primary font-body-sm font-medium inline-flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[18px]">download</span>
                  PDF
                </button>
</td>
</tr>
</tbody>
</table>
</div>
<div className="p-space-lg bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm text-body-sm text-on-surface-variant">
<span>Showing 4 recorded fiscal statements</span>
<Link href="#" className="text-secondary hover:text-primary font-medium flex items-center gap-1" >
          Request historical archive prior to 2023
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</Link>
</div>
</section>

<aside className="w-full bg-surface-container-low p-space-xl rounded-xl flex flex-col md:flex-row items-center justify-between gap-space-lg">
<div className="flex flex-col gap-space-xs">
<span className="font-label-sm uppercase tracking-widest text-on-surface-variant font-semibold">ADVERTISEMENT · NAUTICAL LEGAL PARTNERS</span>
<h3 className="font-headline-sm text-headline-sm text-primary">Tirreno Marine Maritime Legal Services</h3>
<p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">Bespoke cross-border flag registration in Spain, Italy, and Malta. Specialized flag transfers, maritime mortgage notarization, and crew contracts.</p>
</div>
<button className="bg-primary hover:bg-primary-container text-on-primary font-body-md px-space-lg py-space-sm rounded transition-colors shrink-0 shadow-sm" type="button">
        Inquire Partner Rates
      </button>
</aside>
</div>
</div>
      </RequirePermission>
    </main>
  );
}
