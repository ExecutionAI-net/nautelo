import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function ProviderRequestDetail() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<aside aria-label="Prototype Mode Bar" className="w-full bg-primary-container text-on-primary px-margin-mobile md:px-margin lg:px-margin-desktop py-2.5 shadow-sm">
<div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-space-sm">
<span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
<span className="font-label-md uppercase tracking-wider text-secondary-fixed font-bold">Prototype Mode</span>
<span className="text-on-primary-container hidden sm:inline">|</span>
<span className="font-medium text-surface-bright">Service Provider — Talleres Navales del Mediterráneo S.L. (STP Palma Berth Facility)</span>
</div>
<div className="flex items-center gap-space-md font-label-md">
<button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary text-secondary-fixed hover:bg-surface-tint/20 transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">swap_horiz</span>
          Switch Demo Role
        </button>
<button className="inline-flex items-center gap-1 text-on-primary-container hover:text-on-primary transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">logout</span>
          Log Out
        </button>
</div>
</div>
</aside>

<section className="w-full bg-surface-container-low shadow-[0_1px_0_rgba(0,0,0,0.04)]">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop pt-6">
<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-6">
<div className="flex items-center gap-space-md">
<div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center font-headline-sm shadow-md">
            TN
          </div>
<div>
<div className="flex items-center gap-2">
<h1 className="font-headline-sm text-headline-sm text-primary tracking-tight">Talleres Navales del Mediterráneo S.L.</h1>
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container font-label-sm">
<span className="material-symbols-outlined text-[14px]">verified</span> OEM Marine Engineering
              </span>
</div>
<p className="font-body-sm text-on-surface-variant flex items-center gap-2 mt-0.5">
<span>CIF: B-07992140</span>
<span>·</span>
<span>STP Shipyard Global ID #8841-ES</span>
<span>·</span>
<span className="text-secondary font-medium">Certified Volvo Penta &amp; Yanmar Gold Master</span>
</p>
</div>
</div>

<div className="flex items-center gap-3 bg-surface-container-lowest p-2.5 rounded-xl shadow-sm">
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[20px]">shield_lock</span>
</div>
<div className="pr-2">
<p className="font-label-sm uppercase tracking-wider text-on-surface-variant">Active In-Escrow Funds</p>
<p className="font-title-md text-primary">€42,850.00 <span className="font-body-sm text-secondary font-normal">(4 vessels)</span></p>
</div>
</div>
</div>

<nav className="flex items-center gap-space-lg overflow-x-auto text-body-md font-medium text-on-surface-variant scrollbar-none">
<Link href="#" className="pb-3 text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" >Overview</Link>
<Link href="#" className="pb-3 text-primary font-semibold shadow-[0_2px_0_#001520] flex items-center gap-2 whitespace-nowrap" >
<span>Service Requests</span>
<span className="w-5 h-5 rounded-full bg-primary text-on-primary font-label-sm flex items-center justify-center">3</span>
</Link>
<Link href="#" className="pb-3 text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" >Provider Services &amp; Rates</Link>
<Link href="#" className="pb-3 text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" >Professional Profile</Link>
<Link href="#" className="pb-3 text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap" >Escrow &amp; Invoices</Link>
</nav>
</div>
</section>

<main className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl">

<div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg">
<div className="flex flex-col gap-1">
<div className="flex items-center gap-2 font-body-sm text-on-surface-variant">
<Link href="#" className="text-secondary hover:underline flex items-center gap-1 font-medium" >
<span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to All Requests
          </Link>
<span>/</span>
<span>Requests</span>
<span>/</span>
<span className="text-primary font-semibold">#REQ-2025-084</span>
<span>/</span>
<span className="text-on-surface">Formal Proposal &amp; Work Order Specification</span>
</div>
<div className="flex flex-wrap items-center gap-3 mt-1">
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/50 text-on-secondary-container font-label-md">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
            Status: Request Open · Escrow Deposit Pre-Authorized
          </span>
<span className="font-body-sm text-on-surface-variant flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">schedule</span> Expires in 48h 12m
          </span>
<span className="font-body-sm text-on-surface-variant">
            · Primary Jurisdiction: <strong className="text-primary font-medium">Autoridad Portuaria de Baleares (Palma)</strong>
</span>
</div>
</div>
<div className="flex items-center gap-space-sm shrink-0">
<button className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-body-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">chat</span>
          Direct Skipper Comms
        </button>
<button className="px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary font-body-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">share</span>
          Share with Foreman
        </button>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

<div className="lg:col-span-5 flex flex-col gap-space-lg">

<article className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
<div className="relative w-full h-56 bg-surface-container">
<img alt="" className="w-full h-full object-cover" src="/design/7952117aaf.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent"></div>
<div className="absolute top-3 left-3 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded-md text-primary font-label-md flex items-center gap-1 shadow-sm">
<span className="material-symbols-outlined text-[16px] text-secondary">anchor</span>
              Solaris 50 Performance Cruiser
            </div>
<div className="absolute top-3 right-3 bg-primary/80 backdrop-blur-md px-2.5 py-1 rounded-md text-surface-bright font-spec-num text-body-sm">
              MY 2021
            </div>
<div className="absolute bottom-3 left-4 right-4 text-on-primary">
<h2 className="font-headline-sm text-headline-sm tracking-tight text-surface-bright">Baleares Express</h2>
<p className="font-body-sm text-surface-dim flex items-center gap-1.5 mt-0.5">
<span className="material-symbols-outlined text-[16px] text-secondary-fixed">location_on</span>
                Real Club Náutico de Palma (RCNP), Pier 4, Slip 18
              </p>
</div>
</div>

<div className="p-5 flex flex-col gap-4">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Naval &amp; Powerplant Specs</span>
<span className="font-label-sm text-secondary font-semibold">Flag: Spain (6ª Lista)</span>
</div>
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-surface-container-low p-3 rounded-lg text-center">
<div>
<p className="font-label-sm text-on-surface-variant">LOA</p>
<p className="font-spec-num text-primary font-semibold">15.40 m</p>
</div>
<div>
<p className="font-label-sm text-on-surface-variant">BEAM</p>
<p className="font-spec-num text-primary font-semibold">4.78 m</p>
</div>
<div>
<p className="font-label-sm text-on-surface-variant">DRAFT</p>
<p className="font-spec-num text-primary font-semibold">2.80 m</p>
</div>
<div>
<p className="font-label-sm text-on-surface-variant">HULL</p>
<p className="font-spec-num text-primary font-semibold">Carbon / GRP</p>
</div>
</div>

<div className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-3">
<div className="flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[20px]">oil_barrel</span>
<span className="font-title-md text-primary">Volvo Penta D2-75F</span>
</div>
<span className="px-2 py-0.5 rounded bg-primary text-on-primary font-spec-num text-body-sm">75 HP @ 3000 RPM</span>
</div>
<div className="grid grid-cols-2 gap-y-2 text-body-sm pt-1">
<div>
<span className="text-on-surface-variant">Serial ID:</span>
<p className="font-spec-num text-primary font-medium">#51039281-B</p>
</div>
<div>
<span className="text-on-surface-variant">Transmission:</span>
<p className="font-spec-num text-primary font-medium">Volvo 150S Saildrive</p>
</div>
<div>
<span className="text-on-surface-variant">Logged Operating Hours:</span>
<p className="font-spec-num text-primary font-semibold flex items-center gap-1">
                    984 hrs
                    <span className="text-secondary font-label-sm font-bold bg-secondary-fixed/30 px-1.5 rounded">Major due</span>
</p>
</div>
<div>
<span className="text-on-surface-variant">Cooling Type:</span>
<p className="font-spec-num text-primary font-medium">Indirect Heat Exchanger</p>
</div>
</div>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col gap-4">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Mandated Inquirer &amp; Vessel Principal</span>
<span className="font-label-sm text-on-surface-variant">Nauta ID #NT-9021</span>
</div>
<div className="flex items-start gap-4">
<div className="relative">
<img alt="" className="w-14 h-14 rounded-full object-cover shadow-sm" src="/design/2529dd6d49.jpg"/>
<span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[10px] ring-2 ring-surface-container-lowest">
                ✓
              </span>
</div>
<div className="flex-1 min-w-0">
<div className="flex items-center gap-2">
<h3 className="font-title-md text-primary truncate">Capt. Matteo Ferrandiz</h3>
<span className="px-2 py-0.2 rounded-full bg-surface-container text-on-surface font-label-sm shrink-0">MCA Master 200gt</span>
</div>
<p className="font-body-sm text-on-surface-variant mt-0.5">
                Commissioned by: <span className="text-primary font-medium">UHNW Private Principal (Solaris 50 Owner)</span>
</p>
<div className="flex flex-wrap items-center gap-3 mt-2 text-body-sm text-on-surface-variant">
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span> Nauta Passport Verified
                </span>
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">translate</span> IT / EN Bilingual active
                </span>
</div>
</div>
</div>

<div className="rounded-lg bg-surface-container-low p-3.5 flex flex-col gap-2.5">
<div className="flex items-center justify-between">
<span className="font-label-md uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">g_translate</span>
                AI Certified Maritime Translation
              </span>
<div className="inline-flex items-center p-0.5 rounded-full bg-surface-container text-body-sm">
<button className="px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-sm" type="button">IT (Orig)</button>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant font-label-sm hover:text-on-surface" type="button">EN (Trans)</button>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant font-label-sm hover:text-on-surface" type="button">ES</button>
</div>
</div>
<div className="p-3 bg-surface-container-lowest rounded-md">
<p className="font-body-sm text-primary italic leading-relaxed">
                &quot;Richiesta di revisione approfondita delle 1.000 ore per Solaris 50 &apos;Baleares Express&apos; prima del trasferimento transatlantico autunnale. Necessaria pulizia ultrasonica fascio tubiero scambiatore, sostituzione girante e camma pompa acqua di mare, controllo doppio anello di tenuta membrana saildrive 150S, e gioco punterie valvole. Abbiamo già prenotato alaggio STP per 2 giorni dal 14 ottobre.&quot;
              </p>
</div>
<div className="flex items-center justify-between text-label-sm text-on-surface-variant">
<span>Status: <span className="text-secondary font-medium">● Translated &amp; Nauta Marine Legal verified</span></span>
<span>Source: Captain&apos;s Mobile Portal</span>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col gap-3">
<h3 className="font-title-md text-primary flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[20px]">assignment</span>
            Vessel Owner Requested Scope of Works
          </h3>
<p className="font-body-md text-on-surface leading-relaxed">
            Mandatory 1,000h major service required prior to autumn transatlantic delivery cruise. Scope must include:
          </p>
<ul className="space-y-2 text-body-sm text-on-surface pl-1">
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>Heat exchanger dismount &amp; ultrasonic bath descaling (both engine and gearbox intercoolers).</span>
</li>
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>Raw water impeller &amp; wear-cam replacement with genuine OEM kit.</span>
</li>
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>Saildrive 150S rubber diaphragm overhaul (dual-seal integrity check, sensor test).</span>
</li>
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>Valve clearance check and cold lash adjustment per Volvo Penta manual specifications.</span>
</li>
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>Full oil, secondary fuel filtration, and primary Racor filter elements replacement.</span>
</li>
</ul>
<div className="mt-2 p-3 bg-surface-container-high rounded-lg flex items-center justify-between">
<div className="flex items-center gap-2 text-body-sm text-primary font-medium">
<span className="material-symbols-outlined text-secondary text-[20px]">dock</span>
<span>Drydock Slot: STP Palma Slipway #14 (Coordinated 48h window)</span>
</div>
<span className="font-label-sm bg-surface-container-lowest px-2 py-0.5 rounded text-secondary font-bold">Confirmed</span>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col gap-3">
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Client Attached Dossier Files</span>
<div className="flex flex-col gap-2">
<Link href="#" className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors group" >
<div className="flex items-center gap-3">
<div className="w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary group-hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
</div>
<div>
<p className="font-title-md text-body-md text-primary font-medium">Volvo_Penta_Logbook_2021_2024.pdf</p>
<p className="font-body-sm text-on-surface-variant">2.4 MB · Verified Service Stamp History</p>
</div>
</div>
<span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">download</span>
</Link>
<Link href="#" className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors group" >
<div className="flex items-center gap-3">
<div className="w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary group-hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[20px]">folder_zip</span>
</div>
<div>
<p className="font-title-md text-body-md text-primary font-medium">Engine_Room_Clearance_Photos.zip</p>
<p className="font-body-sm text-on-surface-variant">18.2 MB · 14 High-Res bilge &amp; drive photos</p>
</div>
</div>
<span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">download</span>
</Link>
</div>
</article>
</div>

<div className="lg:col-span-7 flex flex-col gap-space-lg">

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">

<div className="p-6 bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-4">
<div>
<div className="flex items-center gap-2">
<span className="px-2 py-0.5 rounded bg-primary text-on-primary font-label-sm font-semibold uppercase">Official Quotation</span>
<span className="font-spec-num text-body-sm text-on-surface-variant">Ref: #PROP-8821</span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary mt-1">Commercial Proposal &amp; Scope of Works</h2>
<p className="font-body-sm text-on-surface-variant mt-0.5">Talleres Navales del Mediterráneo S.L. to Captain Matteo Ferrandiz</p>
</div>
<div className="flex items-center gap-2">
<span className="font-label-sm bg-surface-container-lowest px-2.5 py-1.5 rounded-lg text-primary shadow-sm flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">schedule</span>
                Valid: 15 Calendar Days
              </span>
</div>
</div>

<div className="p-6 flex flex-col gap-5">
<div className="flex items-center justify-between">
<h3 className="font-title-md text-primary flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[20px]">receipt_long</span>
                Scheduled Labor &amp; OEM Marine Parts Breakdown
              </h3>
<button className="text-secondary font-label-md hover:underline flex items-center gap-1 font-semibold" type="button">
<span className="material-symbols-outlined text-[16px]">add_circle</span>
                Add Custom Line Item
              </button>
</div>

<div className="overflow-x-auto rounded-xl bg-surface-container-low shadow-inner">
<table className="w-full text-left text-body-sm">
<thead className="bg-surface-container text-on-surface-variant font-label-sm uppercase tracking-wider">
<tr>
<th className="py-3 px-4" scope="col">Item &amp; Work Description</th>
<th className="py-3 px-3 text-center" scope="col">Qty / Hrs</th>
<th className="py-3 px-4 text-right" scope="col">Unit Price</th>
<th className="py-3 px-4 text-right" scope="col">Subtotal</th>
</tr>
</thead>
<tbody className="divide-y-0 text-on-surface">

<tr className="bg-surface-container-lowest hover:bg-surface-container-low/50 transition-colors">
<td className="py-3.5 px-4">
<p className="font-title-md text-body-md text-primary">Volvo Penta D2-75 Major Service Kit</p>
<p className="font-body-sm text-on-surface-variant">Includes OEM primary &amp; secondary fuel filters, engine oil filter, raw water impeller kit, alternator drive belt, crankcase ventilation valve.</p>
<span className="inline-block mt-1 font-label-sm bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant font-spec-num">OEM Part #21104840</span>
</td>
<td className="py-3.5 px-3 text-center font-spec-num font-medium">1 kit</td>
<td className="py-3.5 px-4 text-right font-spec-num text-on-surface-variant">€480.00</td>
<td className="py-3.5 px-4 text-right font-spec-num font-semibold text-primary">€480.00</td>
</tr>

<tr className="bg-surface-container-low/30 hover:bg-surface-container-low/60 transition-colors">
<td className="py-3.5 px-4">
<p className="font-title-md text-body-md text-primary">Saildrive 150S Diaphragm Replacement Kit &amp; Marine Gear Oil</p>
<p className="font-body-sm text-on-surface-variant">Dual-seal hull membrane gasket, zinc collar anodes, clamp rings, and 3.2L Volvo Synthetic 75W-90 transmission lubricant.</p>
<span className="inline-block mt-1 font-label-sm bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant font-spec-num">OEM Part #21389074</span>
</td>
<td className="py-3.5 px-3 text-center font-spec-num font-medium">1 kit</td>
<td className="py-3.5 px-4 text-right font-spec-num text-on-surface-variant">€590.00</td>
<td className="py-3.5 px-4 text-right font-spec-num font-semibold text-primary">€590.00</td>
</tr>

<tr className="bg-surface-container-lowest hover:bg-surface-container-low/50 transition-colors">
<td className="py-3.5 px-4">
<p className="font-title-md text-body-md text-primary">Ultrasonic Heat Exchanger &amp; Intercooler Descaling Treatment</p>
<p className="font-body-sm text-on-surface-variant">Chemical bath decalcification of copper-nickel bundle, end-cap sealing rings replacement, pressure bench leak testing (2.5 bar).</p>
</td>
<td className="py-3.5 px-3 text-center font-spec-num font-medium">1 unit</td>
<td className="py-3.5 px-4 text-right font-spec-num text-on-surface-variant">€320.00</td>
<td className="py-3.5 px-4 text-right font-spec-num font-semibold text-primary">€320.00</td>
</tr>

<tr className="bg-surface-container-low/30 hover:bg-surface-container-low/60 transition-colors">
<td className="py-3.5 px-4">
<p className="font-title-md text-body-md text-primary">Master Marine Certified Technician Labor</p>
<p className="font-body-sm text-on-surface-variant">2 certified naval mechanics x 12 hours. Engine room disassembly, saildrive seal replacement during STP haul-out, valve adjustment, sea-trial diagnostics.</p>
<span className="inline-block mt-1 font-label-sm bg-secondary-container/40 text-on-secondary-container px-1.5 py-0.5 rounded font-medium">Lead: J. Ballester (Senior Tech #441)</span>
</td>
<td className="py-3.5 px-3 text-center font-spec-num font-medium">24 hrs</td>
<td className="py-3.5 px-4 text-right font-spec-num text-on-surface-variant">€75.00</td>
<td className="py-3.5 px-4 text-right font-spec-num font-semibold text-primary">€1,800.00</td>
</tr>

<tr className="bg-surface-container-lowest hover:bg-surface-container-low/50 transition-colors">
<td className="py-3.5 px-4">
<p className="font-title-md text-body-md text-primary">Shipyard Waste Disposal, Environmental Eco-tax &amp; Harbour Fee</p>
<p className="font-body-sm text-on-surface-variant">Hydrocarbon absorption filters, hazardous oil recycling certificate (Consell de Mallorca protocol), and STP dock environmental levy.</p>
</td>
<td className="py-3.5 px-3 text-center font-spec-num font-medium">Flat</td>
<td className="py-3.5 px-4 text-right font-spec-num text-on-surface-variant">€140.00</td>
<td className="py-3.5 px-4 text-right font-spec-num font-semibold text-primary">€140.00</td>
</tr>
</tbody>
</table>
</div>

<div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-surface-container-low p-5 rounded-xl">

<div className="md:col-span-6 flex flex-col justify-between gap-4">
<div className="flex flex-col gap-2">
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-bold">Tax Regime &amp; Invoicing Entity</span>
<div className="flex items-center gap-3">
<label className="inline-flex items-center gap-2 cursor-pointer">
<input defaultChecked className="accent-primary" name="vat_regime" type="radio"/>
<span className="text-body-sm text-primary font-medium">Spanish Standard IVA (21%)</span>
</label>
<label className="inline-flex items-center gap-2 cursor-pointer">
<input className="accent-primary" name="vat_regime" type="radio"/>
<span className="text-body-sm text-on-surface-variant">VIES Reverse Charge (0%)</span>
</label>
</div>
<p className="font-body-sm text-on-surface-variant text-xs mt-1">
                    Applicable to charter license or verified intra-EU B2B holding registration upon invoice issuance.
                  </p>
</div>

<div className="bg-surface-container-lowest p-3.5 rounded-lg flex items-start gap-3 shadow-sm">
<span className="material-symbols-outlined text-secondary text-[22px] shrink-0">verified</span>
<div className="text-body-sm">
<p className="font-title-md text-primary text-body-sm">Protected by Nauta Smart Escrow</p>
<p className="text-on-surface-variant">€1,200.00 upfront escrow hold required from client prior to commencement. Release triggers upon certified sea-trial completion.</p>
</div>
</div>
</div>

<div className="md:col-span-6 flex flex-col gap-2.5 bg-surface-container-lowest p-4 rounded-lg shadow-sm">
<div className="flex justify-between items-center text-body-md text-on-surface-variant">
<span>Net Materials &amp; Labor Subtotal:</span>
<span className="font-spec-num text-primary font-medium">€3,330.00</span>
</div>
<div className="flex justify-between items-center text-body-md text-on-surface-variant">
<span>Spanish IVA (21.0%):</span>
<span className="font-spec-num text-primary font-medium">€699.30</span>
</div>
<div className="w-full h-px bg-surface-container-highest my-1"></div>
<div className="flex justify-between items-center text-title-lg text-primary">
<span className="font-headline-sm text-headline-sm">Total Proposal Value:</span>
<span className="font-spec-num font-bold text-headline-sm text-primary">€4,029.30</span>
</div>
<p className="text-right font-label-sm text-on-surface-variant">All taxes &amp; port levies included</p>
<div className="mt-2 pt-2 border-t-0 bg-surface-container-low p-2.5 rounded flex justify-between items-center">
<span className="font-label-md text-secondary font-bold uppercase tracking-wider">Required Escrow Deposit (30%):</span>
<span className="font-spec-num font-bold text-secondary text-title-md">€1,200.00</span>
</div>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
<div className="p-3.5 bg-surface-container-low rounded-lg flex flex-col gap-1">
<div className="flex items-center gap-1.5 text-primary font-label-md uppercase font-bold">
<span className="material-symbols-outlined text-[16px] text-secondary">security</span>
                  12-Month Guarantee
                </div>
<p className="text-body-sm text-on-surface-variant">Full coverage on all OEM Volvo parts &amp; certified installation workmanship.</p>
</div>
<div className="p-3.5 bg-surface-container-low rounded-lg flex flex-col gap-1">
<div className="flex items-center gap-1.5 text-primary font-label-md uppercase font-bold">
<span className="material-symbols-outlined text-[16px] text-secondary">timer</span>
                  Work Completion
                </div>
<p className="text-body-sm text-on-surface-variant">Guaranteed turnaround within 3 business days from vessel haul-out at STP.</p>
</div>
<div className="p-3.5 bg-surface-container-low rounded-lg flex flex-col gap-1">
<div className="flex items-center gap-1.5 text-primary font-label-md uppercase font-bold">
<span className="material-symbols-outlined text-[16px] text-secondary">award_star</span>
                  Maritime Standard
                </div>
<p className="text-body-sm text-on-surface-variant">Vetted under IIMS / Lloyd&apos;s Register naval repair safety protocols.</p>
</div>
</div>

<div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-4">
<button className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-error hover:bg-error-container/20 font-body-sm font-medium transition-colors flex items-center justify-center gap-1" type="button">
<span className="material-symbols-outlined text-[18px]">close</span>
                Decline Request
              </button>
<div className="flex flex-wrap items-center gap-space-sm w-full sm:w-auto justify-end">
<button className="px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-body-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">save</span>
                  Save Draft Quote
                </button>
<button className="px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-body-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">visibility</span>
                  Preview Client PDF
                </button>
<button className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-title-md font-semibold transition-colors flex items-center justify-center gap-2 shadow-md" type="button">
<span className="material-symbols-outlined text-[20px]">send</span>
                  Send Formal Proposal to Client
                </button>
</div>
</div>
</div>
</div>

<article className="bg-surface-container-low rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
<div className="flex items-center gap-4">
<div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm shrink-0">
<span className="material-symbols-outlined text-[24px]">construction</span>
</div>
<div>
<h4 className="font-title-md text-primary">STP Shipyard Palma Access Badge &amp; Hot Works Clearance</h4>
<p className="font-body-sm text-on-surface-variant">Contractor crew insurance on file with STP Port Authority. Environmental hazardous fluids authorization current through Dec 2025.</p>
</div>
</div>
<Link href="#" className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-primary font-body-sm font-medium hover:bg-surface-container-high transition-colors shrink-0 shadow-sm" >
            View Yard Pass
          </Link>
</article>
</div>
</div>
</main>
</div>
      </RequirePermission>
    </main>
  );
}
