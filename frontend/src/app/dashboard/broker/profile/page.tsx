import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function BrokerProfile() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<div className="w-full bg-primary-container text-on-primary py-2 px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-space-sm">
<span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
<span className="font-label-sm uppercase tracking-wider text-secondary-fixed">Prototype Mode</span>
<span className="text-outline-variant">/</span>
<span className="font-medium text-surface-container-lowest">Yacht Broker Seller: Marina Balear Yachting</span>
</div>
<div className="flex items-center gap-space-md">
<button className="inline-flex items-center gap-1 text-surface-variant hover:text-on-primary transition-colors text-body-sm" type="button">
<span className="material-symbols-outlined text-[16px]">swap_horiz</span>
          Switch Demo Role
        </button>
<span className="text-outline-variant">·</span>
<button className="inline-flex items-center gap-1 text-surface-variant hover:text-error-container transition-colors text-body-sm" type="button">
<span className="material-symbols-outlined text-[16px]">logout</span>
          Log Out
        </button>
</div>
</div>
</div>

<div className="w-full bg-surface-container-lowest shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop overflow-x-auto">
<nav className="flex items-center gap-space-lg min-w-max py-space-xs font-title-md text-title-md">
<Link href="#" className="py-space-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px]">dashboard</span>
          Overview
        </Link>
<Link href="#" className="py-space-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px]">directions_boat</span>
          Fleet
          <span className="bg-surface-container-high text-on-surface-variant text-label-sm px-1.5 py-0.5 rounded-full font-semibold">24</span>
</Link>
<Link href="#" className="py-space-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px]">hub</span>
          Leads
          <span className="bg-secondary-container text-on-secondary-container text-label-sm px-1.5 py-0.5 rounded-full font-semibold">6 new</span>
</Link>
<Link href="#" className="py-space-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px]">badge</span>
          Team
        </Link>
<Link href="#" className="py-space-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px]">handshake</span>
          Services
        </Link>
<Link href="#" className="py-space-sm text-primary font-bold flex items-center gap-2 relative" >
<span className="material-symbols-outlined text-[18px] text-secondary" style={{"fontVariationSettings": "'FILL' 1"}}>corporate_fare</span>
          Company Profile
          <span className="absolute bottom-0 left-0 w-full h-[2px] bg-secondary"></span>
</Link>
<Link href="#" className="py-space-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" >
<span className="material-symbols-outlined text-[18px]">credit_card</span>
          Subscription
        </Link>
</nav>
</div>
</div>

<div className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg bg-surface-container-lowest p-space-lg md:p-space-xl rounded-lg shadow-sm">
<div className="flex flex-col gap-space-xs max-w-3xl">
<div className="flex items-center gap-space-xs text-secondary font-label-md uppercase tracking-wider">
<span className="material-symbols-outlined text-[18px]">verified_user</span>
<span>Public Maritime Directory Profile</span>
<span className="text-outline-variant">/</span>
<span className="text-on-surface-variant">Reg. Baleares #ESP-984</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          Brokerage Company Profile &amp; International Showcase
        </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant">
          Manage your public brand identity, marina berths, licensed maritime certifications, and multilingual agency bio displayed across European maritime hubs.
        </p>
</div>
<div className="flex flex-wrap items-center gap-space-sm shrink-0">
<Link href="#" className="inline-flex items-center gap-2 px-space-md py-space-sm rounded bg-surface-container hover:bg-surface-container-high text-primary font-title-md text-title-md transition-colors shadow-sm" >
<span className="material-symbols-outlined text-[20px]">visibility</span>
<span>View Public Profile</span>
</Link>
<button className="inline-flex items-center gap-2 px-space-lg py-space-sm rounded bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md transition-all shadow-md active:scale-[0.99]" id="save-profile-btn" type="button">
<span className="material-symbols-outlined text-[20px]">done_all</span>
<span>Save Profile Changes</span>
</button>
</div>
</div>

<div className="w-full bg-surface-container-lowest p-space-lg md:p-space-xl rounded-lg shadow-sm flex flex-col gap-space-md relative overflow-hidden">
<div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none"></div>
<div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md relative z-10">
<div className="flex items-start gap-space-md">
<div className="w-12 h-12 rounded bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
<span className="material-symbols-outlined text-[28px]">auto_awesome</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-space-xs flex-wrap">
<span className="font-title-lg text-title-lg text-primary font-bold">Nauta AI Maritime Legal Translation Engine</span>
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-label-sm font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                ACTIVE SYNC V2.4
              </span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
              Automatic harmonized terminology aligned with standard MYBA charter terms, Italian <em className="font-medium text-primary">Codice della Navigazione</em>, and Spanish <em className="font-medium text-primary">Capitanía Marítima</em> jurisprudence.
            </p>
</div>
</div>
<div className="flex flex-wrap items-center gap-space-sm">
<button className="inline-flex items-center gap-2 px-space-md py-space-sm rounded bg-secondary text-on-secondary hover:bg-on-secondary-container transition-all shadow-sm font-title-md text-title-md" id="trigger-sync-btn" type="button">
<span className="material-symbols-outlined text-[18px] animate-spin-slow">sync</span>
<span>Run AI Translation Sync</span>
</button>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md pt-space-sm relative z-10">
<div className="p-space-md bg-surface rounded flex items-center justify-between shadow-sm">
<div className="flex items-center gap-space-sm">
<span className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-md font-bold">EN</span>
<div className="flex flex-col">
<span className="font-title-md text-title-md text-primary">English</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Master Source Copy</span>
</div>
</div>
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-primary font-label-sm">
<span className="w-2 h-2 rounded-full bg-primary"></span>
            Original Master
          </span>
</div>
<div className="p-space-md bg-surface rounded flex items-center justify-between shadow-sm">
<div className="flex items-center gap-space-sm">
<span className="w-8 h-8 rounded-full bg-surface-container-highest text-primary flex items-center justify-center font-label-md font-bold">IT</span>
<div className="flex flex-col">
<span className="font-title-md text-title-md text-primary">Italiano</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Portofino / Genoa Desk</span>
</div>
</div>
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/50 text-secondary font-label-sm">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
            Synced &amp; Reviewed
          </span>
</div>
<div className="p-space-md bg-surface rounded flex items-center justify-between shadow-sm">
<div className="flex items-center gap-space-sm">
<span className="w-8 h-8 rounded-full bg-surface-container-highest text-primary flex items-center justify-center font-label-md font-bold">ES</span>
<div className="flex flex-col">
<span className="font-title-md text-title-md text-primary">Español</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Palma / Barcelona Desk</span>
</div>
</div>
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/50 text-secondary font-label-sm">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
            Synced &amp; Reviewed
          </span>
</div>
</div>
<div className="flex items-center gap-2 pt-space-xs text-on-surface-variant font-label-sm uppercase tracking-wider">
<span className="material-symbols-outlined text-[16px] text-secondary">gavel</span>
<span>Verified Compliance: Article 126 Italian Codice della Navigazione &amp; Real Decreto 1435/2010 (Registro de Matrícula de Buques)</span>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">

<div className="lg:col-span-8 flex flex-col gap-space-xl">

<section className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-lg shadow-sm flex flex-col gap-space-lg">
<div className="flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="w-7 h-7 rounded bg-surface-container text-primary flex items-center justify-center font-bold font-spec-num text-spec-num">1</span>
<h2 className="font-headline-sm text-headline-sm text-primary">Company Identification &amp; Legal Registration</h2>
</div>
<span className="text-secondary font-label-sm font-semibold uppercase bg-secondary-container/40 px-2 py-1 rounded">KYB Approved</span>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
<div className="flex flex-col gap-1.5">
<label className="font-label-md text-label-md text-on-surface uppercase tracking-wider" htmlFor="legal_name">
                Legal Entity Name <span className="text-error">*</span>
</label>
<input className="w-full px-space-md py-space-sm bg-surface rounded text-primary font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-secondary shadow-sm transition-all" id="legal_name" type="text" value="Marina Balear Yachting S.L."/>
<span className="font-body-sm text-body-sm text-on-surface-variant">Registered with Registro Mercantil de Palma de Mallorca</span>
</div>
<div className="flex flex-col gap-1.5">
<label className="font-label-md text-label-md text-on-surface uppercase tracking-wider" htmlFor="trading_name">
                Trading / Brand Name <span className="text-error">*</span>
</label>
<input className="w-full px-space-md py-space-sm bg-surface rounded text-primary font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-secondary shadow-sm transition-all" id="trading_name" type="text" value="Marina Balear Yachting"/>
<span className="font-body-sm text-body-sm text-on-surface-variant">Displayed to international clients on yacht cards</span>
</div>
<div className="flex flex-col gap-1.5">
<label className="font-label-md text-label-md text-on-surface uppercase tracking-wider" htmlFor="vat_id">
                Tax Identifier (CIF / VAT) <span className="text-error">*</span>
</label>
<div className="relative flex items-center">
<input className="w-full px-space-md py-space-sm bg-surface rounded text-primary font-spec-num focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-secondary shadow-sm transition-all" id="vat_id" type="text" value="ES-B07891234"/>
<span className="material-symbols-outlined text-secondary absolute right-3 text-[18px]">verified</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">VIES Validated for cross-border EU tax exemption</span>
</div>
<div className="grid grid-cols-2 gap-space-sm">
<div className="flex flex-col gap-1.5">
<label className="font-label-md text-label-md text-on-surface uppercase tracking-wider" htmlFor="myba_id">
                  MYBA Member #
                </label>
<input className="w-full px-space-md py-space-sm bg-surface rounded text-primary font-spec-num focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-secondary shadow-sm transition-all" id="myba_id" type="text" value="#419"/>
</div>
<div className="flex flex-col gap-1.5">
<label className="font-label-md text-label-md text-on-surface uppercase tracking-wider" htmlFor="est_year">
                  Established
                </label>
<input className="w-full px-space-md py-space-sm bg-surface rounded text-primary font-spec-num focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-secondary shadow-sm transition-all" id="est_year" type="text" value="1998"/>
</div>
</div>
</div>
</section>

<section className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-lg shadow-sm flex flex-col gap-space-lg">
<div className="flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="w-7 h-7 rounded bg-surface-container text-primary flex items-center justify-center font-bold font-spec-num text-spec-num">2</span>
<h2 className="font-headline-sm text-headline-sm text-primary">Office Locations &amp; Marina Berths</h2>
</div>
<button className="inline-flex items-center gap-1 text-secondary font-title-md hover:underline" type="button">
<span className="material-symbols-outlined text-[18px]">add_location_alt</span>
              Add Station
            </button>
</div>
<div className="flex flex-col gap-space-md">

<div className="p-space-md bg-surface rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md shadow-sm">
<div className="flex items-start gap-space-md">
<div className="w-10 h-10 rounded bg-primary text-on-primary flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[20px]">anchor</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-2">
<span className="font-title-md text-title-md text-primary font-bold">STP Palma Shipyard (Headquarters)</span>
<span className="bg-surface-container text-primary px-2 py-0.5 rounded text-label-sm font-semibold uppercase">Primary HQ</span>
</div>
<span className="font-body-md text-body-md text-on-surface-variant">Muelle Viejo, Edificio Global Office 302, 07012 Palma, Islas Baleares</span>
<div className="flex items-center gap-space-md mt-1 text-body-sm text-on-surface-variant">
<span><strong className="text-primary font-medium">VHF:</strong> Ch 68</span>
<span>·</span>
<span><strong className="text-primary font-medium">Draft:</strong> Up to 7.5m</span>
<span>·</span>
<span><strong className="text-primary font-medium">Dedicated Slips:</strong> 8 Berths</span>
</div>
</div>
</div>
<div className="flex items-center gap-2 self-end md:self-center">
<button className="p-2 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors" type="button">
<span className="material-symbols-outlined text-[20px]">edit</span>
</button>
<button className="p-2 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors" type="button">
<span className="material-symbols-outlined text-[20px]">more_vert</span>
</button>
</div>
</div>

<div className="p-space-md bg-surface rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md shadow-sm">
<div className="flex items-start gap-space-md">
<div className="w-10 h-10 rounded bg-surface-container-high text-primary flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[20px]">apartment</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-2">
<span className="font-title-md text-title-md text-primary font-bold">Marina Port Vell Desk</span>
<span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded text-label-sm font-semibold uppercase">Continental Hub</span>
</div>
<span className="font-body-md text-body-md text-on-surface-variant">Carrer de l&apos;Escar 26, Moll del Dipòsit, 08039 Barcelona</span>
<div className="flex items-center gap-space-md mt-1 text-body-sm text-on-surface-variant">
<span><strong className="text-primary font-medium">Focus:</strong> Superyacht Brokerage 40m+</span>
<span>·</span>
<span><strong className="text-primary font-medium">Contact:</strong> bcndesk@marinabalear.com</span>
</div>
</div>
</div>
<div className="flex items-center gap-2 self-end md:self-center">
<button className="p-2 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors" type="button">
<span className="material-symbols-outlined text-[20px]">edit</span>
</button>
<button className="p-2 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors" type="button">
<span className="material-symbols-outlined text-[20px]">more_vert</span>
</button>
</div>
</div>

<div className="p-space-md bg-surface rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md shadow-sm">
<div className="flex items-start gap-space-md">
<div className="w-10 h-10 rounded bg-surface-container-high text-primary flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[20px]">sailing</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-2">
<span className="font-title-md text-title-md text-primary font-bold">Marina Botafoch Seasonal Office</span>
<span className="bg-tertiary-fixed-dim/30 text-on-tertiary-fixed-variant px-2 py-0.5 rounded text-label-sm font-semibold uppercase">May – October Berth</span>
</div>
<span className="font-body-md text-body-md text-on-surface-variant">Pantalán Poniente 14, 07800 Eivissa (Ibiza)</span>
<div className="flex items-center gap-space-md mt-1 text-body-sm text-on-surface-variant">
<span><strong className="text-primary font-medium">Tender Transfer:</strong> Formentera express available</span>
</div>
</div>
</div>
<div className="flex items-center gap-2 self-end md:self-center">
<button className="p-2 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors" type="button">
<span className="material-symbols-outlined text-[20px]">edit</span>
</button>
<button className="p-2 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors" type="button">
<span className="material-symbols-outlined text-[20px]">more_vert</span>
</button>
</div>
</div>
</div>
</section>

<section className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-lg shadow-sm flex flex-col gap-space-lg">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
<div className="flex items-center gap-space-sm">
<span className="w-7 h-7 rounded bg-surface-container text-primary flex items-center justify-center font-bold font-spec-num text-spec-num">3</span>
<div>
<h2 className="font-headline-sm text-headline-sm text-primary">Agency Bio &amp; Narrative</h2>
<p className="font-body-sm text-body-sm text-on-surface-variant">Multi-region storytelling tailored to regional yacht registries and charter customs.</p>
</div>
</div>

<div className="inline-flex p-1 bg-surface-container rounded font-label-md" id="bio-lang-tabs">
<button className="px-3 py-1.5 rounded bg-primary text-on-primary font-semibold shadow-sm transition-all flex items-center gap-1.5" data-lang="en" type="button">
<span>EN (Master)</span>
<span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed"></span>
</button>
<button className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary transition-all flex items-center gap-1.5" data-lang="it" type="button">
<span>IT</span>
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
</button>
<button className="px-3 py-1.5 rounded text-on-surface-variant hover:text-primary transition-all flex items-center gap-1.5" data-lang="es" type="button">
<span>ES</span>
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
</button>
</div>
</div>

<div className="flex flex-col gap-space-md" id="content-en">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">Master English Bio (Source for Auto-translation)</span>
<span className="font-label-sm text-secondary flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">lock_reset</span>
                Original Broker Copy
              </span>
</div>
<textarea className="w-full p-space-md bg-surface rounded text-primary font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-secondary leading-relaxed shadow-sm transition-all" rows={6}>Founded in 1998 in the heart of Palma de Mallorca&apos;s historic shipping basin, Marina Balear Yachting has served as the premier conduit for high-end Mediterranean maritime brokerage for over a quarter century. With dedicated shipyard berths at STP Palma and executive partner desks in Barcelona and Ibiza, our accredited MYBA brokers specialize in transatlantic sailing ketches, Italian-built flybridge motor yachts, and performance catamarans. Every listed hull is backed by surveyor-certified inspection logs, clear titles under Spanish Capitanía &amp; Italian Naval registers, and bespoke cross-border escrow protection.</textarea>
<div className="p-space-md bg-surface-container-low rounded flex items-center justify-between text-body-sm text-on-surface-variant">
<span>Word count: 96 words · 624 characters</span>
<span className="text-secondary font-medium">Last updated: 14 May 2025 by Broker-in-Charge</span>
</div>
</div>

<div className="hidden flex flex-col gap-space-md" id="content-it">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase tracking-wider text-secondary font-semibold">Traduzione Ufficiale Italiano (Harmonized with Codice della Navigazione)</span>
<span className="font-label-sm text-secondary flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">verified</span>
                Verified by Genoa Desk
              </span>
</div>
<textarea className="w-full p-space-md bg-surface rounded text-primary font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-secondary leading-relaxed shadow-sm transition-all" rows={6}>Fondata nel 1998 nel bacino nautico storico di Palma di Maiorca, Marina Balear Yachting rappresenta da oltre un quarto di secolo l&apos;eccellenza nel brokeraggio marittimo nel Mediterraneo occidentale. Con ormeggi dedicati presso il cantiere STP di Palma e desk operativi a Barcellona e Ibiza, i nostri broker certificati MYBA sono specializzati in ketch oceanici, motoryacht flybridge di prestigiosi cantieri italiani e catamarani ad alte prestazioni. Ogni imbarcazione registrata è corredata da perizie navali asseverate, conformità ai registri navali spagnoli e italiani (R.I.Na.) e contrattualistica garantita da depositi fiduciari dedicati.</textarea>
<div className="p-space-md bg-surface-container-low rounded flex items-center justify-between text-body-sm text-on-surface-variant">
<span>Parole: 94 parole · AI Synced with Italian Maritime Terminology</span>
<span className="text-secondary font-medium">Accordo con norme R.I.Na. confermato</span>
</div>
</div>

<div className="hidden flex flex-col gap-space-md" id="content-es">
<div className="flex items-center justify-between">
<span className="font-label-sm uppercase tracking-wider text-secondary font-semibold">Traducción Oficial Española (Conforme a Capitanía Marítima)</span>
<span className="font-label-sm text-secondary flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">verified</span>
                Revisado por Asesoría Balear
              </span>
</div>
<textarea className="w-full p-space-md bg-surface rounded text-primary font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-1 focus:ring-secondary leading-relaxed shadow-sm transition-all" rows={6}>Fundada en 1998 en el corazón del puerto náutico de Palma de Mallorca, Marina Balear Yachting se ha consolidado durante más de un cuarto de siglo como la agencia de referencia para el corretaje náutico de lujo en el Mediterráneo. Disponiendo de amarres propios de gran calado en varadero STP Palma y oficinas asociadas en Barcelona e Ibiza, nuestros brokers homologados por MYBA son especialistas en yates de motor de alta gama, veleros oceánicos y multicascos de travesía. Cada embarcación cuenta con peritaje técnico neutral, historial registral ante la Dirección General de la Marina Mercante y depósito en custodia notarial.</textarea>
<div className="p-space-md bg-surface-container-low rounded flex items-center justify-between text-body-sm text-on-surface-variant">
<span>Palabras: 104 palabras · Conforme Real Decreto 1435/2010</span>
<span className="text-secondary font-medium">Revisión administrativa al día</span>
</div>
</div>
</section>

<section className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-lg shadow-sm flex flex-col gap-space-lg">
<div className="flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="w-7 h-7 rounded bg-surface-container text-primary flex items-center justify-center font-bold font-spec-num text-spec-num">4</span>
<h2 className="font-headline-sm text-headline-sm text-primary">Media &amp; Visual Showcase Assets</h2>
</div>
<span className="font-label-sm text-on-surface-variant uppercase">Retina 2x Formats</span>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">

<div className="flex flex-col gap-space-xs">
<span className="font-label-md text-label-md text-on-surface uppercase font-semibold">Brokerage Crest / Logo</span>
<div className="h-44 rounded bg-surface-container-low flex flex-col items-center justify-center p-space-md text-center group cursor-pointer hover:bg-surface-container transition-colors relative overflow-hidden shadow-inner">
<div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center mb-2 shadow-sm">
<span className="material-symbols-outlined text-[32px]">shield</span>
</div>
<span className="font-title-md text-title-md text-primary font-bold tracking-wider">MARINA BALEAR</span>
<span className="font-label-sm text-on-surface-variant tracking-widest mt-0.5">YACHTING · EST. 1998</span>
<div className="absolute inset-0 bg-primary/60 text-on-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
<span className="inline-flex items-center gap-1 font-title-md text-title-md"><span className="material-symbols-outlined">upload</span> Replace Crest</span>
</div>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">SVG, EPS or PNG min 800×800px</span>
</div>

<div className="flex flex-col gap-space-xs">
<span className="font-label-md text-label-md text-on-surface uppercase font-semibold">Shipyard HQ Exterior</span>
<div className="h-44 rounded bg-cover bg-center relative overflow-hidden group shadow-sm" style={{"backgroundImage": "url('/design/54ec783c41.jpg')"}}>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent"></div>
<div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-on-primary font-label-sm">
<span className="font-medium truncate">STP Palma HQ Pavilion</span>
<span className="bg-primary/70 px-1.5 py-0.5 rounded text-label-sm">Main Office</span>
</div>
<div className="absolute inset-0 bg-primary/60 text-on-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
<span className="inline-flex items-center gap-1 font-title-md text-title-md"><span className="material-symbols-outlined">photo_camera</span> Update Photo</span>
</div>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Displays on agency directory cards</span>
</div>

<div className="flex flex-col gap-space-xs">
<span className="font-label-md text-label-md text-on-surface uppercase font-semibold">Executive Brokerage Team</span>
<div className="h-44 rounded bg-cover bg-center relative overflow-hidden group shadow-sm" style={{"backgroundImage": "url('/design/c99b8253e0.jpg')"}}>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent"></div>
<div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-on-primary font-label-sm">
<span className="font-medium truncate">12 Certified MYBA Brokers</span>
<span className="bg-primary/70 px-1.5 py-0.5 rounded text-label-sm">Team Roster</span>
</div>
<div className="absolute inset-0 bg-primary/60 text-on-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
<span className="inline-flex items-center gap-1 font-title-md text-title-md"><span className="material-symbols-outlined">photo_camera</span> Update Photo</span>
</div>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Featured on public broker landing page</span>
</div>
</div>
</section>

<section className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-lg shadow-sm flex flex-col gap-space-lg">
<div className="flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="w-7 h-7 rounded bg-surface-container text-primary flex items-center justify-center font-bold font-spec-num text-spec-num">5</span>
<h2 className="font-headline-sm text-headline-sm text-primary">Verified Accreditations &amp; Insurance</h2>
</div>
<span className="material-symbols-outlined text-secondary text-[24px]">verified</span>
</div>
<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">

<div className="p-space-md bg-surface rounded-lg flex flex-col items-center text-center gap-2 shadow-sm">
<div className="w-12 h-12 rounded-full bg-surface-container-highest text-primary flex items-center justify-center font-bold text-title-lg">
                MYBA
              </div>
<span className="font-title-md text-title-md text-primary font-bold">MYBA Corporate</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Mediterranean Yacht Brokers Association #419</span>
<span className="mt-auto inline-flex items-center gap-1 text-secondary font-label-sm font-semibold">
<span className="material-symbols-outlined text-[14px]">check_circle</span> Valid thru 2026
              </span>
</div>

<div className="p-space-md bg-surface rounded-lg flex flex-col items-center text-center gap-2 shadow-sm">
<div className="w-12 h-12 rounded-full bg-surface-container-highest text-primary flex items-center justify-center font-bold text-title-lg">
                YPA
              </div>
<span className="font-title-md text-title-md text-primary font-bold">Yacht Professionals</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">International Yacht Brokers Guild Reg #ESP-88</span>
<span className="mt-auto inline-flex items-center gap-1 text-secondary font-label-sm font-semibold">
<span className="material-symbols-outlined text-[14px]">check_circle</span> Valid thru 2026
              </span>
</div>

<div className="p-space-md bg-surface rounded-lg flex flex-col items-center text-center gap-2 shadow-sm">
<div className="w-12 h-12 rounded-full bg-surface-container-highest text-primary flex items-center justify-center font-bold text-title-lg">
                ANEN
              </div>
<span className="font-title-md text-title-md text-primary font-bold">ANEN España</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Asociación Nacional de Empresas Náuticas #914</span>
<span className="mt-auto inline-flex items-center gap-1 text-secondary font-label-sm font-semibold">
<span className="material-symbols-outlined text-[14px]">check_circle</span> Valid thru 2025
              </span>
</div>
</div>

<div className="p-space-md bg-surface-container-low rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md">
<div className="flex items-start gap-space-md">
<span className="material-symbols-outlined text-primary text-[28px] shrink-0 mt-0.5">policy</span>
<div className="flex flex-col">
<div className="flex items-center gap-2">
<span className="font-title-md text-title-md text-primary font-bold">Lloyd&apos;s Nautical Professional Indemnity Policy</span>
<span className="bg-secondary text-on-secondary px-2 py-0.5 rounded text-label-sm font-semibold uppercase">Active Cover</span>
</div>
<span className="font-body-md text-body-md text-on-surface-variant">Policy Ref: LLOYD-EUR-990214-MAR | Underwritten via Hiscox Marine Syndicate</span>
<span className="font-spec-num text-spec-num text-primary font-semibold mt-1">€10,000,000 Maximum Transaction Escrow &amp; Negligence Cover per event</span>
</div>
</div>
<button className="inline-flex items-center gap-1.5 px-space-md py-space-xs rounded bg-surface hover:bg-surface-container text-primary font-title-md text-title-md shrink-0 shadow-sm transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">download</span>
              Certificate (PDF)
            </button>
</div>
</section>
</div>

<div className="lg:col-span-4 flex flex-col gap-space-lg sticky top-24">

<div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm flex flex-col gap-space-md">
<div className="flex items-center justify-between">
<h3 className="font-title-lg text-title-lg text-primary font-bold">Profile Strength</h3>
<span className="font-spec-num text-spec-num text-secondary font-bold">96%</span>
</div>
<div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full transition-all duration-500" style={{"width": "96%"}}></div>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">
            Your international showcase fulfills all high-intent buyer verification triggers in Spain, France, and Italy.
          </p>
<div className="flex flex-col gap-2 pt-space-xs">
<div className="flex items-center gap-2 text-body-sm text-on-surface">
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
<span>KYB Commercial Registration Verified</span>
</div>
<div className="flex items-center gap-2 text-body-sm text-on-surface">
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
<span>MYBA Bond Escrow Active</span>
</div>
<div className="flex items-center gap-2 text-body-sm text-on-surface">
<span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
<span>Multilingual Bio Synced (EN, IT, ES)</span>
</div>
<div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
<span className="material-symbols-outlined text-outline text-[18px]">radio_button_unchecked</span>
<span>French Translation (Draft Pending)</span>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-lg shadow-sm flex flex-col gap-space-md">
<span className="font-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">Live Directory Card Preview</span>
<div className="bg-surface rounded p-space-md flex flex-col gap-space-sm shadow-sm">
<div className="flex items-center justify-between">
<span className="font-title-md text-title-md text-primary font-bold">Marina Balear Yachting</span>
<span className="bg-secondary/15 text-secondary px-2 py-0.5 rounded text-label-sm font-semibold">MYBA</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Palma de Mallorca · Barcelona · Ibiza</span>
<div className="flex items-center gap-space-md text-body-sm text-primary pt-1">
<span><strong>24</strong> Vessels for sale</span>
<span>·</span>
<span><strong>€84.5M</strong> Fleet Value</span>
</div>
<div className="flex items-center gap-1.5 pt-2 text-secondary font-title-md text-body-sm font-medium">
<span>Explore Agency Inventory</span>
<span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</div>
</div>
<Link href="#" className="inline-flex items-center justify-center gap-2 w-full py-space-sm rounded bg-surface-container hover:bg-surface-container-high text-primary font-title-md text-title-md transition-colors" >
<span className="material-symbols-outlined text-[18px]">open_in_new</span>
            Preview Client View
          </Link>
</div>

<div className="bg-[#f2f6f6] p-space-lg rounded-lg flex flex-col gap-space-sm shadow-sm">
<span className="font-label-sm text-outline uppercase tracking-wider">ADVERTISEMENT</span>
<h4 className="font-headline-sm text-headline-sm text-primary">Tirreno Marine Chronometers</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">
            Official maritime chronometry for Mediterranean regattas and bridge consoles. Handcrafted in La Spezia.
          </p>
<Link href="#" className="text-secondary font-title-md text-body-sm hover:underline inline-flex items-center gap-1 mt-1" >
            Request Private Catalogue <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</Link>
</div>
</div>
</div>
</div>

<div className="fixed bottom-6 right-6 z-50 bg-primary text-on-primary px-space-md py-space-sm rounded-lg shadow-xl flex items-center gap-3 transform translate-y-24 opacity-0 transition-all duration-300 pointer-events-none" id="toast">
<span className="material-symbols-outlined text-secondary-fixed text-[22px]" id="toast-icon">check_circle</span>
<div className="flex flex-col">
<span className="font-title-md text-title-md font-bold" id="toast-title">Profile Changes Saved</span>
<span className="font-body-sm text-body-sm text-surface-variant" id="toast-msg">Public European showcase updated immediately.</span>
</div>
</div>
</div>

      </RequirePermission>
    </main>
  );
}
