import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function ProviderProfile() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<div className="w-full bg-primary text-on-primary py-space-xs px-margin-mobile md:px-margin lg:px-margin-desktop shadow-sm">
<div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-space-sm">
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-label-sm tracking-wider uppercase">
<span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-pulse"></span>
          Prototype Mode
        </span>
<span className="font-spec-num text-spec-num text-on-primary font-medium tracking-tight">
          SERVICE PROVIDER — Talleres Navales del Mediterráneo S.L. (Palma)
        </span>
</div>
<div className="flex items-center gap-space-md">
<button className="inline-flex items-center gap-1 font-label-md text-secondary-container hover:text-on-secondary transition-colors cursor-pointer" type="button">
<span className="material-symbols-outlined text-[16px]">sync_alt</span>
          Switch Demo Role
        </button>
<span className="text-outline-variant opacity-60">|</span>
<button className="inline-flex items-center gap-1 font-label-md text-outline-variant hover:text-on-primary transition-colors cursor-pointer" type="button">
<span className="material-symbols-outlined text-[16px]">logout</span>
          Log Out
        </button>
</div>
</div>
</div>

<div className="w-full bg-surface-container-lowest shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex items-center justify-between overflow-x-auto no-scrollbar">
<nav className="flex items-center gap-space-xl py-space-sm whitespace-nowrap">
<Link href="#" className="inline-flex items-center gap-2 font-body-md text-on-surface-variant hover:text-primary transition-colors py-2" >
<span className="material-symbols-outlined text-[18px]">dashboard</span>
          Overview
        </Link>
<Link href="#" className="inline-flex items-center gap-2 font-body-md text-on-surface-variant hover:text-primary transition-colors py-2 relative" >
<span className="material-symbols-outlined text-[18px]">build_circle</span>
          Service Requests
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-secondary text-on-secondary">4</span>
</Link>
<Link href="#" className="inline-flex items-center gap-2 font-body-md text-on-surface-variant hover:text-primary transition-colors py-2" >
<span className="material-symbols-outlined text-[18px]">engineering</span>
          Provider Services
        </Link>
<Link href="#" className="inline-flex items-center gap-2 font-title-md text-primary font-semibold py-2 relative text-secondary" >
<span className="material-symbols-outlined text-[18px]" style={{"fontVariationSettings": "'FILL' 1"}}>badge</span>
          Professional Profile
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-full"></span>
</Link>
<Link href="#" className="inline-flex items-center gap-2 font-body-md text-on-surface-variant hover:text-primary transition-colors py-2" >
<span className="material-symbols-outlined text-[18px]">receipt_long</span>
          Escrow &amp; Invoices
        </Link>
</nav>
<div className="hidden lg:flex items-center gap-space-sm pl-space-md shrink-0">
<span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Yard Operations:</span>
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/30 text-secondary font-label-md">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
          STP Palma Berths 14–18 Ready
        </span>
</div>
</div>
</div>

<div className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg mb-space-xl">
<div className="max-w-3xl">
<div className="flex items-center gap-2 text-secondary font-label-md uppercase tracking-wider mb-space-xs">
<span className="material-symbols-outlined text-[18px]">verified</span>
          Accredited Marine Shipyard Directory
        </div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Shipyard &amp; Professional Profile</h1>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
          Manage your legal registration, shipyard facilities, certified team credentials, and public visibility in the Nauta Maritime Directory across the Western Mediterranean.
        </p>
</div>
<div className="flex flex-wrap items-center gap-space-sm shrink-0">
<Link href="#" className="inline-flex items-center justify-center gap-2 px-space-md py-space-sm rounded-lg bg-surface-container-high text-primary hover:bg-surface-container-highest transition-colors font-title-md text-title-md shadow-sm" >
<span className="material-symbols-outlined text-[20px]">visibility</span>
          View Public Directory Profile
        </Link>
<button className="inline-flex items-center justify-center gap-2 px-space-lg py-space-sm rounded-lg bg-primary-container text-on-primary hover:bg-primary transition-all font-title-md text-title-md shadow-md" type="button">
<span className="material-symbols-outlined text-[20px]">save</span>
          Save Changes
        </button>
</div>
</div>

<div className="w-full bg-surface-container-lowest rounded-xl p-space-lg shadow-sm mb-space-2xl">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-center">

<div className="lg:col-span-4 flex items-center gap-space-md">
<div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
<svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
<path className="text-surface-container-highest" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
<path className="text-secondary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="98, 100" strokeLinecap="round" strokeWidth="3"></path>
</svg>
<span className="absolute font-spec-num text-title-lg text-primary font-bold">98%</span>
</div>
<div>
<div className="flex items-center gap-2">
<h3 className="font-title-lg text-title-lg text-primary font-semibold">Institutional Grade Profile</h3>
<span className="material-symbols-outlined text-secondary text-[20px]" style={{"fontVariationSettings": "'FILL' 1"}}>workspace_premium</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Top-tier commercial readiness rating. Eligible for escrow automated disbursements up to €250k.</p>
</div>
</div>

<div className="lg:col-span-8 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-end gap-space-sm">
<div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low text-primary">
<span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Registry</span>
<span className="font-title-md text-[13px] font-semibold">KYB Verified (Reg. Mercantil Mallorca)</span>
</div>
</div>
<div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low text-primary">
<span className="material-symbols-outlined text-on-tertiary-container text-[18px]">anchor</span>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Association</span>
<span className="font-title-md text-[13px] font-semibold">IIMS Marine Guild Partner</span>
</div>
</div>
<div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low text-primary">
<span className="material-symbols-outlined text-secondary text-[18px]">shield</span>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Coverage</span>
<span className="font-title-md text-[13px] font-semibold">Lloyd&apos;s Marine Liability Insured</span>
</div>
</div>
</div>
</div>

<div className="mt-space-md pt-space-md bg-surface-container-low/60 rounded-lg px-space-md py-space-sm flex flex-wrap items-center justify-between gap-space-sm">
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-md text-label-md text-on-surface-variant uppercase">Tax / VIES Identification:</span>
<span className="font-spec-num text-body-md text-primary font-semibold tracking-wide">ES-B07892109</span>
<span className="text-outline-variant">·</span>
<span className="font-body-sm text-body-sm text-secondary font-medium">Validated for EU Cross-Border Reverse Charge (Art. 196 EU VAT Directive)</span>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant">Last verified: 04 Mar 2025 · Verified via AEAT Tax Gateway</span>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">

<div className="lg:col-span-7 flex flex-col gap-space-xl">

<section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm">
<div className="flex items-start justify-between gap-space-md pb-space-lg">
<div>
<div className="flex items-center gap-2 text-secondary font-label-md uppercase tracking-wider mb-1">
<span className="material-symbols-outlined text-[18px]">domain</span>
                Registry &amp; Facilities
              </div>
<h2 className="font-headline-sm text-headline-sm text-primary">Company Details &amp; Yard Identification</h2>
</div>
<span className="px-2.5 py-1 rounded-full bg-surface-container-high text-primary font-label-sm font-semibold">
              ID: STP-PLM-0041
            </span>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg mb-space-lg">
<div className="bg-surface-container-low/50 p-space-md rounded-lg">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1">Legal Corporate Entity</span>
<p className="font-title-md text-title-md text-primary font-semibold">Talleres Navales del Mediterráneo S.L.</p>
<span className="font-body-sm text-body-sm text-on-surface-variant">Sociedad Limitada Naval Registrada</span>
</div>
<div className="bg-surface-container-low/50 p-space-md rounded-lg">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1">Commercial / Trade Name</span>
<p className="font-title-md text-title-md text-primary font-semibold">Talleres Navales Palma</p>
<span className="font-body-sm text-body-sm text-on-surface-variant">Public Directory Listing Brand</span>
</div>
</div>

<div className="mb-space-lg">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-2">Primary Yard / Workshop Headquarters</span>
<div className="bg-surface-container-low rounded-lg p-space-md flex flex-col md:flex-row gap-space-md items-start justify-between mb-space-md">
<div className="flex items-start gap-3">
<span className="material-symbols-outlined text-secondary text-[24px] mt-0.5">location_on</span>
<div>
<p className="font-body-md text-body-md text-primary font-medium leading-snug">
                    STP Shipyard Palma, Edificio Global Dársena, 07012 Palma de Mallorca, Illes Balears
                  </p>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Direct access via Moll Vell gate. Drydock haul-out facilities up to 120m LOA / 700T travelift.
                  </p>
</div>
</div>
<Link href="#" className="shrink-0 inline-flex items-center gap-1 font-label-md text-secondary hover:underline self-end md:self-center" >
                Get Directions <span className="material-symbols-outlined text-[14px]">open_in_new</span>
</Link>
</div>

<div className="w-full h-44 rounded-lg bg-surface-container relative overflow-hidden shadow-inner flex items-end p-space-md" style={{"backgroundImage": "url('/design/26b5f516db.jpg')"}}>
<div className="bg-primary/90 backdrop-blur-sm text-on-primary px-space-md py-space-xs rounded-lg flex items-center gap-3">
<span className="material-symbols-outlined text-secondary-fixed text-[18px]">satellite_alt</span>
<span className="font-label-md text-label-md">Coordinates: 39°33&apos;56.2&quot;N 2°38&apos;29.8&quot;E · Dársena STP Palma</span>
</div>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-space-md pt-space-sm">
<div className="p-space-md rounded-lg bg-surface-container-low">
<div className="flex items-center gap-2 mb-1">
<span className="material-symbols-outlined text-secondary text-[20px]">podcasts</span>
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Radio VHF Channel</span>
</div>
<p className="font-title-md text-title-md text-primary font-semibold">Ch 68 / Ch 09</p>
<span className="font-body-sm text-body-sm text-on-surface-variant">Monitoring 07:30 – 20:00 CET daily</span>
</div>
<div className="p-space-md rounded-lg bg-surface-container-low">
<div className="flex items-center gap-2 mb-1">
<span className="material-symbols-outlined text-secondary text-[20px]">e911_emergency</span>
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Emergency Rapid Dispatch</span>
</div>
<p className="font-title-md text-title-md text-primary font-semibold">+34 971 789 200</p>
<span className="font-body-sm text-body-sm text-secondary font-medium">24/7 Mobile Marine Dispatch Unit</span>
</div>
</div>

<div className="mt-space-md p-space-md rounded-lg bg-surface-container-low">
<div className="flex items-center gap-2 mb-2">
<span className="material-symbols-outlined text-secondary text-[20px]">airport_shuttle</span>
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Mobile Service Van Fleet Coverage</span>
</div>
<div className="flex flex-wrap gap-2">
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest text-primary text-body-sm font-medium shadow-xs">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Palma Bay (STP, Club de Mar, RCNP)
              </span>
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest text-primary text-body-sm font-medium shadow-xs">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Puerto Portals
              </span>
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest text-primary text-body-sm font-medium shadow-xs">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Port Adriano
              </span>
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest text-primary text-body-sm font-medium shadow-xs">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Marina de Sa Ràpita
              </span>
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest text-primary text-body-sm font-medium shadow-xs">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Alcudiamar (North Island Hub)
              </span>
</div>
</div>
</section>

<section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm">
<div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-md">
<div>
<div className="flex items-center gap-2 text-secondary font-label-md uppercase tracking-wider mb-1">
<span className="material-symbols-outlined text-[18px]">translate</span>
                Directory Presentation
              </div>
<h2 className="font-headline-sm text-headline-sm text-primary">Public Narrative &amp; Multilingual Bio</h2>
</div>

<div className="inline-flex p-1 rounded-lg bg-surface-container-low font-label-md" id="bioTabs">
<button className="px-3 py-1.5 rounded bg-primary text-on-primary font-medium transition-all" id="tab-en" type="button">
                English (Master)
              </button>
<button className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary font-medium transition-all" id="tab-it" type="button">
                Italian (Translated)
              </button>
<button className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary font-medium transition-all" id="tab-es" type="button">
                Spanish (Translated)
              </button>
</div>
</div>

<div className="flex items-center justify-between gap-space-sm py-2 px-3 rounded-lg bg-surface-container-low mb-space-md">
<div className="flex items-center gap-2" id="bioStatus">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider">Original Master Source · Brokerage Approved</span>
</div>
<button className="inline-flex items-center gap-1 font-label-sm text-secondary hover:underline cursor-pointer" type="button">
<span className="material-symbols-outlined text-[14px]">sync</span>
              Re-synchronize AI translations
            </button>
</div>

<div className="relative min-h-[160px] bg-surface-container-low/40 rounded-lg p-space-lg">

<div className="block" id="content-en">
<p className="font-body-lg text-body-lg text-on-surface leading-relaxed italic">
                “Founded in 2004 inside the historic STP Palma refit complex, Talleres Navales del Mediterráneo provides gold-standard marine engineering, engine rebuilds, saildrive servicing, and non-destructive acoustic ultrasonic hull diagnostics. Trusted by charter fleets and private yacht owners across the Western Mediterranean.”
              </p>
<div className="mt-space-md pt-space-sm flex items-center justify-between text-body-sm text-on-surface-variant">
<span>Words: 43 · Character count: 326</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Last revised by Ing. Mateo Rosselló</span>
</div>
</div>

<div className="hidden" id="content-it">
<p className="font-body-lg text-body-lg text-on-surface leading-relaxed italic">
                “Fondata nel 2004 all&apos;interno dello storico cantiere di refit STP Palma, Talleres Navales del Mediterráneo offre ingegneria navale di massimo livello, revisione motori, manutenzione saildrive e diagnostica acustica a ultrasuoni non distruttiva per scafi. Scelta affidabile per flotte charter e armatori privati in tutto il Mediterraneo occidentale.”
              </p>
<div className="mt-space-md pt-space-sm flex items-center justify-between text-body-sm text-on-surface-variant">
<span className="inline-flex items-center gap-1 text-secondary font-medium">
<span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  Nauta AI Nautical Lexicon v4.2 · Certified Translation
                </span>
<button className="font-label-sm text-primary underline" type="button">Edit manually</button>
</div>
</div>

<div className="hidden" id="content-es">
<p className="font-body-lg text-body-lg text-on-surface leading-relaxed italic">
                “Fundada en 2004 dentro del emblemático complejo de refit STP Palma, Talleres Navales del Mediterráneo ofrece ingeniería marina de máximo nivel, reconstrucción de motores, servicio técnico de saildrives y diagnóstico ultrasónico acústico no destructivo de cascos. La elección de confianza para flotas de chárter y armadores en todo el Mediterráneo occidental.”
              </p>
<div className="mt-space-md pt-space-sm flex items-center justify-between text-body-sm text-on-surface-variant">
<span className="inline-flex items-center gap-1 text-secondary font-medium">
<span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  Nauta AI Nautical Lexicon v4.2 · Certified Translation
                </span>
<button className="font-label-sm text-primary underline" type="button">Edit manually</button>
</div>
</div>
</div>
<p className="font-label-sm text-label-sm text-on-surface-variant mt-space-sm">
            AI translation tailored for maritime legal accuracy and technical terminology. Verified by yard engineering management.
          </p>
</section>
</div>

<div className="lg:col-span-5 flex flex-col gap-space-xl">

<section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm">
<div className="pb-space-md">
<div className="flex items-center gap-2 text-secondary font-label-md uppercase tracking-wider mb-1">
<span className="material-symbols-outlined text-[18px]">verified</span>
              Accreditations &amp; Underwriting
            </div>
<h2 className="font-headline-sm text-headline-sm text-primary">Certifications, Guilds &amp; Insurance</h2>
</div>

<div className="space-y-space-sm mb-space-lg">
<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-3">
<div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-xs">
<span className="material-symbols-outlined text-primary text-[22px]">settings_suggest</span>
</div>
<div className="min-w-0 flex-1">
<div className="flex items-center justify-between gap-1">
<h4 className="font-title-md text-title-md text-primary font-semibold truncate">Volvo Penta Certified Marine Specialist</h4>
<span className="font-label-sm text-secondary font-semibold shrink-0">Valid 2026</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Registration: #VP-ES-8821 · Electronic Vessel Control (EVC) &amp; IPS certified workshop.</p>
</div>
</div>
<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-3">
<div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-xs">
<span className="material-symbols-outlined text-primary text-[22px]">build</span>
</div>
<div className="min-w-0 flex-1">
<div className="flex items-center justify-between gap-1">
<h4 className="font-title-md text-title-md text-primary font-semibold truncate">Yanmar Marine Master Technician</h4>
<span className="font-label-sm text-secondary font-semibold shrink-0">Active</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Authorization: #YM-2024-09 · Common Rail &amp; mechanical diesel service lab.</p>
</div>
</div>
<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-3">
<div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-xs">
<span className="material-symbols-outlined text-primary text-[22px]">military_tech</span>
</div>
<div className="min-w-0 flex-1">
<div className="flex items-center justify-between gap-1">
<h4 className="font-title-md text-title-md text-primary font-semibold truncate">IIMS Corporate Affiliate</h4>
<span className="font-label-sm text-on-tertiary-container font-semibold shrink-0">Guild Partner</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">International Institute of Marine Surveying standard alignment.</p>
</div>
</div>
<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-3">
<div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-xs">
<span className="material-symbols-outlined text-primary text-[22px]">graphic_eq</span>
</div>
<div className="min-w-0 flex-1">
<div className="flex items-center justify-between gap-1">
<h4 className="font-title-md text-title-md text-primary font-semibold truncate">RINA Accredited NDT Testing</h4>
<span className="font-label-sm text-secondary font-semibold shrink-0">Class RINA</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Ultrasonic composite &amp; metal acoustic hull inspection qualification.</p>
</div>
</div>
</div>

<div className="p-space-md rounded-xl bg-primary-container text-on-primary">
<div className="flex items-center justify-between gap-2 mb-2">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary-fixed text-[20px]">policy</span>
<span className="font-label-md text-label-md text-secondary-fixed uppercase tracking-wider">Shipyard &amp; Marine Indemnity</span>
</div>
<span className="px-2 py-0.5 rounded text-[11px] font-bold bg-secondary text-on-secondary">Active Policy</span>
</div>
<div className="space-y-1 mb-space-md">
<div className="flex justify-between text-body-sm">
<span className="text-on-primary-container">Policy Underwriter:</span>
<span className="text-on-primary font-medium">Hiscox Marine &amp; General Syndicate</span>
</div>
<div className="flex justify-between text-body-sm">
<span className="text-on-primary-container">Maximum Coverage:</span>
<span className="text-on-primary font-spec-num font-semibold">€5,000,000 per incident</span>
</div>
<div className="flex justify-between text-body-sm">
<span className="text-on-primary-container">Territorial Limits:</span>
<span className="text-on-primary font-medium">Western Mediterranean &amp; Yard Moorings</span>
</div>
</div>
<Link href="#" className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-space-md rounded-lg bg-surface-container-lowest text-primary hover:bg-surface-container font-title-md text-title-md transition-colors shadow-sm" >
<span className="material-symbols-outlined text-primary text-[18px]">download_for_offline</span>
              Talleres_Navales_Hiscox_Policy_2025.pdf
            </Link>
</div>
</section>

<section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm">
<div className="flex items-center justify-between pb-space-md">
<div>
<div className="flex items-center gap-2 text-secondary font-label-md uppercase tracking-wider mb-1">
<span className="material-symbols-outlined text-[18px]">groups</span>
                Technical Roster
              </div>
<h2 className="font-headline-sm text-headline-sm text-primary">Shipyard Team &amp; Engineers</h2>
</div>
<button className="inline-flex items-center gap-1 font-label-md text-secondary hover:underline cursor-pointer" type="button">
<span className="material-symbols-outlined text-[16px]">add</span> Add Member
            </button>
</div>
<div className="space-y-space-md">

<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-md">
<div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-surface-container">
<img alt="" className="w-full h-full object-cover" src="/design/86bd8265b4.jpg"/>
</div>
<div className="min-w-0 flex-1">
<div className="flex items-center justify-between">
<h4 className="font-title-md text-title-md text-primary font-semibold truncate">Ing. Mateo Rosselló</h4>
<span className="font-label-sm text-secondary font-medium">Lead</span>
</div>
<p className="font-body-sm text-body-sm text-secondary font-medium">Master Engineer &amp; Chief Diesel Specialist</p>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">28 years marine propulsion experience · Former Astilleros de Mallorca Technical Director</p>
</div>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-md">
<div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-surface-container">
<img alt="" className="w-full h-full object-cover" src="/design/041d025292.jpg"/>
</div>
<div className="min-w-0 flex-1">
<div className="flex items-center justify-between">
<h4 className="font-title-md text-title-md text-primary font-semibold truncate">David Bennasar</h4>
<span className="font-label-sm text-on-surface-variant">Specialist</span>
</div>
<p className="font-body-sm text-body-sm text-secondary font-medium">Electronics &amp; Power Architect</p>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">NMEA 2000 Advanced Installer · Mastervolt &amp; Victron High-Voltage Lithium Systems</p>
</div>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-md">
<div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-surface-container">
<img alt="" className="w-full h-full object-cover" src="/design/3629b97ed0.jpg"/>
</div>
<div className="min-w-0 flex-1">
<div className="flex items-center justify-between">
<h4 className="font-title-md text-title-md text-primary font-semibold truncate">Marco Valli</h4>
<span className="font-label-sm text-on-surface-variant">Inspector</span>
</div>
<p className="font-body-sm text-body-sm text-secondary font-medium">Rigging &amp; NDT Ultrasonic Inspector</p>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">IIMS Level 3 Acoustic Hull Inspector · Certified Rod Rigging Re-heading Engineer</p>
</div>
</div>
</div>
<div className="mt-space-md p-space-sm rounded-lg bg-surface-container-low text-center">
<span className="font-body-sm text-body-sm text-on-surface-variant">
              All 14 yard technicians hold certified Spanish Social Security Régimen Especial del Mar insurance.
            </span>
</div>
</section>
</div>
</div>

<div className="mt-space-2xl w-full p-space-lg rounded-xl bg-surface-container-low border-dashed border-2 border-outline-variant/30 flex flex-col md:flex-row items-center justify-between gap-space-lg">
<div>
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest font-semibold block mb-1">Advertisement · Maritime Partner Network</span>
<h4 className="font-headline-sm text-headline-sm text-primary">Tirreno Marine Chronometers &amp; Bridge Systems</h4>
<p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
          Precision naval timekeeping and integrated bridge digital synchronization for superyachts and Mediterranean commercial fleets.
        </p>
</div>
<Link href="#" className="shrink-0 px-space-md py-space-sm rounded-lg bg-surface-container-lowest text-primary hover:bg-surface-container-high transition-colors font-title-md text-title-md shadow-xs" >
        Request Shipyard Wholesale Catalog
      </Link>
</div>
</div>


</div>
      </RequirePermission>
    </main>
  );
}
