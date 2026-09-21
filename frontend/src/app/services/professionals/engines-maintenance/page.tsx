import Link from "@/components/layout/LocaleLink";

export default function EnginesMaintenance() {
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="w-full bg-surface-container-low py-space-sm shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex items-center justify-between">

<nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
<Link href="/" className="hover:text-primary transition-colors" >Home</Link>
<span className="text-outline-variant font-label-sm">/</span>
<Link href="/services/professionals/" className="hover:text-primary transition-colors" >Services</Link>
<span className="text-outline-variant font-label-sm">/</span>
<span className="text-primary font-medium">Engines &amp; Maintenance</span>
</nav>

<div className="flex items-center gap-space-xs">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider hidden sm:inline">Language</span>
<div className="inline-flex items-center p-0.5 rounded-full bg-surface-container-highest shadow-sm">
<button className="px-2.5 py-0.5 rounded-full bg-primary text-on-primary font-label-md text-label-md transition-all" type="button">EN</button>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-all" type="button">IT</button>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-all" type="button">ES</button>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-xl lg:py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">

<div className="lg:col-span-7 flex flex-col gap-space-md">
<div className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container w-fit">
<span className="material-symbols-outlined text-[16px]">verified</span>
<span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">Certified Marine Engineering Network</span>
</div>
<h1 className="font-display-hero text-headline-lg lg:text-display-hero text-primary tracking-tight">
            Marine engine repair, maintenance and yacht refit in Spain and Italy
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
            Certified shipyard overhauls, diesel propulsion diagnostics, winterisation drydock servicing, and official technical support across Spanish and Italian ports.
          </p>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm pt-space-xs">
<div className="flex items-center gap-space-xs p-space-sm rounded-lg bg-surface-container shadow-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">engineering</span>
<span className="font-body-sm text-body-sm text-primary font-medium">Volvo Penta, MAN, MTU &amp; Yanmar</span>
</div>
<div className="flex items-center gap-space-xs p-space-sm rounded-lg bg-surface-container shadow-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">military_tech</span>
<span className="font-body-sm text-body-sm text-primary font-medium">Licensed Naval Mechanics</span>
</div>
<div className="flex items-center gap-space-xs p-space-sm rounded-lg bg-surface-container shadow-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">fmd_good</span>
<span className="font-body-sm text-body-sm text-primary font-medium">Rapid Dockside Dispatch</span>
</div>
</div>

<div className="flex flex-wrap items-center gap-space-md pt-space-sm">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container px-space-lg py-3 rounded-lg font-title-md text-title-md shadow-md transition-colors gap-space-xs" >
<span>Request technical service</span>
<span className="material-symbols-outlined text-[20px]">arrow_downward</span>
</Link>
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-surface-container-high hover:bg-surface-container-highest text-primary px-space-lg py-3 rounded-lg font-title-md text-title-md transition-colors gap-space-xs" >
<span>Explore service scope</span>
<span className="material-symbols-outlined text-[18px]">south</span>
</Link>
</div>
</div>

<div className="lg:col-span-5 relative">
<div className="relative rounded-xl overflow-hidden shadow-xl bg-primary">
<img alt="" className="w-full h-[460px] object-cover mix-blend-luminosity opacity-95 hover:opacity-100 transition-opacity" src="/design/4190704a8a.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/30 to-transparent"></div>
<div className="absolute bottom-0 left-0 right-0 p-space-md flex flex-col gap-space-xs text-on-primary">
<div className="inline-flex items-center gap-space-xs bg-surface-container-lowest/20 backdrop-blur-md px-3 py-1 rounded-full w-fit">
<span className="inline-block w-2 h-2 rounded-full bg-secondary-fixed"></span>
<span className="font-label-sm text-label-sm text-on-primary font-semibold tracking-wide">ACTIVE HARBOR TECHNICAL HUBS</span>
</div>
<p className="font-title-md text-title-md text-on-primary">
                Certified Shipyard Network · Palma, Barcelona, Genoa, Naples
              </p>
<div className="flex items-center justify-between text-on-primary-container font-body-sm text-body-sm pt-space-xs">
<span>Standard SLA: &lt; 24h Telemetry Triage</span>
<span className="text-secondary-fixed font-spec-num text-spec-num">ISO 9001:2015 Marine</span>
</div>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl" id="service-scope">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">

<div className="lg:col-span-7 flex flex-col gap-space-md">
<div className="flex items-center gap-space-xs text-secondary font-label-md text-label-md uppercase tracking-wider">
<span className="material-symbols-outlined text-[18px]">water</span>
<span>Naval Heritage · Mediterranean Context</span>
</div>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
            Precision Marine Engineering &amp; Propulsion Reliability
          </h2>
<div className="font-body-lg text-body-lg text-on-surface-variant flex flex-col gap-space-md leading-relaxed">
<p>
              The Mediterranean and Tyrrhenian basins present some of the most aggressive marine operational environments on earth. Elevated water temperatures and heightened salinity levels accelerate galvanic electrolysis, scale calcification inside raw water heat exchangers, and biological fouling on running gear. Operating high-output marine diesel engines under sustained cruising RPM without strict preventative calibration guarantees premature failure and exorbitant downtime.
            </p>
<p>
              Nauta coordinates certified naval master technicians and authorized engine specialists who understand these exact regional realities. From systematic descaling of charge-air coolers and turbocharger intercoolers using non-destructive biochemical flushes to micrometer-level drive shaft realignment and Volvo Penta IPS / Cummins Zeus pod recalibrations, every intervention is performed to original equipment manufacturer (OEM) tolerances.
            </p>
<p>
              Our engineers ensure that logbooks are stamped in accordance with Spanish Capitán Marítimo and Italian Capitaneria di Porto technical standards, safeguarding your vessel&apos;s warranty compliance, marine insurance validity, and long-term resale appraisal.
            </p>
</div>

<div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm pt-space-sm">
<div className="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">Cooling Flush</span>
<span className="block font-title-lg text-title-lg text-primary font-bold mt-1">400 h</span>
<span className="block font-body-sm text-body-sm text-on-surface-variant">Recommended cycle</span>
</div>
<div className="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">Fluid Lab Test</span>
<span className="block font-title-lg text-title-lg text-primary font-bold mt-1">ASTM</span>
<span className="block font-body-sm text-body-sm text-on-surface-variant">Spectrographic standard</span>
</div>
<div className="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">Shaft Tolerance</span>
<span className="block font-title-lg text-title-lg text-primary font-bold mt-1">±0.05 mm</span>
<span className="block font-body-sm text-body-sm text-on-surface-variant">Laser precision align</span>
</div>
<div className="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">Warranty Log</span>
<span className="block font-title-lg text-title-lg text-primary font-bold mt-1">100%</span>
<span className="block font-body-sm text-body-sm text-on-surface-variant">OEM Certified entry</span>
</div>
</div>
</div>

<div className="lg:col-span-5 flex flex-col gap-space-md justify-center">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md">
<div className="flex items-center gap-space-sm mb-space-sm">
<div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center">
<span className="material-symbols-outlined text-[24px]">terminal</span>
</div>
<div>
<h3 className="font-headline-sm text-headline-sm text-primary">Authorized Diagnostic Protocol</h3>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">OEM Proprietary Tooling</span>
</div>
</div>
<ul className="flex flex-col gap-space-xs font-body-md text-body-md text-on-surface-variant">
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>Direct electronic ECM diagnostics for Volvo Vodia, MAN-cats, Yanmar YDT, and MTU Dias.</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>Common-rail fuel injection pressure balancing and flow return rate measurement.</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>Spectrographic oil lab analysis for wear metals, soot dilution, and glycol contamination.</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>Turbocharger boost pressure validation and turbine shaft end-play tolerance checking.</span>
</li>
</ul>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md">
<div className="flex items-center gap-space-sm mb-space-sm">
<div className="w-10 h-10 rounded-lg bg-secondary text-on-secondary flex items-center justify-center">
<span className="material-symbols-outlined text-[24px]">anchor</span>
</div>
<div>
<h3 className="font-headline-sm text-headline-sm text-primary">Mediterranean Dry-Dock Standard</h3>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">Environmental &amp; Naval Compliance</span>
</div>
</div>
<ul className="flex flex-col gap-space-xs font-body-md text-body-md text-on-surface-variant">
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>EU Biocidal Products Regulation compliant antifouling applications (Jotun, International).</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>Galvanic sacrificial zinc &amp; aluminum anode mapping with electrical bond continuity checks.</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>Propspeed foul-release silicone coating on bronze props, rudders, and trim tabs.</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>Bronze and DZR through-hull ball valve ultrasound inspection and lubrication overhaul.</span>
</li>
</ul>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-space-xl">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold mb-space-xs">Engineered Competence</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          What the Marine Maintenance Service Includes
        </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
          Comprehensive mechanical, propulsion, and auxiliary support executed by certified shipyard marine engineers across Spain and Italy.
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">settings_suggest</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              Diesel Engine Overhaul &amp; Servicing
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Scheduled 250h, 500h, and 1,000h service intervals. High-pressure common rail fuel injector calibration, valve lash clearance adjustment, water pump impeller replacement, and complete bench teardown overhauls for Volvo Penta, MAN, MTU, Caterpillar, and Yanmar.
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            OEM Diagnostics · Genuine Filters · Factory Seals
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">speed</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              Propulsion, Pod Drives &amp; Running Gear
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Specialized Volvo IPS and Cummins Zeus steerable drive maintenance, pod clutch recalibration, lower unit synthetic oil replacement, laser shaft optical alignment, cutless bearing extraction, dynamic propeller balancing, and PSS dripless shaft seal installation.
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            Vibration Analysis · Pod Seal Kits · Shaft Alignment
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">bolt</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              Marine Generators &amp; Electrical Systems
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Auxiliary genset maintenance for Onan, Fischer Panda, Kohler, and Northern Lights. 24V / 230V / 400V electrical load balancing, Mastervolt and Victron Energy lithium battery conversion, pure sine wave inverter programming, and galvanically isolated shore power synchronisation.
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            Genset Overhaul · LiFePO4 Upgrades · Isolation Transformers
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">water_drop</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              Watermakers, Hydraulics &amp; Steering
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              High-pressure reverse osmosis membrane servicing, chemical biocidal descaling, and high-pressure pump oil renewal for Schenker, Idromar, and Sea Recovery desalinators. Overhaul of hydraulic steering rams, hydraulic tender garages, passerelles, and proportional bow/stern thrusters.
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            Membrane Replacement · Seal Rebuilds · Thruster Gearboxes
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">ac_unit</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              Air Conditioning &amp; Marine Refrigeration
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Chilled water marine HVAC loop chemical flushing, raw water sea pump impeller renewal, air handler condensation tray treatment, and fan coil cleaning. Diagnostic leak testing and charge balancing for R410a and R134a refrigeration circuits (Dometic, Frigomar, Webasto).
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            HVAC Descaling · F-Gas Certified · Pump Rebuilds
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">file_upload_off</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              Winterisation &amp; Spring Commissioning
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Autumn preservation protocols: non-toxic propylene glycol flushing through raw water cooling circuits, fuel stabilization, anti-corrosion fogging, bilge drying, and battery float management. Pre-season spring sea trial validation, fluid analysis, and hull valve recertification.
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            Glycol Preservation · Battery Float · Sea Trials
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="mb-space-xl">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">Client Profiles</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-space-xs">
          Tailored Engineering for Demanding Maritime Operations
        </h2>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-[22px]">directions_boat</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">Private Yacht Owners</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Vessel owners who refuse compromises. Requiring factory-certified mechanics, genuine OEM spare parts, and official stamped service records to protect their investment and maximize vessel resale appraisal.
            </p>
</div>
<div className="mt-space-md pt-space-sm bg-surface-container-low p-2.5 rounded-lg text-on-surface-variant font-label-sm text-label-sm">
            Focus: Resale preservation &amp; manufacturer warranty protection.
          </div>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary mb-space-sm">
<span className="material-symbols-outlined text-[22px]">sailing</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">Commercial Charter Fleets</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              High-duty charter fleets in the Balearics and Costa Smeralda requiring rapid turnaround dockside engineering between Friday guest turnarounds and complete preventative winter shipyard overhauls.
            </p>
</div>
<div className="mt-space-md pt-space-sm bg-surface-container-low p-2.5 rounded-lg text-on-surface-variant font-label-sm text-label-sm">
            Focus: Maximum uptime &amp; expedited dockside parts dispatch.
          </div>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-[22px]">search_check</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">Pre-Purchase Buyers</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Discerning yacht purchasers requiring rigorous independent mechanical inspections: endoscopic cylinder bore analysis, cooling jacket pressure testing, oil laboratory spectrometry, and seatrial telemetry data.
            </p>
</div>
<div className="mt-space-md pt-space-sm bg-surface-container-low p-2.5 rounded-lg text-on-surface-variant font-label-sm text-label-sm">
            Focus: Unbiased pre-closing risk discovery and mechanical audit.
          </div>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded-full bg-primary-fixed-dim flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-[22px]">explore</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">Transiting Cruisers</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              International yachts transiting the Western Mediterranean facing sudden cooling alarms, fuel injector failures, or electrical generator shut-offs requiring priority berth assistance in unfamiliar foreign ports.
            </p>
</div>
<div className="mt-space-md pt-space-sm bg-surface-container-low p-2.5 rounded-lg text-on-surface-variant font-label-sm text-label-sm">
            Focus: English, Spanish &amp; Italian speaking dockside dispatch.
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mb-space-xl">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">Standard Operating Protocol</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-space-xs">
          The 4-Step Engineering Methodology
        </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
          Every repair and scheduled maintenance engagement adheres to strict naval standards from initial digital telemetry to final stamped certification.
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<div className="text-secondary font-display-hero text-headline-lg font-bold opacity-30 mb-space-xs">01</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">Diagnostic Triage &amp; Telemetry</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Remote intake of ECM fault codes, symptoms, vessel location, and service history. Technical assessment and master technician dispatch scheduled within 24 to 48 hours.
            </p>
</div>
<div className="pt-space-md mt-space-md font-label-sm text-label-sm text-primary font-semibold">
            Initial SLA: &lt; 24h Confirmation
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<div className="text-secondary font-display-hero text-headline-lg font-bold opacity-30 mb-space-xs">02</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">Dockside or Drydock Inspection</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Physical inspection onboard your mooring slip. High-resolution boroscope cylinder inspection, fluid spectrograph sampling, infrared exhaust thermal mapping, and pressure tests.
            </p>
</div>
<div className="pt-space-md mt-space-md font-label-sm text-label-sm text-primary font-semibold">
            Hardware: Certified Field Kits
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<div className="text-secondary font-display-hero text-headline-lg font-bold opacity-30 mb-space-xs">03</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">Transparent Work Order</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              A comprehensive technical quotation breaking down verified OEM spare part serials, technician labor hours, and manufacturer maintenance tolerances before work begins.
            </p>
</div>
<div className="pt-space-md mt-space-md font-label-sm text-label-sm text-primary font-semibold">
            Pricing: Itemized Fixed Quotation
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<div className="text-secondary font-display-hero text-headline-lg font-bold opacity-30 mb-space-xs">04</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">Sea Trials &amp; Certification</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Full-load sea trials validating manifold temperatures, boost pressure curves, and vibration frequencies. Formal signed logbook certification and Nauta digital service ledger update.
            </p>
</div>
<div className="pt-space-md mt-space-md font-label-sm text-label-sm text-secondary font-semibold">
            Outcome: Stamped Naval Logbook
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-md">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<span className="font-label-sm text-label-sm text-on-surface-variant tracking-widest uppercase font-semibold">ADVERTISEMENT</span>
<h4 className="font-headline-sm text-headline-sm text-primary font-display-hero">Marina Barcelona 92 Specialist Fabrication &amp; Machining</h4>
<p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Custom precision lathe machining, titanium exhaust custom piping, and tailored propeller shafts for luxury yachts and commercial vessels up to 70m.
          </p>
</div>
<Link href="/services/professionals/" className="inline-flex items-center gap-space-xs bg-surface-container-lowest hover:bg-surface text-primary px-space-md py-2.5 rounded font-body-md text-body-md font-semibold shrink-0 shadow-sm transition-colors" >
<span>Visit Partner Facility</span>
<span className="material-symbols-outlined text-[18px]">north_east</span>
</Link>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">

<div className="lg:col-span-6 bg-surface-container-lowest p-space-xl rounded-xl shadow-md flex flex-col justify-between">
<div>
<div className="flex items-center gap-space-xs text-secondary font-label-md text-label-md uppercase tracking-wider mb-space-xs">
<span className="material-symbols-outlined text-[18px]">fact_check</span>
<span>Intake Requirements</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-md">
              Information Required for Service Scheduling
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-lg">
              To expedite diagnostic triage and ensure technician dispatch with correct OEM tooling and filters, please have the following vessel specifications ready:
            </p>
<ul className="flex flex-col gap-space-md">
<li className="flex items-start gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">1</span>
<div>
<strong className="font-title-md text-title-md text-primary block">Engine Brand, Model &amp; Serial Numbers</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">e.g. Twin Volvo Penta D13-900 / IPS 1200 or MAN V12-1900 with serial nameplates.</span>
</div>
</li>
<li className="flex items-start gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">2</span>
<div>
<strong className="font-title-md text-title-md text-primary block">Current Operating Hours</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">Separate meter readings for Port engine, Starboard engine, and Auxiliary Generator.</span>
</div>
</li>
<li className="flex items-start gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">3</span>
<div>
<strong className="font-title-md text-title-md text-primary block">Port of Berth &amp; Slip Access Authorization</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">Current marina, pontoon/slip number, and port captain security access arrangements.</span>
</div>
</li>
<li className="flex items-start gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">4</span>
<div>
<strong className="font-title-md text-title-md text-primary block">Logbook Service History &amp; Heat Exchanger Date</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">Date and operating hours of last raw water heat exchanger service, oil change, and impeller swap.</span>
</div>
</li>
<li className="flex items-start gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">5</span>
<div>
<strong className="font-title-md text-title-md text-primary block">Detailed Symptom or Error Code Description</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">Active digital display fault codes, vibration speeds, smoke color, or requested service tier.</span>
</div>
</li>
</ul>
</div>
<div className="mt-space-lg p-space-sm rounded-lg bg-surface-container-low text-on-surface-variant font-body-sm text-body-sm flex items-center gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[20px]">info</span>
<span>Accurate serial numbers allow mechanics to arrive with pre-ordered OEM gaskets and filters.</span>
</div>
</div>

<div className="lg:col-span-6 flex flex-col justify-between">
<div>
<div className="flex items-center gap-space-xs text-secondary font-label-md text-label-md uppercase tracking-wider mb-space-xs">
<span className="material-symbols-outlined text-[18px]">pin_drop</span>
<span>Regional Coverage</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-md">
              Shipyard &amp; Mobile Technical Hubs
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-lg">
              Authorized mobile service vans and partner shipyard facilities operating continuously along the Spanish and Italian coastlines:
            </p>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">Palma de Mallorca &amp; Port Adriano</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">Balearic Marine Engineering Desk</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">Full shipyard haul-out up to 80m, official Volvo Penta Center, MTU marine support.</p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">Barcelona &amp; Marina Port Vell</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">Catalan Shipyard Services</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">Superyacht refit basin, Caterpillar authorized diagnostics, metal fabrication facilities.</p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">Valencia &amp; Dénia</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">Levante Marine Technical Hub</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">Rapid ferry &amp; catamaran mechanical dispatch, Yanmar and Cummins official technicians.</p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">Costa Brava &amp; Palamós</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">Northern Spanish Cluster</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">Dry storage winterisation yards, shaft alignment, through-hull valve servicing.</p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">Genoa &amp; La Spezia</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">Ligurian Marine Engineering Cluster</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">MAN and MTU authorized master workshops, heavy diesel overhaul bays, dyno testing.</p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">Naples &amp; Salerno</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">Tyrrhenian Technical Desk</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">Rapid dockside van dispatch covering Amalfi, Capri, Ischia, and Gulf of Naples marinas.</p>
</div>
</div>
</div>
<div className="mt-space-md p-space-md rounded-xl bg-primary text-on-primary flex items-center justify-between shadow-sm">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary-fixed text-[28px]">support_agent</span>
<div>
<span className="font-title-md text-title-md text-on-primary block">Urgent Dockside Dispatch Needed?</span>
<span className="font-body-sm text-body-sm text-on-primary-container">Spanish &amp; Italian technical hotlines open 08:00 - 20:00 CET</span>
</div>
</div>
<Link href="/contact/" className="bg-surface text-primary px-space-md py-2 rounded font-body-sm text-body-sm font-semibold hover:bg-surface-container-low transition-colors shrink-0" >Contact Desk</Link>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl" id="request-service">
<div className="max-w-[1000px] mx-auto px-margin-mobile md:px-margin">
<div className="bg-surface-container-lowest p-space-lg md:p-space-2xl rounded-2xl shadow-xl">
<div className="text-center max-w-2xl mx-auto mb-space-xl">
<div className="inline-flex items-center gap-space-xs text-secondary font-label-md text-label-md uppercase tracking-wider mb-space-xs">
<span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
<span>Direct Shipyard Intake</span>
</div>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
            Request Marine Maintenance or Repair
          </h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
            Connect with certified master mechanics and authorized marine shipyard engineers in your port. We review telemetry details within 24 hours.
          </p>
</div>
<form className="flex flex-col gap-space-md">

<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="full-name">Full Name *</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="full-name" placeholder="Captain / Owner Name" required type="text"/>
</div>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="email">Email Address *</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="email" placeholder="e.g. captain@vessel.com" required type="email"/>
</div>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="phone">Phone (with Country Code) *</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="phone" placeholder="+34 600 000 000 / +39 340..." required type="tel"/>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="vessel-location">Vessel Location (Port/Marina) *</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="vessel-location" placeholder="e.g. Marina Ibiza, Slip 42" required type="text"/>
</div>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="engine-model">Engine Brand &amp; Model *</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="engine-model" placeholder="e.g. Twin Volvo IPS 600" required type="text"/>
</div>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="engine-hours">Current Operating Hours</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="engine-hours" placeholder="e.g. Port: 640h / Stbd: 642h" type="text"/>
</div>
</div>

<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="service-category">Service Category *</label>
<select className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="service-category" required>
<option disabled  value="">Select service tier or technical requirement...</option>
<option value="scheduled">Scheduled Maintenance (250h / 500h / Annual Service)</option>
<option value="propulsion">Propulsion, Pod Drives &amp; Running Gear (IPS, Shafts, Cutless Bearings)</option>
<option value="cooling">Raw Water Heat Exchangers &amp; Descaling</option>
<option value="electrical">Auxiliary Generators &amp; Marine Electrical</option>
<option value="winterisation">Winterisation / Spring Sea-Trial Commissioning</option>
<option value="pre-purchase">Pre-Purchase Mechanical Engine Survey</option>
<option value="urgent">Urgent Dockside Mechanical Repair / Breakdown</option>
</select>
</div>

<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="work-description">Detailed Description of Work or Fault Codes *</label>
<textarea className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="work-description" placeholder="Provide symptom details, ECM alarm codes, recent service history, or target completion dates..." required rows={4}></textarea>
</div>

<div className="p-space-md rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container transition-colors shadow-sm">
<span className="material-symbols-outlined text-secondary text-[32px] mb-space-xs">upload_file</span>
<span className="font-title-md text-title-md text-primary font-semibold">Upload engine photos, error codes or logs</span>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">PDF, JPG, PNG or diagnostic CSV up to 25MB</span>
</div>

<div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-space-sm">
<div className="flex flex-col font-body-sm text-body-sm text-on-surface-variant">
<span className="font-medium text-primary">Direct Technical Engineering Helplines:</span>
<span>Palma: <strong className="text-secondary font-semibold">+34 971 00 24 10</strong> · Genoa: <strong className="text-secondary font-semibold">+39 010 89 32 40</strong></span>
</div>
<button className="w-full sm:w-auto bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md px-space-xl py-3.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-space-xs" type="submit">
<span>Request certified engineering service</span>
<span className="material-symbols-outlined text-[20px]">send</span>
</button>
</div>
</form>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1000px] mx-auto px-margin-mobile md:px-margin">
<div className="text-center mb-space-xl">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">Technical Queries</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-space-xs">
          Frequently Asked Questions
        </h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
          Essential insights into naval maintenance practices across Mediterranean yachting waters.
        </p>
</div>
<div className="flex flex-col gap-space-md" id="faq-accordion">

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-lg text-title-lg text-primary font-semibold hover:text-secondary transition-colors" type="button">
<span>Why is OEM-certified maintenance critical for Mediterranean yacht resale value?</span>
<span className="material-symbols-outlined text-secondary text-[24px] transform transition-transform">expand_more</span>
</button>
<div className="px-space-md pb-space-md font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Prospective yacht buyers and accredited international marine surveyors (such as YDSA or IIMS) demand stamped official manufacturer logbooks. Non-OEM interventions, counterfeit filtration elements, or undocumented overhauls can diminish a vessel&apos;s market value by 10% to 25% and trigger extensive conditional surveys or buyer renegotiations before closing.
          </div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-lg text-title-lg text-primary font-semibold hover:text-secondary transition-colors" type="button">
<span>How often should marine heat exchangers and raw-water coolers be descaled in Mediterranean waters?</span>
<span className="material-symbols-outlined text-secondary text-[24px] transform transition-transform">expand_more</span>
</button>
<div className="px-space-md pb-space-md font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Due to the higher summer water temperatures and increased salinity of the Mediterranean basin (salinity ~38 PSU compared to 35 PSU in the Atlantic), raw-water tube bundles experience rapid calcium calcification. We recommend biochemical ultrasonic or circulating descaling every 400 to 500 operating hours or at least every 24 months, accompanied by full zinc sacrificial anode replacements.
          </div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-lg text-title-lg text-primary font-semibold hover:text-secondary transition-colors" type="button">
<span>Can certified mechanics perform dockside servicing without hauling the vessel out of the water?</span>
<span className="material-symbols-outlined text-secondary text-[24px] transform transition-transform">expand_more</span>
</button>
<div className="px-space-md pb-space-md font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Yes. Routine servicing (fluid exchanges, fuel filtration, turbocharger inspections, valve lash adjustments, electronic sensor calibration, generator servicing, and air conditioning loop flushes) is routinely performed in your home marina berth. Complete pod drive removals, shaft cutless bearing pressings, and hull through-valve replacements require haul-out at one of our partner shipyards.
          </div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-lg text-title-lg text-primary font-semibold hover:text-secondary transition-colors" type="button">
<span>What diagnostic procedures are performed during a pre-purchase marine engine survey?</span>
<span className="material-symbols-outlined text-secondary text-[24px] transform transition-transform">expand_more</span>
</button>
<div className="px-space-md pb-space-md font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Our pre-purchase mechanical survey includes cold ECM diagnostics, endoscopic boroscope cylinder bore inspections, laboratory spectrographic oil analysis (testing for iron, copper, chromium, sodium, and fuel dilution), cooling system pressure integrity testing, and a 45-minute continuous sea trial recording wide-open-throttle (WOT) manifold boost pressures and crankcase blow-by.
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col sm:flex-row sm:items-end justify-between mb-space-xl gap-space-sm">
<div>
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">Integrated Brokerage Ecosystem</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-space-xs">
            Related Nautical Services
          </h2>
</div>
<Link href="/services/professionals/" className="font-title-md text-title-md text-secondary hover:underline flex items-center gap-space-xs" >
<span>View all maritime services</span>
<span className="material-symbols-outlined text-[18px]">east</span>
</Link>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">

<Link href="/services/professionals/" className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between" >
<div className="relative h-52 bg-primary overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/c5d7c9c3a7.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
<div className="absolute bottom-3 left-4 text-on-primary">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed font-semibold">Logistics</span>
<h3 className="font-headline-sm text-headline-sm text-on-primary">Transport &amp; Delivery</h3>
</div>
</div>
<div className="p-space-md flex flex-col justify-between flex-grow">
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              Skippered coastal deliveries across the Western Mediterranean and international semi-submersible yacht carrier logistics.
            </p>
<div className="flex items-center text-secondary font-title-md text-title-md gap-space-xs">
<span>Learn more</span>
<span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
</div>
</div>
</Link>

<Link href="/services/professionals/" className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between" >
<div className="relative h-52 bg-primary overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/87e9f1fad5.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
<div className="absolute bottom-3 left-4 text-on-primary">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed font-semibold">Risk Protection</span>
<h3 className="font-headline-sm text-headline-sm text-on-primary">Yacht Insurance</h3>
</div>
</div>
<div className="p-space-md flex flex-col justify-between flex-grow">
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              Bespoke marine hull and machinery policies, P&amp;I liability underwriting, and certified agreed-value yacht cover.
            </p>
<div className="flex items-center text-secondary font-title-md text-title-md gap-space-xs">
<span>Learn more</span>
<span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
</div>
</div>
</Link>

<Link href="/services/professionals/" className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between" >
<div className="relative h-52 bg-primary overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/c7c7a91759.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
<div className="absolute bottom-3 left-4 text-on-primary">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed font-semibold">Maritime Jurisprudence</span>
<h3 className="font-headline-sm text-headline-sm text-on-primary">Nautical Legal Services</h3>
</div>
</div>
<div className="p-space-md flex flex-col justify-between flex-grow">
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              Cross-border Spanish matriculation tax (IEDMT), Italian VAT structuring, and vessel sales contract review.
            </p>
<div className="flex items-center text-secondary font-title-md text-title-md gap-space-xs">
<span>Learn more</span>
<span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
</div>
</div>
</Link>
</div>
</div>
</section>

<section className="w-full bg-primary text-on-primary py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col lg:flex-row items-center justify-between gap-space-xl text-center lg:text-left">
<div className="max-w-2xl">
<span className="font-label-md text-label-md text-secondary-fixed uppercase tracking-widest font-semibold block mb-space-xs">Engineering Readiness</span>
<h2 className="font-headline-lg text-headline-lg text-on-primary tracking-tight">
            Keep your vessel performing at peak reliability
          </h2>
<p className="font-body-lg text-body-lg text-on-primary-container mt-space-xs">
            From scheduled seasonal diagnostics to complex diesel propulsion overhauls across Spain and Italy.
          </p>
</div>
<div className="flex flex-wrap items-center justify-center gap-space-md shrink-0">
<Link href="/services/professionals/" className="bg-surface text-primary hover:bg-surface-container-low px-space-xl py-3.5 rounded-lg font-title-md text-title-md shadow-md transition-colors" >
            Request technical service
          </Link>
<Link href="/services/professionals/" className="bg-primary-container hover:bg-primary text-on-primary px-space-xl py-3.5 rounded-lg font-title-md text-title-md transition-colors" >
            All nautical services
          </Link>
</div>
</div>
</div>
</section>


</div>
    </main>
  );
}
