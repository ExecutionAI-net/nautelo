import Link from "next/link";

export default function ServicesPage() {
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<div className="relative w-full overflow-hidden">
<div className="absolute -top-24 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none"></div>
<div className="absolute top-96 left-10 w-80 h-80 bg-primary-container/5 rounded-full blur-2xl pointer-events-none"></div>

<section className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin lg:px-margin-desktop pt-space-xl pb-space-lg">
<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="max-w-3xl">
<div className="flex items-center gap-space-xs mb-space-sm text-secondary">
<span className="material-symbols-outlined text-[18px]">verified</span>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Specialised Maritime Network</span>
<span className="text-outline-variant mx-1">/</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Spain · Italy</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Nautical services</h1>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-sm max-w-2xl">
            Find specialised professionals to buy, sell, protect, maintain and transport your boat across Mediterranean waters.
          </p>
</div>

<div className="flex items-center gap-space-md p-space-sm bg-surface-container-low rounded-xl self-start lg:self-end">
<div className="px-space-md py-space-xs">
<div className="font-spec-num text-spec-num text-primary font-semibold">340+</div>
<div className="font-label-sm text-label-sm text-on-surface-variant uppercase">Certified firms</div>
</div>
<div className="w-px h-8 bg-surface-container-highest"></div>
<div className="px-space-md py-space-xs">
<div className="font-spec-num text-spec-num text-primary font-semibold">24 Ports</div>
<div className="font-label-sm text-label-sm text-on-surface-variant uppercase">Iberia &amp; Liguria</div>
</div>
</div>
</div>
</section>

<section className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin lg:px-margin-desktop py-space-lg">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<div className="group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
<div className="relative h-60 w-full overflow-hidden bg-surface-container">
<img alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="/design/386d95d2ba.jpg"/>
<div className="absolute top-4 left-4 bg-primary/80 backdrop-blur-md px-3 py-1 rounded-full text-on-primary font-label-sm text-label-sm uppercase tracking-wider flex items-center gap-1.5">
<span className="material-symbols-outlined text-[14px]">anchor</span>
              Brokerage
            </div>
</div>
<div className="p-space-lg flex flex-col flex-grow justify-between gap-space-md">
<div>
<div className="flex items-center justify-between mb-space-xs">
<h2 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">Full brokerage</h2>
<span className="font-label-sm text-label-sm text-on-surface-variant">01</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
                Complete representation, vessel valuation, buyer qualification, and escrow coordination across Spanish and Italian ports.
              </p>
</div>
<div className="pt-space-sm flex items-center justify-between">
<Link href="#" className="inline-flex items-center gap-space-xs font-title-md text-title-md text-secondary hover:text-primary transition-colors font-medium" >
                Explore service
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
<span className="font-label-sm text-label-sm text-on-surface-variant">Vessel acquisition &amp; sales</span>
</div>
</div>
</div>

<div className="group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
<div className="relative h-60 w-full overflow-hidden bg-surface-container">
<img alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="/design/788e907b1b.jpg"/>
<div className="absolute top-4 left-4 bg-primary/80 backdrop-blur-md px-3 py-1 rounded-full text-on-primary font-label-sm text-label-sm uppercase tracking-wider flex items-center gap-1.5">
<span className="material-symbols-outlined text-[14px]">gavel</span>
              Legal &amp; Flag
            </div>
</div>
<div className="p-space-lg flex flex-col flex-grow justify-between gap-space-md">
<div>
<div className="flex items-center justify-between mb-space-xs">
<h2 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">Nautical legal services</h2>
<span className="font-label-sm text-label-sm text-on-surface-variant">02</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
                Spanish registration (matriculación), Italian RID flag transfers, and cross-border maritime taxation advisory.
              </p>
</div>
<div className="pt-space-sm flex items-center justify-between">
<Link href="#" className="inline-flex items-center gap-space-xs font-title-md text-title-md text-secondary hover:text-primary transition-colors font-medium" >
                Explore service
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
<span className="font-label-sm text-label-sm text-on-surface-variant">Matriculación &amp; VAT</span>
</div>
</div>
</div>

<div className="group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
<div className="relative h-60 w-full overflow-hidden bg-surface-container">
<img alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="/design/b6fa6881f2.jpg"/>
<div className="absolute top-4 left-4 bg-primary/80 backdrop-blur-md px-3 py-1 rounded-full text-on-primary font-label-sm text-label-sm uppercase tracking-wider flex items-center gap-1.5">
<span className="material-symbols-outlined text-[14px]">shield</span>
              Underwriting
            </div>
</div>
<div className="p-space-lg flex flex-col flex-grow justify-between gap-space-md">
<div>
<div className="flex items-center justify-between mb-space-xs">
<h2 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">Yacht insurance</h2>
<span className="font-label-sm text-label-sm text-on-surface-variant">03</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
                Bespoke hull &amp; machinery cover, third-party Mediterranean navigation liability, and skipper protection plans.
              </p>
</div>
<div className="pt-space-sm flex items-center justify-between">
<Link href="#" className="inline-flex items-center gap-space-xs font-title-md text-title-md text-secondary hover:text-primary transition-colors font-medium" >
                Explore service
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
<span className="font-label-sm text-label-sm text-on-surface-variant">Hull &amp; Liability</span>
</div>
</div>
</div>

<div className="group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
<div className="relative h-60 w-full overflow-hidden bg-surface-container">
<img alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="/design/26c71ce9e6.jpg"/>
<div className="absolute top-4 left-4 bg-primary/80 backdrop-blur-md px-3 py-1 rounded-full text-on-primary font-label-sm text-label-sm uppercase tracking-wider flex items-center gap-1.5">
<span className="material-symbols-outlined text-[14px]">build</span>
              Engineering
            </div>
</div>
<div className="p-space-lg flex flex-col flex-grow justify-between gap-space-md">
<div>
<div className="flex items-center justify-between mb-space-xs">
<h2 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">Engines and maintenance</h2>
<span className="font-label-sm text-label-sm text-on-surface-variant">04</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
                Authorised overhaul, winter dry-dock servicing, and official engine diagnostics across regional shipyards.
              </p>
</div>
<div className="pt-space-sm flex items-center justify-between">
<Link href="#" className="inline-flex items-center gap-space-xs font-title-md text-title-md text-secondary hover:text-primary transition-colors font-medium" >
                Explore service
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
<span className="font-label-sm text-label-sm text-on-surface-variant">Drydock &amp; Diagnostics</span>
</div>
</div>
</div>

<div className="group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
<div className="relative h-60 w-full overflow-hidden bg-surface-container">
<img alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="/design/62a6bad391.jpg"/>
<div className="absolute top-4 left-4 bg-primary/80 backdrop-blur-md px-3 py-1 rounded-full text-on-primary font-label-sm text-label-sm uppercase tracking-wider flex items-center gap-1.5">
<span className="material-symbols-outlined text-[14px]">local_shipping</span>
              Logistics
            </div>
</div>
<div className="p-space-lg flex flex-col flex-grow justify-between gap-space-md">
<div>
<div className="flex items-center justify-between mb-space-xs">
<h2 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">Transport and delivery</h2>
<span className="font-label-sm text-label-sm text-on-surface-variant">05</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
                Professional skipper delivery passages and overland yacht freight forwarding between Spain and Italy.
              </p>
</div>
<div className="pt-space-sm flex items-center justify-between">
<Link href="#" className="inline-flex items-center gap-space-xs font-title-md text-title-md text-secondary hover:text-primary transition-colors font-medium" >
                Explore service
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
<span className="font-label-sm text-label-sm text-on-surface-variant">Cross-border transits</span>
</div>
</div>
</div>

<div className="group flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
<div className="relative h-60 w-full overflow-hidden bg-surface-container">
<img alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="/design/e750280fd8.jpg"/>
<div className="absolute top-4 left-4 bg-primary/80 backdrop-blur-md px-3 py-1 rounded-full text-on-primary font-label-sm text-label-sm uppercase tracking-wider flex items-center gap-1.5">
<span className="material-symbols-outlined text-[14px]">videocam</span>
              Media &amp; Exposure
            </div>
</div>
<div className="p-space-lg flex flex-col flex-grow justify-between gap-space-md">
<div>
<div className="flex items-center justify-between mb-space-xs">
<h2 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">Nautical marketing</h2>
<span className="font-label-sm text-label-sm text-on-surface-variant">06</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
                High-definition maritime video production, 3D interior scans, and multi-portal promotional syndication.
              </p>
</div>
<div className="pt-space-sm flex items-center justify-between">
<Link href="#" className="inline-flex items-center gap-space-xs font-title-md text-title-md text-secondary hover:text-primary transition-colors font-medium" >
                Explore service
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
<span className="font-label-sm text-label-sm text-on-surface-variant">Aerial &amp; 3D Tours</span>
</div>
</div>
</div>
</div>
</section>

<section className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl">
<div className="relative rounded-2xl overflow-hidden bg-surface-container p-space-lg md:p-space-xl shadow-sm">

<div className="absolute -right-16 -bottom-16 w-80 h-80 opacity-5 pointer-events-none">
<svg className="w-full h-full text-primary" fill="none" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
<circle cx="100" cy="100" r="80" stroke="currentColor" stroke-dasharray="10 10" strokeWidth="4"></circle>
<polygon fill="currentColor" points="100,20 120,80 180,100 120,120 100,180 80,120 20,100 80,80"></polygon>
</svg>
</div>
<div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-lg relative z-10">
<div className="flex flex-col max-w-2xl">
<div className="flex items-center gap-space-xs mb-space-xs">
<span className="font-label-sm text-label-sm text-on-surface-variant tracking-widest uppercase bg-surface-container-high px-2 py-0.5 rounded">ADVERTISEMENT</span>
<span className="font-label-sm text-label-sm text-outline-variant">·</span>
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Balearic Commercial Partner</span>
</div>
<h3 className="font-headline-md text-headline-md text-primary tracking-tight">
              Ibiza Marine Drydock &amp; Crane Services
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
              Specialist haul-out for vessels up to 75m LOA and 350-tonne displacement. Comprehensive antifouling, carbon fiber spar testing, and winter berth storage in Santa Eulària.
            </p>
<div className="flex items-center gap-space-md mt-space-sm font-label-md text-label-md text-primary">
<span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-secondary">location_on</span> Marina Santa Eulària, Balearics</span>
<span className="text-outline-variant">/</span>
<span className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px] text-secondary">precision_manufacturing</span> 350T Travelift</span>
</div>
</div>
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm w-full lg:w-auto shrink-0">
<Link href="#" className="px-space-lg py-space-sm bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md rounded text-center transition-colors" >
              Visit Shipyard Facility
            </Link>
</div>
</div>
</div>
</section>

<section className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin lg:px-margin-desktop pt-space-lg pb-space-2xl">
<div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Verified Professionals</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-space-xs">Regional directory</h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
            Direct access to vetted nautical providers operating in key ports and maritime administrative zones.
          </p>
</div>

<div className="flex items-center gap-space-xs text-on-surface-variant font-label-md text-label-md bg-surface-container-low px-space-md py-space-xs rounded-full">
<span className="material-symbols-outlined text-[16px] text-secondary">tune</span>
<span>Showing: <strong className="text-primary font-semibold" id="active-region-label">All Spain</strong> (<span id="results-count">5</span> verified)</span>
</div>
</div>

<div className="w-full overflow-x-auto pb-space-sm mb-space-xl">
<div className="flex items-center gap-space-xs min-w-max bg-surface-container-low p-1.5 rounded-xl" id="filter-container">
<button className="region-filter-btn px-space-md py-space-xs rounded-lg font-body-sm text-body-sm transition-all bg-primary text-on-primary font-medium" data-region="All Spain" type="button">All Spain</button>
<button className="region-filter-btn px-space-md py-space-xs rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-all" data-region="Mallorca" type="button">Mallorca</button>
<button className="region-filter-btn px-space-md py-space-xs rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-all" data-region="Barcelona" type="button">Barcelona</button>
<button className="region-filter-btn px-space-md py-space-xs rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-all" data-region="Alicante" type="button">Alicante</button>
<button className="region-filter-btn px-space-md py-space-xs rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-all" data-region="Valencia" type="button">Valencia</button>
<button className="region-filter-btn px-space-md py-space-xs rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-all" data-region="Málaga" type="button">Málaga</button>
<button className="region-filter-btn px-space-md py-space-xs rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-all" data-region="Cádiz" type="button">Cádiz</button>
<button className="region-filter-btn px-space-md py-space-xs rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-all" data-region="Canary Islands" type="button">Canary Islands</button>
<button className="region-filter-btn px-space-md py-space-xs rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-all" data-region="Italy" type="button">Italy</button>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg" id="provider-grid">

<article className="provider-card flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300" data-regions="Mallorca,All Spain">
<div>
<div className="flex items-start justify-between gap-space-sm mb-space-sm">
<div>
<span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm uppercase bg-surface-container text-secondary font-medium mb-1.5">
                  Engines and maintenance
                </span>
<h3 className="font-headline-sm text-headline-sm text-primary">Mallorca Engine Care</h3>
</div>
<div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0 text-primary">
<span className="material-symbols-outlined text-[20px]">handyman</span>
</div>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mb-space-md">
<span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
<span>Palma de Mallorca &amp; Port Adriano, Spain</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
              Authorised overhaul centre for Volvo Penta and MAN Marine diesel units. Mobile repair vans servicing major Balearic superyacht slips and private berths.
            </p>
</div>
<div className="mt-space-lg pt-space-md flex items-center justify-between">
<div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
<span>Inspected 2025</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-space-md py-space-xs rounded bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
                Enquire
              </button>
<Link href="#" className="px-space-md py-space-xs rounded bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md transition-colors" >
                View profile
              </Link>
</div>
</div>
</article>

<article className="provider-card flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300" data-regions="Mallorca,Barcelona,All Spain">
<div>
<div className="flex items-start justify-between gap-space-sm mb-space-sm">
<div>
<span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm uppercase bg-surface-container text-secondary font-medium mb-1.5">
                  Nautical legal services
                </span>
<h3 className="font-headline-sm text-headline-sm text-primary">Balearic Marine Legal</h3>
</div>
<div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0 text-primary">
<span className="material-symbols-outlined text-[20px]">account_balance</span>
</div>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mb-space-md">
<span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
<span>Port de Palma, Spain</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
              Spanish matriculación tax optimisation, commercial charter licenses (Lista 6ª), and bilateral escrow holding for high-value Mediterranean acquisitions.
            </p>
</div>
<div className="mt-space-lg pt-space-md flex items-center justify-between">
<div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
<span>Inspected 2025</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-space-md py-space-xs rounded bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
                Enquire
              </button>
<Link href="#" className="px-space-md py-space-xs rounded bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md transition-colors" >
                View profile
              </Link>
</div>
</div>
</article>

<article className="provider-card flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300" data-regions="Italy">
<div>
<div className="flex items-start justify-between gap-space-sm mb-space-sm">
<div>
<span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm uppercase bg-surface-container text-secondary font-medium mb-1.5">
                  Transport and delivery
                </span>
<h3 className="font-headline-sm text-headline-sm text-primary">Ligurian Yacht Transport</h3>
</div>
<div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0 text-primary">
<span className="material-symbols-outlined text-[20px]">sailing</span>
</div>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mb-space-md">
<span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
<span>Genoa &amp; La Spezia, Italy</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
              Commercial skipper delivery passages across the Tyrrhenian and Balearic seas. Heavy trailer freight forwarding between Italian boatyards and Spanish marinas.
            </p>
</div>
<div className="mt-space-lg pt-space-md flex items-center justify-between">
<div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
<span>Inspected 2025</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-space-md py-space-xs rounded bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
                Enquire
              </button>
<Link href="#" className="px-space-md py-space-xs rounded bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md transition-colors" >
                View profile
              </Link>
</div>
</div>
</article>

<article className="provider-card flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300" data-regions="Barcelona,All Spain">
<div>
<div className="flex items-start justify-between gap-space-sm mb-space-sm">
<div>
<span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm uppercase bg-surface-container text-secondary font-medium mb-1.5">
                  Engines and maintenance
                </span>
<h3 className="font-headline-sm text-headline-sm text-primary">Costa Brava Marine Electrical</h3>
</div>
<div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0 text-primary">
<span className="material-symbols-outlined text-[20px]">offline_bolt</span>
</div>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mb-space-md">
<span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
<span>Port Vell &amp; Palamós, Spain</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
              NMEA 2000 network integration, Victron lithium energy banks, Raymarine / Garmin offshore navigation suites, and galvanic corrosion audits.
            </p>
</div>
<div className="mt-space-lg pt-space-md flex items-center justify-between">
<div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
<span>Inspected 2025</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-space-md py-space-xs rounded bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
                Enquire
              </button>
<Link href="#" className="px-space-md py-space-xs rounded bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md transition-colors" >
                View profile
              </Link>
</div>
</div>
</article>

<article className="provider-card flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300" data-regions="Valencia,Alicante,All Spain">
<div>
<div className="flex items-start justify-between gap-space-sm mb-space-sm">
<div>
<span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm uppercase bg-surface-container text-secondary font-medium mb-1.5">
                  Engines and maintenance
                </span>
<h3 className="font-headline-sm text-headline-sm text-primary">Valencia Rigging</h3>
</div>
<div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0 text-primary">
<span className="material-symbols-outlined text-[20px]">architecture</span>
</div>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mb-space-md">
<span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
<span>La Marina de València, Spain</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
              Standing rigging replacement, swaging, furler servicing, and ultrasonic rod inspection for offshore cruising sloops and racing yachts.
            </p>
</div>
<div className="mt-space-lg pt-space-md flex items-center justify-between">
<div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
<span>Inspected 2025</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-space-md py-space-xs rounded bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
                Enquire
              </button>
<Link href="#" className="px-space-md py-space-xs rounded bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md transition-colors" >
                View profile
              </Link>
</div>
</div>
</article>

<article className="provider-card flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300" data-regions="Málaga,Cádiz,All Spain">
<div>
<div className="flex items-start justify-between gap-space-sm mb-space-sm">
<div>
<span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm uppercase bg-surface-container text-secondary font-medium mb-1.5">
                  Full brokerage
                </span>
<h3 className="font-headline-sm text-headline-sm text-primary">Sur Marine Surveyors</h3>
</div>
<div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0 text-primary">
<span className="material-symbols-outlined text-[20px]">search_check</span>
</div>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mb-space-md">
<span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
<span>Puerto Banús &amp; Algeciras, Spain</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
              Pre-purchase hull condition assessments, thermal imaging, moisture meter analysis on composite hulls, and valuations for Lloyd&apos;s underwriters.
            </p>
</div>
<div className="mt-space-lg pt-space-md flex items-center justify-between">
<div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
<span>Inspected 2025</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-space-md py-space-xs rounded bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
                Enquire
              </button>
<Link href="#" className="px-space-md py-space-xs rounded bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md transition-colors" >
                View profile
              </Link>
</div>
</div>
</article>

<article className="provider-card flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300" data-regions="Canary Islands,All Spain">
<div>
<div className="flex items-start justify-between gap-space-sm mb-space-sm">
<div>
<span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm uppercase bg-surface-container text-secondary font-medium mb-1.5">
                  Transport and delivery
                </span>
<h3 className="font-headline-sm text-headline-sm text-primary">Canarias Atlantic Passage</h3>
</div>
<div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0 text-primary">
<span className="material-symbols-outlined text-[20px]">explore</span>
</div>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mb-space-md">
<span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
<span>Las Palmas &amp; Santa Cruz de Tenerife, Spain</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
              Offshore passage planning, ARC rally preparation, and trans-Atlantic vessel repositioning with RYA Yachtmaster Ocean certified commercial crews.
            </p>
</div>
<div className="mt-space-lg pt-space-md flex items-center justify-between">
<div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
<span>Inspected 2025</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-space-md py-space-xs rounded bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
                Enquire
              </button>
<Link href="#" className="px-space-md py-space-xs rounded bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md transition-colors" >
                View profile
              </Link>
</div>
</div>
</article>

<article className="provider-card flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300" data-regions="Alicante,Valencia,All Spain">
<div>
<div className="flex items-start justify-between gap-space-sm mb-space-sm">
<div>
<span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm uppercase bg-surface-container text-secondary font-medium mb-1.5">
                  Nautical marketing
                </span>
<h3 className="font-headline-sm text-headline-sm text-primary">Levante Maritime Media</h3>
</div>
<div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0 text-primary">
<span className="material-symbols-outlined text-[20px]">videocam</span>
</div>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mb-space-md">
<span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
<span>Alicante &amp; Denia, Spain</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
              Professional chase-boat videography, Matterport 3D walkthroughs for listing brokers, and targeted nautical social campaign management.
            </p>
</div>
<div className="mt-space-lg pt-space-md flex items-center justify-between">
<div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
<span>Inspected 2025</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-space-md py-space-xs rounded bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
                Enquire
              </button>
<Link href="#" className="px-space-md py-space-xs rounded bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md transition-colors" >
                View profile
              </Link>
</div>
</div>
</article>

<article className="provider-card flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300" data-regions="Italy">
<div>
<div className="flex items-start justify-between gap-space-sm mb-space-sm">
<div>
<span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm uppercase bg-surface-container text-secondary font-medium mb-1.5">
                  Yacht insurance
                </span>
<h3 className="font-headline-sm text-headline-sm text-primary">Tirreno Assicurazioni</h3>
</div>
<div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center shrink-0 text-primary">
<span className="material-symbols-outlined text-[20px]">verified_user</span>
</div>
</div>
<div className="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mb-space-md">
<span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
<span>Naples &amp; Viareggio, Italy</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant">
              Dedicated marine syndicate representation, Mediterranean race coverage riders, and fast-track claims adjusting under Italian naval jurisdiction.
            </p>
</div>
<div className="mt-space-lg pt-space-md flex items-center justify-between">
<div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
<span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
<span>Inspected 2025</span>
</div>
<div className="flex items-center gap-space-sm">
<button className="px-space-md py-space-xs rounded bg-surface-container-low text-primary hover:bg-surface-container font-title-md text-title-md transition-colors" type="button">
                Enquire
              </button>
<Link href="#" className="px-space-md py-space-xs rounded bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md transition-colors" >
                View profile
              </Link>
</div>
</div>
</article>
</div>

<div className="hidden py-space-2xl text-center bg-surface-container-low rounded-xl mt-space-lg" id="no-providers-msg">
<span className="material-symbols-outlined text-outline text-[40px] mb-2">sailing</span>
<h4 className="font-headline-sm text-headline-sm text-primary">No providers located in this sector</h4>
<p className="font-body-md text-body-md text-on-surface-variant mt-1">Please select another region or browse All Spain.</p>
</div>
</section>

<section className="w-full bg-primary-container text-on-primary py-space-2xl mt-space-xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex flex-col md:flex-row items-center justify-between gap-space-xl">
<div className="max-w-xl">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary-fixed">Nauta Verified Network</span>
<h2 className="font-headline-md text-headline-md text-on-primary mt-space-xs tracking-tight">Are you an accredited maritime service provider?</h2>
<p className="font-body-md text-body-md text-on-primary-container mt-space-xs">
            Join the Mediterranean’s dedicated marketplace. Connect with verified boat owners, institutional brokers, and qualified buyers across Spain and Italy.
          </p>
</div>
<div className="flex items-center gap-space-md shrink-0">
<Link href="/register/" className="px-space-lg py-space-sm bg-surface-container-lowest text-primary hover:bg-surface font-title-md text-title-md rounded transition-colors font-medium" >
            Register your company
          </Link>
</div>
</div>
</section>
</div>
</div>

    </main>
  );
}
