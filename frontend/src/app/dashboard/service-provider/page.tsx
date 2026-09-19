import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function ProviderDashboard() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<section className="w-full bg-surface-container-low">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl">

<div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-md">
<div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
<span className="text-secondary font-semibold">Portals</span>
<span className="text-outline-variant">/</span>
<span className="text-primary font-bold">Naval Service Provider Desk</span>
<span className="text-outline-variant">/</span>
<span className="text-on-surface-variant">Western Mediterranean Fleet Hub</span>
</div>
<div className="inline-flex items-center gap-space-xs bg-surface-container px-space-sm py-1 rounded-full text-on-surface-variant font-label-sm text-label-sm">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span>Live Operations • Palma 09:42 CEST</span>
</div>
</div>

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="max-w-3xl flex flex-col gap-space-xs">
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
            Talleres Navales del Mediterráneo
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant">
            Palma &amp; Genoa Operations — Accredited Marine Propulsion, Ultrasonic Hull Diagnostics &amp; Electrical Refit Desk. Supervising 18 active yard projects and dockside dispatch orders.
          </p>
<div className="flex flex-wrap items-center gap-space-sm mt-space-xs">
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-highest text-primary font-label-md text-label-md">
<span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
              Official Volvo Penta &amp; MAN Marine Partner
            </span>
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-highest text-primary font-label-md text-label-md">
<span className="material-symbols-outlined text-[16px] text-on-tertiary-container">military_tech</span>
              ISO 9001:2015 &amp; RINA Survey Certified
            </span>
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-secondary-container/40 text-on-secondary-container font-label-md text-label-md">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              Escrow Tier A Provider
            </span>
</div>
</div>

<div className="flex flex-wrap sm:flex-nowrap items-center gap-space-sm shrink-0">
<button className="px-space-md py-space-sm bg-surface-container-lowest text-primary hover:bg-surface-container font-body-md text-body-md rounded-lg shadow-sm transition-colors flex items-center gap-2" type="button">
<span className="material-symbols-outlined text-[18px]">download</span>
            Export Billing &amp; SLA Report
          </button>
<button className="px-space-lg py-space-sm bg-primary-container text-on-primary hover:bg-primary font-body-md text-body-md rounded-lg shadow-md transition-colors flex items-center gap-2" type="button">
<span className="material-symbols-outlined text-[18px]">add_circle</span>
            Log New Work Order
          </button>
</div>
</div>
</div>
</section>

<section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl">
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Active Work Orders</span>
<div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[20px]">directions_boat</span>
</div>
</div>
<div>
<div className="flex items-baseline gap-2">
<span className="font-headline-lg text-headline-lg text-primary">18</span>
<span className="font-title-md text-title-md text-on-surface">Orders</span>
</div>
<p className="font-body-sm text-body-sm text-secondary font-medium mt-1">€84,500 Work-in-Progress Valuation</p>
</div>
<div className="pt-space-xs flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low px-2.5 py-1.5 rounded">
<span>11 Dockside Dispatch</span>
<span className="text-outline-variant">•</span>
<span>7 Dry Dock Haul-Out</span>
</div>
</div>

<div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Inbound RFQs &amp; Quotes</span>
<div className="w-9 h-9 rounded-lg bg-secondary-container/40 flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
</div>
</div>
<div>
<div className="flex items-baseline gap-2">
<span className="font-headline-lg text-headline-lg text-primary">9</span>
<span className="font-title-md text-title-md text-on-surface">Pending</span>
<span className="ml-auto font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">+12% MoM</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Average Response SLA: <strong className="text-on-surface">3.2 hours</strong></p>
</div>
<div className="pt-space-xs flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low px-2.5 py-1.5 rounded">
<span>5 Marina Balear</span>
<span className="text-outline-variant">•</span>
<span>4 Direct Owners</span>
</div>
</div>

<div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Dispatched Technicians</span>
<div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[20px]">engineering</span>
</div>
</div>
<div>
<div className="flex items-baseline gap-2">
<span className="font-headline-lg text-headline-lg text-primary">14</span>
<span className="font-title-md text-title-md text-on-surface">Deployed</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Utilization: 87.5% capacity active</p>
</div>
<div className="pt-space-xs flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low px-2.5 py-1.5 rounded">
<span>Palma (8)</span>
<span className="text-outline-variant">·</span>
<span>Barcelona (3)</span>
<span className="text-outline-variant">·</span>
<span>Genoa (3)</span>
</div>
</div>

<div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col justify-between gap-space-md">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Settled Revenue (MTD)</span>
<div className="w-9 h-9 rounded-lg bg-tertiary-fixed-dim/30 flex items-center justify-center text-tertiary">
<span className="material-symbols-outlined text-[20px]">payments</span>
</div>
</div>
<div>
<div className="flex items-baseline gap-2">
<span className="font-headline-lg text-headline-lg text-primary">€126,800</span>
</div>
<p className="font-body-sm text-body-sm text-secondary font-medium mt-1">94% on-schedule completion score</p>
</div>
<div className="pt-space-xs flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low px-2.5 py-1.5 rounded">
<span>Protected by Nauta Escrow</span>
<span className="text-secondary font-medium">EUR (€)</span>
</div>
</div>
</div>
</section>

<section className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop pb-space-2xl">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">

<div className="lg:col-span-8 flex flex-col gap-space-2xl">

<div className="flex flex-col gap-space-md">

<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Active Pipeline</span>
<h2 className="font-headline-sm text-headline-sm text-primary">Supervised Work Orders &amp; Yard Dispatch</h2>
</div>

<div className="inline-flex p-1 bg-surface-container-high rounded-lg font-label-md text-label-md overflow-x-auto">
<button className="px-3 py-1.5 rounded-md bg-surface-container-lowest text-primary shadow-sm font-semibold whitespace-nowrap" type="button">All Active (18)</button>
<button className="px-3 py-1.5 rounded-md text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" type="button">Dockside (11)</button>
<button className="px-3 py-1.5 rounded-md text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" type="button">Dry Dock (5)</button>
<button className="px-3 py-1.5 rounded-md text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" type="button">Surveys (2)</button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-shadow flex flex-col gap-space-md">
<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-sm">
<div className="flex items-start gap-space-md">
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
<span className="material-symbols-outlined text-[24px]">hardware</span>
</div>
<div>
<div className="flex flex-wrap items-center gap-2">
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">#TNM-2025-084</span>
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                      In Progress (Day 3 of 5)
                    </span>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-tertiary-fixed-dim/30 text-tertiary font-medium">STP Yard Palma • Pier 4</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mt-1">Engine Overhaul &amp; Heat Exchanger Descaling</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">
                    Target Vessel: <strong className="text-primary font-medium">2019 Benetti Oasis 40M — M/Y &quot;Luminosa&quot;</strong> · Berth: Club de Mar, Palma
                  </p>
</div>
</div>
<div className="sm:text-right shrink-0">
<div className="font-spec-num text-[18px] leading-tight font-bold text-primary">€18,400 EUR</div>
<div className="font-label-sm text-label-sm text-secondary font-medium">50% Escrow Settled (€9,200)</div>
</div>
</div>

<div className="bg-surface-container-low rounded-lg p-space-md text-on-surface-variant font-body-sm text-body-sm leading-relaxed">
<span className="font-semibold text-primary">Technical Scope:</span> Twin MTU 12V 2000 M72 1000-hour service protocol, seawater pump impellers replacement, high-pressure fuel injector recalibration, cooling circuit ultrasonic bath flushing. Certified surveyor sign-off planned for Thursday 16:00.
            </div>

<div className="flex flex-wrap items-center justify-between gap-space-md pt-space-xs">
<div className="flex flex-wrap items-center gap-space-md text-on-surface-variant font-body-sm text-body-sm">
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[18px] text-outline">badge</span>
<span>Lead: <strong className="text-on-surface">Chief Eng. Mateo Crespí</strong></span>
</div>
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[18px] text-outline">business</span>
<span>Client: <span className="text-on-surface">Marina Balear Yachting (Broker Mandate)</span></span>
</div>
</div>
<div className="flex items-center gap-2">
<button className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" type="button">
                  Parts Manifest
                </button>
<button className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">call</span>
                  Contact Captain
                </button>
<button className="px-3.5 py-1.5 rounded bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors shadow-sm" type="button">
                  Update Service Log
                </button>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-shadow flex flex-col gap-space-md">
<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-sm">
<div className="flex items-start gap-space-md">
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
<span className="material-symbols-outlined text-[24px]">radar</span>
</div>
<div>
<div className="flex flex-wrap items-center gap-2">
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">#TNM-2025-091</span>
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                      Technician On Site
                    </span>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium">RCN Palma • Slipway B</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mt-1">Ultrasonic Hull Plate &amp; Composite Survey</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">
                    Target Vessel: <strong className="text-primary font-medium">2021 Solaris 50 — S/Y &quot;Sirocco Blue&quot;</strong> · Berth: RCN Palma
                  </p>
</div>
</div>
<div className="sm:text-right shrink-0">
<div className="font-spec-num text-[18px] leading-tight font-bold text-primary">€3,200 EUR</div>
<div className="font-label-sm text-label-sm text-secondary font-medium">Full Escrow Held in Nauta</div>
</div>
</div>

<div className="bg-surface-container-low rounded-lg p-space-md text-on-surface-variant font-body-sm text-body-sm leading-relaxed">
<span className="font-semibold text-primary">Technical Scope:</span> Pre-sale non-destructive ultrasound inspection of structural keelson, carbon grid lamination integrity, and rudder bearing tolerances. Laser alignment of P-bracket and rig tension harmonic test.
            </div>

<div className="flex flex-wrap items-center justify-between gap-space-md pt-space-xs">
<div className="flex flex-wrap items-center gap-space-md text-on-surface-variant font-body-sm text-body-sm">
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[18px] text-outline">verified_user</span>
<span>Lead: <strong className="text-on-surface">Ing. Laura Vilar (RINA Certified)</strong></span>
</div>
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[18px] text-outline">person</span>
<span>Client: <span className="text-on-surface">Capt. Santiago Martorell (Private Owner)</span></span>
</div>
</div>
<div className="flex items-center gap-2">
<button className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">show_chart</span>
                  Telemetry Data
                </button>
<button className="px-3.5 py-1.5 rounded bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors shadow-sm flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">upload_file</span>
                  Upload Survey Dossier
                </button>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-shadow flex flex-col gap-space-md">
<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-sm">
<div className="flex items-start gap-space-md">
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
<span className="material-symbols-outlined text-[24px]">precision_manufacturing</span>
</div>
<div>
<div className="flex flex-wrap items-center gap-2">
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono">#TNM-2025-078</span>
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-error-container/60 text-on-error-container font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                      Awaiting OEM Parts (Delivery Tomorrow)
                    </span>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium">Marina Genova Aeroporto</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mt-1">Hydraulic Passerelle &amp; Bow Thruster Refit</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant">
                    Target Vessel: <strong className="text-primary font-medium">2020 Sanlorenzo SL88 — M/Y &quot;Solaria&quot;</strong> · Berth: Darsena Ponente, Genoa
                  </p>
</div>
</div>
<div className="sm:text-right shrink-0">
<div className="font-spec-num text-[18px] leading-tight font-bold text-primary">€6,750 EUR</div>
<div className="font-label-sm text-label-sm text-secondary font-medium">Milestone 1 Cleared</div>
</div>
</div>

<div className="bg-surface-container-low rounded-lg p-space-md text-on-surface-variant font-body-sm text-body-sm leading-relaxed">
<span className="font-semibold text-primary">Technical Scope:</span> Besenzoni hydraulic telescoping passerelle overhaul, cylinder ring sealing kit replacement, 24V DC auxiliary power relay upgrade and Side-Power 300kgf bow thruster brush servicing.
            </div>

<div className="flex flex-wrap items-center justify-between gap-space-md pt-space-xs">
<div className="flex flex-wrap items-center gap-space-md text-on-surface-variant font-body-sm text-body-sm">
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[18px] text-outline">local_shipping</span>
<span>Courier: <strong className="text-on-surface">DHL Express Waybill #9482-1082-GE</strong></span>
</div>
<div className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[18px] text-outline">handshake</span>
<span>Broker: <span className="text-on-surface">Ligurian Yacht Partners</span></span>
</div>
</div>
<div className="flex items-center gap-2">
<button className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" type="button">
                  Adjust Timeline
                </button>
<button className="px-3.5 py-1.5 rounded bg-surface-container-highest text-primary hover:bg-surface-container font-label-md text-label-md transition-colors flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">pin_drop</span>
                  Track Shipment
                </button>
</div>
</div>
</div>
</div>

<div className="flex flex-col gap-space-md pt-space-sm">
<div className="flex items-center justify-between">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Fast Response Queue</span>
<h2 className="font-headline-sm text-headline-sm text-primary">Direct Service RFQs from Nauta Network</h2>
</div>
<span className="font-label-md text-label-md px-2.5 py-1 rounded-full bg-secondary-container/50 text-secondary font-semibold">
              3 High Priority Requests
            </span>
</div>
<div className="grid grid-cols-1 gap-space-md">

<div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col sm:flex-row items-start justify-between gap-space-lg">
<div className="flex items-start gap-space-md">
<div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0 font-bold font-title-md">
                  GM
                </div>
<div className="flex flex-col gap-1">
<div className="flex flex-wrap items-center gap-2">
<span className="font-title-md text-title-md text-primary">Winterisation &amp; Antifouling Spec</span>
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-secondary font-medium">
<span className="material-symbols-outlined text-[14px]">verified</span>
                      Nauta Verified Client
                    </span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">
                    From: <strong className="text-on-surface">Avv. Giorgio Moretti (Turin)</strong> • Vessel: Sunseeker Predator 68 (M/Y &quot;Azzurra&quot;, Portofino)
                  </p>
<p className="font-body-sm text-body-sm text-on-surface-variant">
                    Requirement: Full underwater hull scraping, copper-free antifouling application, MAN V12 fuel inhibitor preservation. Requested start: Next Monday.
                  </p>
</div>
</div>
<div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0">
<span className="font-label-sm text-label-sm text-outline-variant">Received 42m ago</span>
<div className="flex items-center gap-2">
<button className="px-3 py-1.5 rounded text-on-surface-variant hover:text-error hover:bg-surface-container font-label-md text-label-md transition-colors" type="button">
                    Decline
                  </button>
<button className="px-3.5 py-1.5 rounded bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors" type="button">
                    Send Formal Quote
                  </button>
</div>
</div>
</div>

<div className="p-space-lg bg-surface-container-lowest rounded-xl shadow-sm flex flex-col sm:flex-row items-start justify-between gap-space-lg">
<div className="flex items-start gap-space-md">
<div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed shrink-0 font-bold font-title-md">
                  LF
                </div>
<div className="flex flex-col gap-1">
<div className="flex flex-wrap items-center gap-2">
<span className="font-title-md text-title-md text-primary">Emergency Generator Diagnostics (Kohler 19kW)</span>
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded bg-error-container text-on-error-container font-semibold">
                      Urgent Dockside Call
                    </span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">
                    From: <strong className="text-on-surface">Capitaine Luc Fournier (Monaco)</strong> • Vessel: Riva 76 Bahamas (Berth: Pantalan del Rey, Palma)
                  </p>
<p className="font-body-sm text-body-sm text-on-surface-variant">
                    Issue: Intermittent electrical tripping under high load with 2x chilled water AC units active. Requires immediate mobile diagnosis unit.
                  </p>
</div>
</div>
<div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0">
<span className="font-label-sm text-label-sm text-outline-variant">Received 1h 15m ago</span>
<div className="flex items-center gap-2">
<button className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container font-label-md text-label-md transition-colors" type="button">
                    Review Specs
                  </button>
<button className="px-3.5 py-1.5 rounded bg-secondary text-on-secondary hover:bg-on-secondary-container font-label-md text-label-md transition-colors flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">bolt</span>
                    Dispatch Technician
                  </button>
</div>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
<div className="flex items-center justify-between">
<span className="font-headline-sm text-headline-sm text-primary">Fleet Diagnostic Benchmarks (Q1-Q2)</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Calibrated against Mediterranean Sea Water Salinity &amp; Thermal Loads</span>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md pt-space-xs">
<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-3">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Propulsion Health Index</span>
<span className="font-spec-num text-spec-num font-bold text-secondary">98.2%</span>
</div>

<div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "98%"}}></div>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant">42 MTU &amp; Volvo Penta units monitored</span>
</div>
<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-3">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">RINA Pass Rate (1st Inspection)</span>
<span className="font-spec-num text-spec-num font-bold text-primary">100%</span>
</div>
<div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{"width": "100%"}}></div>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant">19 surveys logged year to date</span>
</div>
<div className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-3">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Dockside Turnaround SLA</span>
<span className="font-spec-num text-spec-num font-bold text-secondary">4.4 Days</span>
</div>
<div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
<div className="bg-secondary-fixed-dim h-full rounded-full" style={{"width": "82%"}}></div>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant">-1.2 days vs regional yard benchmark</span>
</div>
</div>
</div>
</div>

<div className="lg:col-span-4 flex flex-col gap-space-xl">

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
<div className="flex items-center justify-between">
<span className="font-title-md text-title-md text-primary">Marina Access Passes</span>
<span className="font-label-sm text-label-sm text-secondary font-semibold">W-Med Network</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">
            Official dry dock security clearance, vehicle ramp passes, and slipway authorizations.
          </p>
<div className="flex flex-col gap-space-sm mt-1">

<div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-[20px] text-secondary">domain_verification</span>
<div>
<div className="font-label-md text-label-md font-semibold text-primary">STP Shipyard Palma</div>
<div className="font-label-sm text-label-sm text-on-surface-variant">Gate Pin Valid until Dec 2025</div>
</div>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">Active</span>
</div>

<div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-[20px] text-secondary">domain_verification</span>
<div>
<div className="font-label-md text-label-md font-semibold text-primary">MB92 Barcelona</div>
<div className="font-label-sm text-label-sm text-on-surface-variant">Tier 1 Contractor Registered</div>
</div>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">Verified</span>
</div>

<div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-[20px] text-secondary">domain_verification</span>
<div>
<div className="font-label-md text-label-md font-semibold text-primary">Marina Porto Antico Genoa</div>
<div className="font-label-sm text-label-sm text-on-surface-variant">Gate &amp; Pier Pass Verified</div>
</div>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">Active</span>
</div>

<div className="p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-[20px] text-outline">pending</span>
<div>
<div className="font-label-md text-label-md font-semibold text-primary">Viareggio Perini Yard</div>
<div className="font-label-sm text-label-sm text-on-surface-variant">Annual Renewal under review</div>
</div>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">Pending</span>
</div>
</div>
<button className="w-full py-2 bg-surface-container-high text-primary hover:bg-surface-container font-label-md text-label-md rounded-lg transition-colors flex items-center justify-center gap-1.5" type="button">
<span className="material-symbols-outlined text-[16px]">add_moderator</span>
            Submit New Marina Authorization Pass
          </button>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
<div className="flex items-center justify-between">
<span className="font-title-md text-title-md text-primary">Technician Roster</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">14 / 16 Field Staff</span>
</div>

<div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
<div className="bg-primary h-full rounded-full" style={{"width": "87.5%"}}></div>
</div>
<div className="flex flex-col divide-y divide-surface-container-low">

<div className="py-space-sm flex items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-sm min-w-0">
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  MC
                </div>
<div className="truncate">
<div className="font-title-md text-body-md font-semibold text-primary truncate">Mateo Crespí</div>
<div className="font-label-sm text-label-sm text-on-surface-variant truncate">Master Propulsion • STP Palma</div>
</div>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary-container/40 text-secondary font-medium shrink-0">
                #084 Active
              </span>
</div>

<div className="py-space-sm flex items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-sm min-w-0">
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  LV
                </div>
<div className="truncate">
<div className="font-title-md text-body-md font-semibold text-primary truncate">Ing. Laura Vilar</div>
<div className="font-label-sm text-label-sm text-on-surface-variant truncate">RINA Hull Surveyor • RCN Palma</div>
</div>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary-container/40 text-secondary font-medium shrink-0">
                #091 Active
              </span>
</div>

<div className="py-space-sm flex items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-sm min-w-0">
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  PN
                </div>
<div className="truncate">
<div className="font-title-md text-body-md font-semibold text-primary truncate">Paolo Neri</div>
<div className="font-label-sm text-label-sm text-on-surface-variant truncate">Marine Electronics • Genoa Aeroporto</div>
</div>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary-container/40 text-secondary font-medium shrink-0">
                #078 Active
              </span>
</div>

<div className="py-space-sm flex items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-sm min-w-0">
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  JM
                </div>
<div className="truncate">
<div className="font-title-md text-body-md font-semibold text-primary truncate">Jordi Muntaner</div>
<div className="font-label-sm text-label-sm text-on-surface-variant truncate">Hydraulics &amp; Rigging • MB92 BCN</div>
</div>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium shrink-0">
                Standby
              </span>
</div>

<div className="py-space-sm flex items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-sm min-w-0">
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  DR
                </div>
<div className="truncate">
<div className="font-title-md text-body-md font-semibold text-primary truncate">Davide Rossi</div>
<div className="font-label-sm text-label-sm text-on-surface-variant truncate">HVAC &amp; Watermakers • Genoa Yard</div>
</div>
</div>
<span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary-container/40 text-secondary font-medium shrink-0">
                Dispatched
              </span>
</div>
</div>
</div>

<div className="bg-surface-container-high rounded-xl p-space-lg flex flex-col gap-space-sm">
<div className="flex items-center gap-2 text-primary">
<span className="material-symbols-outlined text-[22px] text-secondary">security</span>
<h3 className="font-title-lg text-title-lg">Nauta Service Protection</h3>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            All naval work orders hold guaranteed milestone deposits in segregated Santander &amp; Intesa Sanpaolo escrow accounts. Payment release occurs upon mutual sign-off by client captain and certified lead surveyor after official sea trials.
          </p>
<div className="mt-space-xs pt-space-xs flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
<span>Escrow Trust Partner</span>
<span className="font-semibold text-primary">Santander Corporate Maritime</span>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-sm">
<div className="flex items-center justify-between">
<span className="font-title-md text-title-md text-primary">Yard Duty Desk</span>
<span className="font-label-sm text-label-sm text-secondary font-medium">Palma Pier 4</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">
            Emergency mobile dispatch unit stationed at Muelle Viejo. Response window for Palma bay: under 45 minutes.
          </p>
<div className="p-space-sm rounded-lg bg-surface-container-low flex items-center gap-3">
<span className="material-symbols-outlined text-[22px] text-primary">support_agent</span>
<div>
<div className="font-body-sm text-body-sm font-semibold text-primary">Duty Dispatch Radio: VHF Ch. 12</div>
<div className="font-label-sm text-label-sm text-on-surface-variant">+34 971 492 811 (24/7 Naval Desk)</div>
</div>
</div>
</div>
</div>
</div>
</section>
</div>
      </RequirePermission>
    </main>
  );
}
