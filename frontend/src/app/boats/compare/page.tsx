import Link from "@/components/layout/LocaleLink";

export default function ComparePage() {
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">
<section className="w-full bg-surface-container-low pt-space-xl pb-space-lg">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
<div>
<nav className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-space-xs">
<Link href="/boats/" className="hover:text-primary transition-colors" >Vessels</Link>
<span className="text-outline-variant">/</span>
<span className="text-primary font-semibold">Technical Comparison</span>
</nav>
<div className="flex items-baseline gap-space-md">
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Boat Comparison</h1>
<span className="font-label-md text-label-md px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
              Comparing 3 of 3 vessels
            </span>
</div>
</div>
<div className="flex items-center gap-space-sm self-start md:self-auto shrink-0">
<button className="inline-flex items-center gap-1.5 px-space-md py-space-xs rounded bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container-high transition-colors font-body-sm text-body-sm font-medium" id="toggle-diff-btn" type="button">
<span className="material-symbols-outlined text-[18px] text-secondary">tune</span>
<span id="toggle-diff-label">Highlight differences</span>
</button>
<button className="inline-flex items-center gap-1.5 px-space-md py-space-xs rounded bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container-high transition-colors font-body-sm text-body-sm font-medium" type="button">
<span className="material-symbols-outlined text-[18px]">print</span>
<span>Print specification</span>
</button>
<button className="inline-flex items-center gap-1.5 px-space-md py-space-xs rounded bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container-high transition-colors font-body-sm text-body-sm font-medium" type="button">
<span className="material-symbols-outlined text-[18px]">share</span>
<span id="share-btn-text">Share sheet</span>
</button>
</div>
</div>
</div>
</section>
<section className="w-full pb-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="w-full overflow-x-auto">
<div className="min-w-[1040px] flex flex-col">
<div className="sticky top-20 z-40 bg-surface/95 backdrop-blur-md pt-space-lg pb-space-md">
<div className="grid grid-cols-12 gap-gutter-desktop items-start">
<div className="col-span-3 flex flex-col justify-end h-full pb-space-sm pr-space-md">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold mb-space-xs">Maritime Matrix</span>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Direct structural, mechanical, and legal specifications across three selected Mediterranean charter and private hulls.
                </p>
<div className="mt-space-md pt-space-sm flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span>Legal registry verified via Nauta API</span>
</div>
</div>

<div className="col-span-3 flex flex-col bg-surface-container-lowest rounded-xl shadow-sm p-space-md relative transition-all" id="boat-col-1">
<div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg bg-surface-container-high mb-space-sm">
<img alt="" className="w-full h-full object-cover" src="/design/24fcaabe59.jpg"/>
<span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-primary/80 backdrop-blur-sm text-on-primary font-label-sm text-label-sm">
                    Palma, ES
                  </span>
</div>
<div className="flex items-start justify-between gap-space-xs mb-space-xs">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">Sanlorenzo</span>
<h2 className="font-headline-sm text-headline-sm text-primary leading-tight">SX88</h2>
</div>
<button className="text-on-surface-variant hover:text-error transition-colors p-1 -mr-1" title="Remove Sanlorenzo SX88">
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<div className="mb-space-md">
<div className="font-title-lg text-title-lg text-primary font-semibold">€5,200,000</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">EU VAT Paid</span>
</div>
<div className="flex flex-col gap-space-xs mt-auto">
<Link href="/boats/" className="w-full text-center bg-primary-container hover:bg-primary text-on-primary py-2 px-space-md rounded font-body-sm text-body-sm font-medium transition-colors shadow-sm" >
                    View listing
                  </Link>
<button className="w-full text-center text-on-surface-variant hover:text-error py-1.5 font-label-md text-label-md transition-colors flex items-center justify-center gap-1">
<span className="material-symbols-outlined text-[15px]">delete</span>
<span>Remove</span>
</button>
</div>
</div>

<div className="col-span-3 flex flex-col bg-surface-container-lowest rounded-xl shadow-sm p-space-md relative transition-all" id="boat-col-2">
<div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg bg-surface-container-high mb-space-sm">
<img alt="" className="w-full h-full object-cover" src="/design/83c349273c.jpg"/>
<span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-primary/80 backdrop-blur-sm text-on-primary font-label-sm text-label-sm">
                    Capri, IT
                  </span>
</div>
<div className="flex items-start justify-between gap-space-xs mb-space-xs">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">Arcadia</span>
<h2 className="font-headline-sm text-headline-sm text-primary leading-tight">Sherpa 80</h2>
</div>
<button className="text-on-surface-variant hover:text-error transition-colors p-1 -mr-1" title="Remove Arcadia Sherpa 80">
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<div className="mb-space-md">
<div className="font-title-lg text-title-lg text-primary font-semibold">€4,150,000</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Excl. VAT</span>
</div>
<div className="flex flex-col gap-space-xs mt-auto">
<Link href="/boats/" className="w-full text-center bg-primary-container hover:bg-primary text-on-primary py-2 px-space-md rounded font-body-sm text-body-sm font-medium transition-colors shadow-sm" >
                    View listing
                  </Link>
<button className="w-full text-center text-on-surface-variant hover:text-error py-1.5 font-label-md text-label-md transition-colors flex items-center justify-center gap-1">
<span className="material-symbols-outlined text-[15px]">delete</span>
<span>Remove</span>
</button>
</div>
</div>

<div className="col-span-3 flex flex-col bg-surface-container-lowest rounded-xl shadow-sm p-space-md relative transition-all" id="boat-col-3">
<div className="relative w-full aspect-[16/10] overflow-hidden rounded-lg bg-surface-container-high mb-space-sm">
<img alt="" className="w-full h-full object-cover" src="/design/ac3baa53ad.jpg"/>
<span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-primary/80 backdrop-blur-sm text-on-primary font-label-sm text-label-sm">
                    Ibiza, ES
                  </span>
</div>
<div className="flex items-start justify-between gap-space-xs mb-space-xs">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">Princess</span>
<h2 className="font-headline-sm text-headline-sm text-primary leading-tight">Y85</h2>
</div>
<button className="text-on-surface-variant hover:text-error transition-colors p-1 -mr-1" title="Remove Princess Y85">
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<div className="mb-space-md">
<div className="font-title-lg text-title-lg text-primary font-semibold">€5,450,000</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">EU VAT Paid</span>
</div>
<div className="flex flex-col gap-space-xs mt-auto">
<Link href="/boats/" className="w-full text-center bg-primary-container hover:bg-primary text-on-primary py-2 px-space-md rounded font-body-sm text-body-sm font-medium transition-colors shadow-sm" >
                    View listing
                  </Link>
<button className="w-full text-center text-on-surface-variant hover:text-error py-1.5 font-label-md text-label-md transition-colors flex items-center justify-center gap-1">
<span className="material-symbols-outlined text-[15px]">delete</span>
<span>Remove</span>
</button>
</div>
</div>
</div>
</div>

<div className="flex flex-col mt-space-md">

<div className="w-full py-space-sm px-space-md bg-surface-container rounded font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold mb-1">
              Dimensions &amp; Hull Architecture
            </div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">calendar_today</span>
<span>Year of Build</span>
</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface font-semibold">2021</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface font-semibold">2020</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface font-semibold">2021</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">straighten</span>
<span>Length Overall (LOA)</span>
</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">26.70 m <span className="text-on-surface-variant font-body-sm">(87 ft 7 in)</span></div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">24.00 m <span className="text-on-surface-variant font-body-sm">(78 ft 9 in)</span></div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">26.20 m <span className="text-on-surface-variant font-body-sm">(86 ft 0 in)</span></div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">arrows_outward</span>
<span>Maximum Beam</span>
</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">7.20 m</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">6.95 m</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">6.30 m</div>
</div>

<div className="grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium">Beam Ratio (Stability)</div>
<div className="col-span-3 flex items-center gap-2">
<div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "27%"}}></div>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant">0.27</span>
</div>
<div className="col-span-3 flex items-center gap-2">
<div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "29%"}}></div>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant">0.29</span>
</div>
<div className="col-span-3 flex items-center gap-2">
<div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
<div className="bg-secondary h-full rounded-full" style={{"width": "24%"}}></div>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant">0.24</span>
</div>
</div>

<div className="w-full py-space-sm px-space-md bg-surface-container rounded font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold mt-space-md mb-1">
              Propulsion &amp; Engineering
            </div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">settings</span>
<span>Engine Configuration</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">3x Volvo Penta IPS 1050</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">2x Volvo Penta IPS 800</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">2x Twin MAN V12 1900 HP</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">bolt</span>
<span>Total Output</span>
</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">2,400 HP</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">1,600 HP</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">3,800 HP</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">schedule</span>
<span>Engine Hours</span>
</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">420 hrs</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">310 hrs</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">550 hrs</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm" data-diff="false">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">local_gas_station</span>
<span>Fuel Type</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">Diesel</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">Diesel</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">Diesel</div>
</div>

<div className="w-full py-space-sm px-space-md bg-surface-container rounded font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold mt-space-md mb-1">
              Accommodation &amp; Living Spaces
            </div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">bed</span>
<span>Guest Cabins</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface font-semibold">4 Cabins (8 Guests)</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface font-semibold">3 Cabins (6 Guests)</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface font-semibold">4 Cabins (8 Guests)</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">shower</span>
<span>Bathrooms / Heads</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">4 En-suite + 1 Day head</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">3 En-suite</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">4 En-suite</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">group</span>
<span>Crew Berths</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">2 Cabins (3 Crew)</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">1 Cabin (2 Crew)</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">2 Cabins (3 Crew)</div>
</div>

<div className="w-full py-space-sm px-space-md bg-surface-container rounded font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold mt-space-md mb-1">
              Registry, Berth &amp; Representation
            </div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">pin_drop</span>
<span>Current Mooring Location</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">Palma de Mallorca, ES</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">Capri (Marina Grande), IT</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">Ibiza (Marina Botafoch), ES</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">verified_user</span>
<span>Representation / Seller Type</span>
</div>
<div className="col-span-3">
<span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-on-surface font-body-sm text-body-sm font-medium">
                  Professional Broker (Exclusive)
                </span>
</div>
<div className="col-span-3">
<span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-on-surface font-body-sm text-body-sm font-medium">
                  Professional Broker (Central)
                </span>
</div>
<div className="col-span-3">
<span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-on-surface font-body-sm text-body-sm font-medium">
                  Private Seller
                </span>
</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">flag</span>
<span>Flag State</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">Spain (Lista 6ª)</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">Italy (Registro Naviglio)</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">Malta Commercial</div>
</div>

<div className="grid grid-cols-12 gap-gutter-desktop items-center pt-space-xl pb-space-md">
<div className="col-span-3 flex flex-col justify-center">
<span className="font-title-md text-title-md text-primary">Inquiry &amp; Survey</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Request surveyor records or arrange dockside inspection</span>
</div>
<div className="col-span-3">
<Link href="/contact/" className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-on-primary py-2.5 px-space-md rounded shadow-sm hover:bg-primary-container transition-colors font-body-sm text-body-sm font-semibold" >
<span>Contact Broker</span>
<span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</Link>
</div>
<div className="col-span-3">
<Link href="/contact/" className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-on-primary py-2.5 px-space-md rounded shadow-sm hover:bg-primary-container transition-colors font-body-sm text-body-sm font-semibold" >
<span>Contact Broker</span>
<span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</Link>
</div>
<div className="col-span-3">
<Link href="/contact/" className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-on-primary py-2.5 px-space-md rounded shadow-sm hover:bg-primary-container transition-colors font-body-sm text-body-sm font-semibold" >
<span>Contact Owner</span>
<span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</Link>
</div>
</div>
</div>
</div>
</div>
</div>
</section>

<div className="hidden w-full bg-surface-container-high py-space-md border-t border-outline-variant" id="add-slot-bar">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex items-center justify-between">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary">add_circle</span>
<span className="font-body-md text-body-md text-primary font-medium">Comparison slot open. Browse our Mediterranean fleet to compare another vessel.</span>
</div>
<Link href="/boats/" className="inline-flex items-center gap-1 px-space-md py-1.5 rounded bg-primary text-on-primary font-body-sm text-body-sm hover:bg-primary-container transition-colors" >
<span>Browse inventory</span>
<span className="material-symbols-outlined text-[16px]">chevron_right</span>
</Link>
</div>
</div>
</div>

    </main>
  );
}
