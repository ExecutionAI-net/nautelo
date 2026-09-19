import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function PrivateSellerOverview() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<div className="relative w-full overflow-hidden">
<div className="absolute -top-32 right-12 w-96 h-96 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none"></div>
<div className="absolute top-80 left-0 w-80 h-80 rounded-full bg-tertiary-fixed/15 blur-2xl pointer-events-none"></div>

<div className="max-w-[1440px] w-full mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-xl">

<div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
<Link href="#" className="hover:text-primary transition-colors" >Portals</Link>
<span className="text-outline-variant font-normal">/</span>
<span className="text-primary font-semibold">Private Vessel Owner Desk</span>
</div>
<div className="inline-flex items-center gap-space-xs bg-surface-container-low px-3 py-1 rounded-full w-fit">
<span className="material-symbols-outlined text-secondary text-[16px]" style={{"fontVariationSettings": "'FILL' 1"}}>verified</span>
<span className="font-label-sm text-label-sm text-on-surface-variant font-medium tracking-normal">
            Spanish Maritime Registry (DGMM) · Aligned &amp; VAT Settled
          </span>
</div>
</div>

<section className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="flex flex-col gap-space-xs max-w-2xl">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Owner Portal · Balearic &amp; Ligurian Registry Desk</span>
<h1 className="font-headline-lg text-headline-lg text-primary">
            Welcome back, Capt. Santiago Martorell
          </h1>
<p className="font-body-md text-body-md text-on-surface-variant">
            Supervising 2 luxury vessels on berth at Palma de Mallorca and Portofino. Inbound qualified buyer traffic up 14% this nautical quarter.
          </p>
</div>

<div className="flex items-center flex-wrap gap-space-sm shrink-0">
<button className="inline-flex items-center gap-space-xs bg-surface-container-lowest text-primary hover:bg-surface-container px-space-md py-space-sm rounded-lg font-body-md text-body-md shadow-sm transition-all" type="button">
<span className="material-symbols-outlined text-[18px]">folder_zip</span>
<span>Download Tax &amp; Escrow Dossier</span>
</button>
<button className="inline-flex items-center gap-space-xs bg-primary-container hover:bg-primary text-on-primary px-space-md py-space-sm rounded-lg font-body-md text-body-md transition-all shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">add_circle</span>
<span className="font-medium">Create New Listing</span>
</button>
</div>
</section>

<section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between min-h-[140px]">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Active Fleet</span>
<span className="material-symbols-outlined text-secondary text-[20px]">sailing</span>
</div>
<div className="flex flex-col gap-space-xs">
<span className="font-display-hero text-headline-lg text-primary tracking-tight">2 Vessels</span>
<span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
<span className="w-2 h-2 rounded-full bg-secondary inline-block"></span>
              1 Cruiser · 1 Motor Yacht
            </span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between min-h-[140px]">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Inquiries (30d)</span>
<span className="inline-flex items-center gap-0.5 text-secondary font-label-sm text-label-sm bg-secondary/10 px-2 py-0.5 rounded-full">
<span className="material-symbols-outlined text-[14px]">trending_up</span>
              +14%
            </span>
</div>
<div className="flex flex-col gap-space-xs">
<span className="font-display-hero text-headline-lg text-primary tracking-tight">38 Leads</span>
<div className="w-full flex items-center gap-2">
<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "72%"}}></div>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">72% qualified</span>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between min-h-[140px]">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Qualified Viewings</span>
<span className="material-symbols-outlined text-secondary text-[20px]">event_available</span>
</div>
<div className="flex flex-col gap-space-xs">
<span className="font-display-hero text-headline-lg text-primary tracking-tight">9 Verified</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">
              6 Completed · 3 Scheduled
            </span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between min-h-[140px] bg-gradient-to-br from-surface-container-lowest to-surface-container-low">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Active Escrow</span>
<span className="material-symbols-outlined text-[#B89A62] text-[20px]" style={{"fontVariationSettings": "'FILL' 1"}}>verified_user</span>
</div>
<div className="flex flex-col gap-space-xs">
<div className="flex items-baseline gap-1">
<span className="font-title-lg text-title-lg font-bold text-primary">€340,000</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">EUR</span>
</div>
<span className="font-body-sm text-body-sm text-secondary font-medium flex items-center gap-1">
<span className="w-2 h-2 rounded-full bg-secondary inline-block animate-pulse"></span>
              Deposit held · Survey booked
            </span>
</div>
</div>
</section>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">

<div className="lg:col-span-8 flex flex-col gap-space-xl">

<div className="flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="w-2 h-6 bg-primary-container rounded-full"></span>
<h2 className="font-headline-sm text-headline-sm text-primary">My Fleet &amp; Listings</h2>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant">2 of 2 vessels active</span>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md">
<div className="grid grid-cols-1 md:grid-cols-12">

<div className="md:col-span-5 relative min-h-[260px] bg-surface-container">
<img alt="" className="w-full h-full object-cover" src="/design/ea03cd866a.jpg"/>
<div className="absolute top-3 left-3">
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/90 backdrop-blur-sm text-on-primary font-label-sm text-label-sm">
<span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed inline-block"></span>
                    Active · High Interest
                  </span>
</div>
<div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface font-label-sm text-label-sm shadow-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">anchor</span>
                    RCN Palma · Mallorca, ES
                  </span>
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#102a38]/85 text-surface-bright font-label-sm text-label-sm">
                    EN · IT · ES
                  </span>
</div>
</div>

<div className="md:col-span-7 p-space-lg flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<div className="flex items-start justify-between gap-space-sm">
<div>
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Performance Cruiser</span>
<h3 className="font-headline-sm text-headline-sm text-primary">2021 Solaris 50 “Sirocco Blue”</h3>
</div>
<div className="text-right shrink-0">
<span className="font-title-lg text-title-lg font-bold text-primary block">€685,000</span>
<span className="font-label-sm text-label-sm text-secondary font-medium">VAT Paid · Spain</span>
</div>
</div>

<div className="grid grid-cols-3 gap-2 py-space-sm mt-space-xs bg-surface-container-low/60 rounded-lg px-3">
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant">LOA / Beam</span>
<span className="font-spec-num text-spec-num text-on-surface font-medium">15.42m · 4.78m</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant">Engine</span>
<span className="font-spec-num text-spec-num text-on-surface font-medium">Yanmar 75HP (480h)</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant">Cabins / Heads</span>
<span className="font-spec-num text-spec-num text-on-surface font-medium">3 Cabins · 2 Heads</span>
</div>
</div>

<div className="grid grid-cols-3 gap-space-sm pt-space-xs">
<div className="flex flex-col">
<span className="font-headline-sm text-title-lg font-semibold text-primary">1,420</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Public views</span>
</div>
<div className="flex flex-col">
<span className="font-headline-sm text-title-lg font-semibold text-secondary">24</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Direct buyer leads</span>
</div>
<div className="flex flex-col">
<span className="font-headline-sm text-title-lg font-semibold text-primary">4</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Video walkthroughs</span>
</div>
</div>
</div>

<div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-sm">
<div className="flex items-center gap-space-xs">
<button className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-body-sm text-body-sm transition-colors" type="button">
                      Edit Listing
                    </button>
<button className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-body-sm text-body-sm transition-colors" type="button">
                      Public Preview
                    </button>
<button className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-body-sm text-body-sm flex items-center gap-1 transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">verified</span>
                      Docs (HIN &amp; CE)
                    </button>
</div>
<button className="px-3.5 py-1.5 rounded-lg bg-secondary text-on-secondary hover:bg-on-secondary-container font-label-md text-label-md flex items-center gap-1 transition-all shadow-sm" type="button">
<span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                    Boost Syndication
                  </button>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md">
<div className="grid grid-cols-1 md:grid-cols-12">

<div className="md:col-span-5 relative min-h-[260px] bg-surface-container">
<img alt="" className="w-full h-full object-cover" src="/design/f22f5e5cb3.jpg"/>
<div className="absolute top-3 left-3">
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#B89A62] text-on-primary font-label-sm text-label-sm shadow-sm">
<span className="material-symbols-outlined text-[14px]">lock</span>
                    Deposit Held · Escrow Stage
                  </span>
</div>
<div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface font-label-sm text-label-sm shadow-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">anchor</span>
                    Marina di Portofino · Liguria, IT
                  </span>
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#102a38]/85 text-surface-bright font-label-sm text-label-sm">
                    EN · IT
                  </span>
</div>
</div>

<div className="md:col-span-7 p-space-lg flex flex-col justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<div className="flex items-start justify-between gap-space-sm">
<div>
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Sport Cruiser</span>
<h3 className="font-headline-sm text-headline-sm text-primary">2018 Beneteau Gran Turismo 40 “Aura”</h3>
</div>
<div className="text-right shrink-0">
<span className="font-title-lg text-title-lg font-bold text-primary block">€340,000</span>
<span className="font-label-sm text-label-sm text-[#00696e] font-medium">VAT Paid · Italy</span>
</div>
</div>

<div className="grid grid-cols-3 gap-2 py-space-sm mt-space-xs bg-surface-container-low/60 rounded-lg px-3">
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant">LOA / Beam</span>
<span className="font-spec-num text-spec-num text-on-surface font-medium">12.55m · 3.87m</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant">Engines</span>
<span className="font-spec-num text-spec-num text-on-surface font-medium">Twin Volvo D6-370</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant">Hours / Registry</span>
<span className="font-spec-num text-spec-num text-on-surface font-medium">620h · Genova RID</span>
</div>
</div>

<div className="flex flex-col gap-2 pt-space-xs">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm font-semibold text-primary">Sale Progress: Step 3 of 4</span>
<span className="font-label-sm text-label-sm text-secondary font-medium">Pre-Purchase Survey This Thursday</span>
</div>
<div className="grid grid-cols-4 gap-1.5">
<div className="h-2 rounded bg-secondary" title="Step 1: Deposit Locked (Complete)"></div>
<div className="h-2 rounded bg-secondary" title="Step 2: Sea Trial Protocol (Complete)"></div>
<div className="h-2 rounded bg-secondary-fixed-dim relative overflow-hidden" title="Step 3: Pre-Purchase Survey (In Progress)">
<div className="w-1/2 h-full bg-secondary"></div>
</div>
<div className="h-2 rounded bg-surface-container-highest" title="Step 4: Deregistration &amp; Bill of Sale"></div>
</div>
<div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
<span className="text-secondary font-medium">1. Escrow Deposit</span>
<span className="text-secondary font-medium">2. Sea Trial</span>
<span className="text-primary font-semibold">3. Marine Survey</span>
<span>4. Closing &amp; Title</span>
</div>
</div>
</div>

<div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-sm">
<div className="flex items-center gap-space-xs">
<span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
<span className="material-symbols-outlined text-[16px] text-[#B89A62]">security</span>
                      10% Escrow Secured (€34,000 in Banco Santander Escrow)
                    </span>
</div>
<div className="flex items-center gap-space-xs">
<button className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-body-sm text-body-sm transition-colors" type="button">
                      Coordinate Survey
                    </button>
<button className="px-3.5 py-1.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-body-sm text-body-sm transition-colors shadow-sm" type="button">
                      View Escrow Room
                    </button>
</div>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-md">
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
<div>
<h3 className="font-headline-sm text-headline-sm text-primary">Inbound Inquiries &amp; Broker Desk</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">Direct messages from verified Mediterranean buyers and affiliated yacht co-brokers.</p>
</div>

<div className="inline-flex p-1 bg-surface-container-low rounded-lg gap-1 font-label-sm text-label-sm">
<button className="px-3 py-1 rounded bg-surface-container-lowest text-primary font-semibold shadow-xs" type="button">
                  All (12 unread)
                </button>
<button className="px-3 py-1 rounded text-on-surface-variant hover:text-primary transition-colors" type="button">
                  Qualified Direct
                </button>
<button className="px-3 py-1 rounded text-on-surface-variant hover:text-primary transition-colors" type="button">
                  Co-Brokers
                </button>
</div>
</div>

<div className="flex flex-col gap-space-xs mt-space-xs">

<div className="p-space-md rounded-lg bg-surface-container-low/50 hover:bg-surface-container-low transition-colors flex flex-col md:flex-row md:items-center justify-between gap-space-md">
<div className="flex items-start gap-space-sm min-w-0">
<div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-title-lg text-title-lg shrink-0">
                    MB
                  </div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-space-xs flex-wrap">
<span className="font-title-md text-title-md text-primary font-semibold">Marco Bellini</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">Milan, IT</span>
<span className="text-secondary font-label-sm text-label-sm font-semibold flex items-center gap-0.5">
<span className="material-symbols-outlined text-[14px]">verified</span> Proof of Funds Confirmed
                      </span>
<span className="text-outline-variant text-label-sm">·</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">2h ago</span>
</div>
<span className="font-body-sm text-body-sm text-secondary font-medium mt-0.5">Solaris 50 “Sirocco Blue”</span>
<p className="font-body-md text-body-md text-on-surface-variant line-clamp-1 mt-0.5">
                      “Request for hull ultrasound survey and composite rigging inspection history before scheduling a sea trial in Palma next Tuesday...”
                    </p>
</div>
</div>
<div className="flex items-center gap-space-xs shrink-0 self-end md:self-center">
<button className="px-3.5 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-primary font-body-sm text-body-sm shadow-xs transition-colors" type="button">
                    Send Technical Dossier
                  </button>
<button className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-body-sm text-body-sm transition-colors shadow-xs" type="button">
                    Reply
                  </button>
</div>
</div>

<div className="p-space-md rounded-lg bg-surface-container-lowest hover:bg-surface-container-low transition-colors flex flex-col md:flex-row md:items-center justify-between gap-space-md">
<div className="flex items-start gap-space-sm min-w-0">
<div className="w-10 h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-title-lg text-title-lg shrink-0">
                    CM
                  </div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-space-xs flex-wrap">
<span className="font-title-md text-title-md text-primary font-semibold">Charles Montgomery</span>
<span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">London / Palma</span>
<span className="text-outline-variant text-label-sm">·</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">5h ago</span>
</div>
<span className="font-body-sm text-body-sm text-secondary font-medium mt-0.5">Solaris 50 “Sirocco Blue”</span>
<p className="font-body-md text-body-md text-on-surface-variant line-clamp-1 mt-0.5">
                      “Inquiring if Spanish matriculación (IEDMT 12%) is fully settled for EU resident transfer and if berth lease at RCNP can be extended...”
                    </p>
</div>
</div>
<div className="flex items-center gap-space-xs shrink-0 self-end md:self-center">
<button className="px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-body-sm text-body-sm transition-colors" type="button">
                    View Buyer Profile
                  </button>
<button className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-body-sm text-body-sm transition-colors shadow-xs" type="button">
                    Reply
                  </button>
</div>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low/50 hover:bg-surface-container-low transition-colors flex flex-col md:flex-row md:items-center justify-between gap-space-md">
<div className="flex items-start gap-space-sm min-w-0">
<div className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[20px]">support_agent</span>
</div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-space-xs flex-wrap">
<span className="font-title-md text-title-md text-primary font-semibold">Nauta Maritime Broker Desk</span>
<span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary font-label-sm text-label-sm font-semibold">Verified Escrow Coordinator</span>
<span className="text-outline-variant text-label-sm">·</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Yesterday</span>
</div>
<span className="font-body-sm text-body-sm text-secondary font-medium mt-0.5">Beneteau GT 40 “Aura”</span>
<p className="font-body-md text-body-md text-on-surface-variant line-clamp-1 mt-0.5">
                      “Surveyor appointed: Ing. Valerio Rossi (RINA Certified) scheduled for Thursday 10:00 CEST at Portofino. Please confirm marina pontoon clearance.”
                    </p>
</div>
</div>
<div className="flex items-center gap-space-xs shrink-0 self-end md:self-center">
<button className="px-3.5 py-1.5 rounded-lg bg-secondary text-on-secondary hover:bg-on-secondary-container font-body-sm text-body-sm transition-colors shadow-xs" type="button">
                    Confirm Berth Access
                  </button>
</div>
</div>
</div>
</div>
</div>

<div className="lg:col-span-4 flex flex-col gap-space-xl">

<div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-md">
<div className="flex items-center justify-between">
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[22px]">policy</span>
<h3 className="font-headline-sm text-title-lg text-primary font-bold">Maritime Flag Compliance</h3>
</div>
<span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
                Spain · Italy
              </span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">
              Required legal &amp; flag documentation for cross-border Mediterranean conveyance and deed notarization.
            </p>

<div className="flex flex-col gap-space-sm pt-space-xs">

<div className="p-3 rounded-lg bg-surface-container-low/60 flex items-start gap-3">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5" style={{"fontVariationSettings": "'FILL' 1"}}>check_circle</span>
<div className="flex flex-col min-w-0">
<div className="flex items-center justify-between gap-1">
<span className="font-body-md text-body-md font-medium text-primary truncate">Hoja de Asiento &amp; Extract</span>
<span className="font-label-sm text-label-sm text-secondary font-semibold">Verified</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">DGMM Palma Registry · 7ª Lista</span>
</div>
</div>

<div className="p-3 rounded-lg bg-surface-container-low/60 flex items-start gap-3">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5" style={{"fontVariationSettings": "'FILL' 1"}}>check_circle</span>
<div className="flex flex-col min-w-0">
<div className="flex items-center justify-between gap-1">
<span className="font-body-md text-body-md font-medium text-primary truncate">Builder’s Certificate &amp; CE</span>
<span className="font-label-sm text-label-sm text-secondary font-semibold">Verified</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Module B+F Yacht Declaration</span>
</div>
</div>

<div className="p-3 rounded-lg bg-surface-container-low/60 flex items-start gap-3">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5" style={{"fontVariationSettings": "'FILL' 1"}}>check_circle</span>
<div className="flex flex-col min-w-0">
<div className="flex items-center justify-between gap-1">
<span className="font-body-md text-body-md font-medium text-primary truncate">VAT / IVA Clearance Receipt</span>
<span className="font-label-sm text-label-sm text-secondary font-semibold">Verified</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Agencia Tributaria Mod. 576 &amp; Agenzia Entrate</span>
</div>
</div>

<div className="p-3 rounded-lg bg-error-container/20 flex items-start gap-3">
<span className="material-symbols-outlined text-[#B7791F] text-[20px] shrink-0 mt-0.5" style={{"fontVariationSettings": "'FILL' 1"}}>warning</span>
<div className="flex flex-col min-w-0">
<div className="flex items-center justify-between gap-1">
<span className="font-body-md text-body-md font-medium text-primary truncate">Ship Radio License (LEB / MMSI)</span>
<span className="font-label-sm text-label-sm text-[#B7791F] font-semibold">Expires in 45d</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Renewal dossier ready for Captain submission</span>
</div>
</div>
</div>

<button className="w-full mt-space-xs py-2.5 px-space-md rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-body-md text-body-md flex items-center justify-center gap-space-xs transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">cloud_upload</span>
<span>Upload Updated Maritime Certificate</span>
</button>
</div>

<div className="bg-primary-container text-on-primary rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md relative overflow-hidden">
<div className="absolute -right-8 -bottom-8 w-36 h-36 bg-secondary/20 rounded-full blur-xl pointer-events-none"></div>
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary-fixed">Personal Maritime Escrow Desk</span>
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary-fixed bg-surface-container-lowest/10 px-2 py-0.5 rounded-full">
<span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed"></span> On Duty
              </span>
</div>
<div className="flex items-center gap-space-md pt-space-xs">
<div className="relative w-14 h-14 rounded-full overflow-hidden bg-surface-container shrink-0">
<img alt="" className="w-full h-full object-cover" src="/design/752e8dfa88.jpg"/>
</div>
<div className="flex flex-col">
<span className="font-title-lg text-title-lg font-semibold text-on-primary">Elena Soler</span>
<span className="font-body-sm text-body-sm text-on-primary-container">Head of Mediterranean Closing &amp; Escrow</span>
<span className="font-label-sm text-label-sm text-secondary-fixed mt-0.5">Palma de Mallorca · Portofino Liaison</span>
</div>
</div>
<p className="font-body-sm text-body-sm text-on-primary-container">
              “Captain Martorell, the €34,000 earnest deposit for Beneteau GT 40 is quarantined in our client escrow account. Survey arrangements for Thursday are moving forward under Spanish/Italian maritime protocol.”
            </p>
<div className="pt-space-xs flex flex-col sm:flex-row items-center gap-space-sm">
<button className="w-full py-2.5 px-space-md rounded-lg bg-secondary text-on-secondary hover:bg-secondary-fixed hover:text-on-secondary-fixed font-body-md text-body-md font-medium flex items-center justify-center gap-space-xs transition-colors shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">chat</span>
<span>Direct Secure Message</span>
</button>
<button className="w-full sm:w-auto py-2.5 px-space-md rounded-lg bg-surface-container-lowest/10 hover:bg-surface-container-lowest/20 text-on-primary font-body-md text-body-md flex items-center justify-center gap-space-xs transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">call</span>
<span>Call Desk</span>
</button>
</div>
</div>

<div className="p-space-md rounded-xl bg-surface-container-low flex items-start gap-space-sm">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">gavel</span>
<div className="flex flex-col gap-1">
<span className="font-label-md text-label-md text-primary font-semibold">Cross-Border Title Assurance</span>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Nauta escrow releases happen strictly upon simultaneous Italian RID / Spanish DGMM flag deregistration and notarized Bill of Sale transmission.
              </p>
</div>
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
