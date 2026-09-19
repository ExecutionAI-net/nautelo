import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function PrivateSellerServices() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<aside className="w-full bg-primary text-on-primary py-space-xs px-margin-mobile md:px-margin lg:px-margin-desktop shadow-sm">
<div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-y-2 text-label-md font-label-md">
<div className="flex items-center gap-space-sm">
<span className="inline-block w-2 h-2 rounded-full bg-secondary-fixed animate-pulse"></span>
<span className="tracking-wide uppercase text-on-primary-container">Prototype Mode:</span>
<span className="text-on-primary font-semibold">Private Seller Portal</span>
<span className="text-outline text-label-sm">| Screen 26 of 51</span>
</div>
<div className="flex items-center gap-space-md">
<Link href="#" className="inline-flex items-center gap-1 text-primary-fixed hover:text-white transition-colors" >
<span className="material-symbols-outlined text-[15px]">swap_horiz</span>
<span>Switch Demo Role</span>
</Link>
<span className="text-outline-variant opacity-40">/</span>
<Link href="#" className="inline-flex items-center gap-1 text-on-primary-container hover:text-white transition-colors" >
<span className="material-symbols-outlined text-[15px]">logout</span>
<span>Log Out</span>
</Link>
</div>
</div>
</aside>

<div className="max-w-[1440px] mx-auto w-full px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md pb-space-lg mb-space-lg">
<div className="space-y-1">
<div className="flex items-center gap-2 font-label-sm text-label-sm text-secondary uppercase tracking-widest">
<span>Palma De Mallorca Hub</span>
<span className="inline-block w-1 h-1 rounded-full bg-outline"></span>
<span>Vessel Owner Workspace</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Nautical Concierge &amp; Services</h1>
<p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          Coordinate specialized maritime surveyors, naval legal advisors, and verified shipyard engineers under Nauta Escrow protection.
        </p>
</div>

<div className="flex items-center gap-3 bg-surface-container p-space-sm rounded-xl shadow-sm self-start lg:self-auto">
<div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-secondary shadow-sm">
<span className="material-symbols-outlined text-[22px]">verified_user</span>
</div>
<div className="pr-2">
<p className="font-label-sm text-label-sm text-on-surface-variant uppercase">Escrow Protection</p>
<p className="font-spec-num text-spec-num text-primary">Active · 2 Hired Contracts</p>
</div>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">

<nav aria-label="Seller Dashboard Sections" className="lg:col-span-3 bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-1">
<div className="px-space-sm py-space-xs mb-space-xs font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
          Seller Navigation
        </div>
<Link href="#" className="flex items-center gap-3 px-space-sm py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all font-body-md text-body-md" >
<span className="material-symbols-outlined text-[20px]">dashboard</span>
<span>Overview</span>
</Link>
<Link href="#" className="flex items-center justify-between px-space-sm py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all font-body-md text-body-md" >
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-[20px]">directions_boat</span>
<span>My Listings</span>
</div>
<span className="bg-surface-container-high text-primary font-label-sm text-label-sm px-2 py-0.5 rounded-full">2</span>
</Link>
<Link href="#" className="flex items-center justify-between px-space-sm py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all font-body-md text-body-md" >
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
<span>Enquiries &amp; Messages</span>
</div>
<span className="bg-secondary text-on-secondary font-label-sm text-label-sm px-2 py-0.5 rounded-full">3</span>
</Link>
<Link href="#" className="flex items-center gap-3 px-space-sm py-2.5 rounded-lg bg-primary text-on-primary font-title-md text-title-md shadow-sm" >
<span className="material-symbols-outlined text-[20px] text-secondary-fixed">anchor</span>
<span>Services</span>
</Link>
<Link href="#" className="flex items-center gap-3 px-space-sm py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all font-body-md text-body-md" >
<span className="material-symbols-outlined text-[20px]">settings</span>
<span>My Account</span>
</Link>

<div className="mt-space-lg pt-space-md bg-surface-container-low p-space-sm rounded-lg space-y-2">
<div className="flex items-center gap-2 text-primary font-title-md text-title-md">
<span className="material-symbols-outlined text-secondary text-[18px]">support_agent</span>
<span>Nauta Escrow Desk</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Need custom drydock reservations or certified Balearic crane coordination?
          </p>
<Link href="#" className="inline-flex items-center gap-1 font-label-md text-label-md text-secondary hover:text-primary transition-colors pt-1" >
<span>Direct Concierge Call</span>
<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</Link>
</div>
</nav>

<div className="lg:col-span-9 space-y-space-xl min-w-0">

<section className="space-y-space-md">
<div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
<div>
<div className="flex items-center gap-2">
<span className="inline-block w-2.5 h-0.5 bg-secondary"></span>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Active Engagements</span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary tracking-tight mt-1">
                Active Hired Services for Your Vessels
              </h2>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant self-start sm:self-auto">
              2 mandates tracked under Nauta Custody
            </span>
</div>
<div className="space-y-space-md">

<article className="bg-surface-container-lowest rounded-xl p-space-md sm:p-space-lg shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
<div className="absolute top-0 left-0 w-1.5 h-full bg-secondary"></div>
<div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">

<div className="xl:col-span-8 space-y-space-sm min-w-0">
<div className="flex flex-wrap items-center gap-2">
<span className="inline-flex items-center gap-1.5 bg-surface-container-high text-primary font-label-sm text-label-sm px-2.5 py-1 rounded-full">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
<span>Scheduled · 14 Oct 2025</span>
</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Mandate #NT-SURV-8821</span>
<span className="text-outline-variant">·</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Escrow Hold: €1,850.00</span>
</div>
<div>
<h3 className="font-title-lg text-title-lg text-primary">
                      Marine Pre-Purchase &amp; Full Hull Ultrasonic Survey
                    </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      Target vessel: <span className="font-medium text-on-surface">Solaris 50 (2022) · Berth A-24, Marina Port Vell, Barcelona</span>
</p>
</div>

<div className="flex items-center gap-3 bg-surface-container-low p-2.5 rounded-lg w-full max-w-md">
<div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-sm text-primary">
<span className="material-symbols-outlined text-[22px]">engineering</span>
</div>
<div className="min-w-0 flex-1">
<p className="font-label-md text-label-md text-primary truncate">Talleres Navales del Mediterráneo S.L.</p>
<p className="font-body-sm text-body-sm text-on-surface-variant truncate">Lead Inspector: Capt. Mateu Rosselló (IIMS Certified)</p>
</div>
</div>

<div className="pt-2">
<div className="flex justify-between items-center text-label-sm font-label-sm text-on-surface-variant mb-1.5">
<span>Inspection Protocol Phase</span>
<span className="text-secondary font-semibold">Drydock Inspection Slated</span>
</div>
<div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
<div className="bg-secondary h-1.5 rounded-full" style={{"width": "45%"}}></div>
</div>
</div>
</div>

<div className="xl:col-span-4 flex flex-col gap-2.5 w-full xl:pl-space-md xl:border-l xl:border-surface-container">
<div className="bg-surface-container-low p-space-sm rounded-lg">
<div className="flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant">
<span>Surveyor Check-in</span>
<span className="font-semibold text-primary">08:30 AM CET</span>
</div>
<div className="text-body-sm font-body-sm text-on-surface-variant mt-1">
                      Marina office clearance arranged with dockmaster.
                    </div>
</div>
<button className="w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-space-md py-2.5 rounded-lg hover:bg-primary-container transition-colors font-label-md text-label-md shadow-sm" type="button">
<span className="material-symbols-outlined text-[18px]">chat</span>
<span>Contact Surveyor</span>
</button>
<Link href="#" className="w-full inline-flex items-center justify-center gap-2 bg-surface-container text-primary hover:bg-surface-container-high px-space-md py-2.5 rounded-lg transition-colors font-label-md text-label-md" >
<span className="material-symbols-outlined text-[18px]">folder_open</span>
<span>View Preliminary Dossier</span>
</Link>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl p-space-md sm:p-space-lg shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
<div className="absolute top-0 left-0 w-1.5 h-full bg-on-tertiary-container"></div>
<div className="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">

<div className="xl:col-span-8 space-y-space-sm min-w-0">
<div className="flex flex-wrap items-center gap-2">
<span className="inline-flex items-center gap-1.5 bg-surface-container-high text-primary font-label-sm text-label-sm px-2.5 py-1 rounded-full">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
<span>Completed · 28 Sept 2025</span>
</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">Certificate #NT-LEGAL-4109</span>
<span className="text-outline-variant">·</span>
<span className="font-label-sm text-label-sm text-secondary font-medium">Verified &amp; Notarized</span>
</div>
<div>
<h3 className="font-title-lg text-title-lg text-primary">
                      Vessel Legal Title Verification &amp; Spanish/Italian Tax Dossier
                    </h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      Target vessel: <span className="font-medium text-on-surface">Pardo 38 (2021) · Registro Marítimo de Palma (Lista 7ª)</span>
</p>
</div>

<div className="flex items-center gap-3 bg-surface-container-low p-2.5 rounded-lg w-full max-w-md">
<div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-sm text-primary">
<span className="material-symbols-outlined text-[22px]">gavel</span>
</div>
<div className="min-w-0 flex-1">
<p className="font-label-md text-label-md text-primary truncate">Mar Balear Legal Abogados Marítimos</p>
<p className="font-body-sm text-body-sm text-on-surface-variant truncate">Counsel: Dña. Elena Soler (Col. 4.291 ICAIB)</p>
</div>
</div>

<div className="flex flex-wrap gap-2 pt-1">
<span className="inline-flex items-center gap-1 text-label-sm font-label-sm bg-surface-container px-2 py-1 rounded text-primary">
<span className="material-symbols-outlined text-[14px] text-secondary">check_circle</span>
<span>No Liens / Encumbrances Found</span>
</span>
<span className="inline-flex items-center gap-1 text-label-sm font-label-sm bg-surface-container px-2 py-1 rounded text-primary">
<span className="material-symbols-outlined text-[14px] text-secondary">check_circle</span>
<span>VAT / T0 Maritime Tax Paid</span>
</span>
<span className="inline-flex items-center gap-1 text-label-sm font-label-sm bg-surface-container px-2 py-1 rounded text-primary">
<span className="material-symbols-outlined text-[14px] text-secondary">check_circle</span>
<span>EU Flag Registry Clean</span>
</span>
</div>
</div>

<div className="xl:col-span-4 flex flex-col gap-2.5 w-full xl:pl-space-md xl:border-l xl:border-surface-container">
<div className="bg-surface-container-low p-space-sm rounded-lg flex items-center gap-2 text-primary font-label-sm text-label-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">verified</span>
<span>Ready for Prospective Buyers</span>
</div>
<Link href="#" className="w-full inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-space-md py-2.5 rounded-lg hover:bg-primary-container transition-colors font-label-md text-label-md shadow-sm" download="" >
<span className="material-symbols-outlined text-[18px]">download</span>
<span>Download Official Certificate</span>
</Link>
<button className="w-full inline-flex items-center justify-center gap-2 bg-surface-container text-primary hover:bg-surface-container-high px-space-md py-2.5 rounded-lg transition-colors font-label-md text-label-md" type="button">
<span className="material-symbols-outlined text-[18px]">share</span>
<span>Attach to Listing Public View</span>
</button>
</div>
</div>
</article>
</div>
</section>

<section className="space-y-space-md pt-space-sm">
<div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
<div>
<div className="flex items-center gap-2">
<span className="inline-block w-2.5 h-0.5 bg-secondary"></span>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Concierge Marketplace</span>
</div>
<h2 className="font-headline-sm text-headline-sm text-primary tracking-tight mt-1">
                Book Nautical Services for Your Listed Fleet
              </h2>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">
              Fixed-quote certified Mediterranean providers
            </span>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">

<Link href="#" className="group bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative" >
<div className="space-y-space-sm">
<div className="w-full h-44 rounded-lg overflow-hidden relative bg-surface-container">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/c9a4efd59d.jpg"/>
<div className="absolute top-3 right-3 bg-surface-container-lowest/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-label-sm font-label-sm text-primary">
                    Volvo Penta · Yanmar · MAN
                  </div>
</div>
<div className="pt-1">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
                      Engine Maintenance &amp; Diagnostics
                    </h3>
<span className="material-symbols-outlined text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                      arrow_outward
                    </span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">
                    Official computerized engine hours certification, oil spectrometry analysis, and pre-sale sea trial mechanical sign-offs.
                  </p>
</div>
</div>
<div className="mt-space-md pt-space-sm flex items-center justify-between bg-surface-container-low p-2.5 rounded-lg">
<div className="flex items-center gap-1.5 text-label-sm font-label-sm text-on-surface">
<span className="material-symbols-outlined text-[16px] text-secondary">speed</span>
<span>Turnaround: 48-72h</span>
</div>
<span className="font-label-md text-label-md text-secondary group-hover:underline">Explore Technicians →</span>
</div>
</Link>

<Link href="#" className="group bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative" >
<div className="space-y-space-sm">
<div className="w-full h-44 rounded-lg overflow-hidden relative bg-surface-container">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/b6a0ccb2d6.jpg"/>
<div className="absolute top-3 right-3 bg-surface-container-lowest/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-label-sm font-label-sm text-primary">
                    Skippered or Semi-Submersible Cargo
                  </div>
</div>
<div className="pt-1">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
                      Transport &amp; Delivery
                    </h3>
<span className="material-symbols-outlined text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                      arrow_outward
                    </span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">
                    Licensed Master 200GT skippers for Mediterranean transfers (Balearics, Côte d&apos;Azur, Tyrrhenian) or overland heavy haulage.
                  </p>
</div>
</div>
<div className="mt-space-md pt-space-sm flex items-center justify-between bg-surface-container-low p-2.5 rounded-lg">
<div className="flex items-center gap-1.5 text-label-sm font-label-sm text-on-surface">
<span className="material-symbols-outlined text-[16px] text-secondary">explore</span>
<span>Fully Tracked Voyage Logs</span>
</div>
<span className="font-label-md text-label-md text-secondary group-hover:underline">Calculate Route →</span>
</div>
</Link>

<Link href="#" className="group bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative" >
<div className="space-y-space-sm">
<div className="w-full h-44 rounded-lg overflow-hidden relative bg-surface-container">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/ac79a59a22.jpg"/>
<div className="absolute top-3 right-3 bg-surface-container-lowest/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-label-sm font-label-sm text-primary">
                    Spain · Italy · Malta Registry
                  </div>
</div>
<div className="pt-1">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
                      Nautical Legal &amp; Registration Transfer
                    </h3>
<span className="material-symbols-outlined text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                      arrow_outward
                    </span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">
                    Cross-border flag deregulation, Capitanía Marítima title transfers, and bilingual bilag contracts compliant with EU nautical codes.
                  </p>
</div>
</div>
<div className="mt-space-md pt-space-sm flex items-center justify-between bg-surface-container-low p-2.5 rounded-lg">
<div className="flex items-center gap-1.5 text-label-sm font-label-sm text-on-surface">
<span className="material-symbols-outlined text-[16px] text-secondary">balance</span>
<span>Legal Escrow Verified</span>
</div>
<span className="font-label-md text-label-md text-secondary group-hover:underline">Consult Counsel →</span>
</div>
</Link>

<Link href="#" className="group bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative" >
<div className="space-y-space-sm">
<div className="w-full h-44 rounded-lg overflow-hidden relative bg-surface-container">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/8ec7f3e35d.jpg"/>
<div className="absolute top-3 right-3 bg-surface-container-lowest/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-label-sm font-label-sm text-primary">
                    P&amp;I · All-Risk Hull &amp; Machinery
                  </div>
</div>
<div className="pt-1">
<div className="flex items-center justify-between">
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">
                      Marine Insurance Quotes
                    </h3>
<span className="material-symbols-outlined text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                      arrow_outward
                    </span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5 leading-relaxed">
                    Compare Lloyd’s syndicate and Mediterranean underwriter policies including international cruising radius and charter extensions.
                  </p>
</div>
</div>
<div className="mt-space-md pt-space-sm flex items-center justify-between bg-surface-container-low p-2.5 rounded-lg">
<div className="flex items-center gap-1.5 text-label-sm font-label-sm text-on-surface">
<span className="material-symbols-outlined text-[16px] text-secondary">security</span>
<span>Instant Underwriting</span>
</div>
<span className="font-label-md text-label-md text-secondary group-hover:underline">Request Quotes →</span>
</div>
</Link>
</div>
</section>

<section className="bg-primary text-on-primary rounded-xl p-space-md sm:p-space-lg shadow-sm relative overflow-hidden">
<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md relative z-10">
<div className="space-y-2 max-w-2xl">
<div className="flex items-center gap-2 font-label-sm text-label-sm uppercase tracking-widest text-secondary-fixed">
<span className="material-symbols-outlined text-[18px]">verified_user</span>
<span>Protected by Nauta Maritime Escrow Protocols</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-white">
                Fiduciary Milestone Protection for Every Mandate
              </h3>
<p className="font-body-md text-body-md text-on-primary-container leading-relaxed">
                Service provider fees are deposited into an independent Banco de España regulated fiduciary escrow account. Disbursements are released strictly after you review and approve surveyor dossiers, delivery sea trials, or notarized legal filings.
              </p>
</div>
<div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
<Link href="#" className="inline-flex items-center justify-center gap-2 bg-secondary text-on-secondary px-space-md py-2.5 rounded-lg hover:bg-secondary-container hover:text-on-secondary-fixed transition-colors font-label-md text-label-md" >
<span className="material-symbols-outlined text-[16px]">policy</span>
<span>Read Escrow Terms</span>
</Link>
<Link href="#" className="inline-flex items-center justify-center gap-2 bg-surface-container-high/10 text-white hover:bg-white/15 px-space-md py-2.5 rounded-lg transition-colors font-label-md text-label-md" >
<span className="material-symbols-outlined text-[16px]">lock_reset</span>
<span>Dispute Resolution Protocol</span>
</Link>
</div>
</div>

<div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none">
<span className="material-symbols-outlined text-[240px]">anchor</span>
</div>
</section>
</div>
</div>
</div>
</div>
      </RequirePermission>
    </main>
  );
}
