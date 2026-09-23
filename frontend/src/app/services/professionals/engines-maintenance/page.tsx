import { getT } from "@/i18n/server";
import Link from "@/components/layout/LocaleLink";

export default async function EnginesMaintenance() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="w-full bg-surface-container-low py-space-sm shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex items-center justify-between">

<nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
<Link href="/" className="hover:text-primary transition-colors" >{t("svc_engines.home")}</Link>
<span className="text-outline-variant font-label-sm">/</span>
<Link href="/services/professionals/" className="hover:text-primary transition-colors" >{t("svc_engines.services")}</Link>
<span className="text-outline-variant font-label-sm">/</span>
<span className="text-primary font-medium">{t("svc_engines.engines_maintenance")}</span>
</nav>

<div className="flex items-center gap-space-xs">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider hidden sm:inline">{t("svc_engines.language")}</span>
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
<span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold">{t("svc_engines.certified_marine_engineering_network")}</span>
</div>
<h1 className="font-display-hero text-headline-lg lg:text-display-hero text-primary tracking-tight">
            {t("svc_engines.marine_engine_repair_maintenance_and_yacht")}
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
            {t("svc_engines.certified_shipyard_overhauls_diesel_propulsion_diagnostics")}
          </p>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm pt-space-xs">
<div className="flex items-center gap-space-xs p-space-sm rounded-lg bg-surface-container shadow-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">engineering</span>
<span className="font-body-sm text-body-sm text-primary font-medium">{t("svc_engines.volvo_penta_man_mtu_yanmar")}</span>
</div>
<div className="flex items-center gap-space-xs p-space-sm rounded-lg bg-surface-container shadow-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">military_tech</span>
<span className="font-body-sm text-body-sm text-primary font-medium">{t("svc_engines.licensed_naval_mechanics")}</span>
</div>
<div className="flex items-center gap-space-xs p-space-sm rounded-lg bg-surface-container shadow-sm">
<span className="material-symbols-outlined text-secondary text-[20px]">fmd_good</span>
<span className="font-body-sm text-body-sm text-primary font-medium">{t("svc_engines.rapid_dockside_dispatch")}</span>
</div>
</div>

<div className="flex flex-wrap items-center gap-space-md pt-space-sm">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container px-space-lg py-3 rounded-lg font-title-md text-title-md shadow-md transition-colors gap-space-xs" >
<span>{t("svc_engines.request_technical_service")}</span>
<span className="material-symbols-outlined text-[20px]">arrow_downward</span>
</Link>
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-surface-container-high hover:bg-surface-container-highest text-primary px-space-lg py-3 rounded-lg font-title-md text-title-md transition-colors gap-space-xs" >
<span>{t("svc_engines.explore_service_scope")}</span>
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
<span className="font-label-sm text-label-sm text-on-primary font-semibold tracking-wide">{t("svc_engines.active_harbor_technical_hubs")}</span>
</div>
<p className="font-title-md text-title-md text-on-primary">
                {t("svc_engines.certified_shipyard_network_palma_barcelona_genoa")}
              </p>
<div className="flex items-center justify-between text-on-primary-container font-body-sm text-body-sm pt-space-xs">
<span>Standard SLA: &lt; 24h Telemetry Triage</span>
<span className="text-secondary-fixed font-spec-num text-spec-num">{t("svc_engines.iso_9001_2015_marine")}</span>
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
<span>{t("svc_engines.naval_heritage_mediterranean_context")}</span>
</div>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
            {t("svc_engines.precision_marine_engineering_propulsion_reliability")}
          </h2>
<div className="font-body-lg text-body-lg text-on-surface-variant flex flex-col gap-space-md leading-relaxed">
<p>
              The Mediterranean and Tyrrhenian basins present some of the most aggressive marine operational environments on earth. Elevated water temperatures and heightened salinity levels accelerate galvanic electrolysis, scale calcification inside raw water heat exchangers, and biological fouling on running gear. Operating high-output marine diesel engines under sustained cruising RPM without strict preventative calibration guarantees premature failure and exorbitant downtime.
            </p>
<p>
              Nautelo coordinates certified naval master technicians and authorized engine specialists who understand these exact regional realities. From systematic descaling of charge-air coolers and turbocharger intercoolers using non-destructive biochemical flushes to micrometer-level drive shaft realignment and Volvo Penta IPS / Cummins Zeus pod recalibrations, every intervention is performed to original equipment manufacturer (OEM) tolerances.
            </p>
<p>
              {t("svc_engines.our_engineers_ensure_that_logbooks_are")}
            </p>
</div>

<div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm pt-space-sm">
<div className="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">{t("svc_engines.cooling_flush")}</span>
<span className="block font-title-lg text-title-lg text-primary font-bold mt-1">400 h</span>
<span className="block font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.recommended_cycle")}</span>
</div>
<div className="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">{t("svc_engines.fluid_lab_test")}</span>
<span className="block font-title-lg text-title-lg text-primary font-bold mt-1">{t("svc_engines.astm")}</span>
<span className="block font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.spectrographic_standard")}</span>
</div>
<div className="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">{t("svc_engines.shaft_tolerance")}</span>
<span className="block font-title-lg text-title-lg text-primary font-bold mt-1">{t("svc_engines.0_05_mm")}</span>
<span className="block font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.laser_precision_align")}</span>
</div>
<div className="bg-surface-container-lowest p-space-sm rounded-lg shadow-sm">
<span className="block font-label-sm text-label-sm text-on-surface-variant uppercase">{t("svc_engines.warranty_log")}</span>
<span className="block font-title-lg text-title-lg text-primary font-bold mt-1">100%</span>
<span className="block font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.oem_certified_entry")}</span>
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
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_engines.authorized_diagnostic_protocol")}</h3>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">{t("svc_engines.oem_proprietary_tooling")}</span>
</div>
</div>
<ul className="flex flex-col gap-space-xs font-body-md text-body-md text-on-surface-variant">
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>{t("svc_engines.direct_electronic_ecm_diagnostics_for_volvo")}</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>Common-rail fuel injection pressure balancing and flow return rate measurement.</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>{t("svc_engines.spectrographic_oil_lab_analysis_for_wear")}</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>{t("svc_engines.turbocharger_boost_pressure_validation_and_turbine")}</span>
</li>
</ul>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md">
<div className="flex items-center gap-space-sm mb-space-sm">
<div className="w-10 h-10 rounded-lg bg-secondary text-on-secondary flex items-center justify-center">
<span className="material-symbols-outlined text-[24px]">anchor</span>
</div>
<div>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_engines.mediterranean_dry_dock_standard")}</h3>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">{t("svc_engines.environmental_naval_compliance")}</span>
</div>
</div>
<ul className="flex flex-col gap-space-xs font-body-md text-body-md text-on-surface-variant">
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>{t("svc_engines.eu_biocidal_products_regulation_compliant_antifouling")}</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>{t("svc_engines.galvanic_sacrificial_zinc_aluminum_anode_mapping")}</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>{t("svc_engines.propspeed_foul_release_silicone_coating_on")}</span>
</li>
<li className="flex items-start gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[18px] mt-0.5">check_circle</span>
<span>{t("svc_engines.bronze_and_dzr_through_hull_ball")}</span>
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
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold mb-space-xs">{t("svc_engines.engineered_competence")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
          {t("svc_engines.what_the_marine_maintenance_service_includes")}
        </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
          {t("svc_engines.comprehensive_mechanical_propulsion_and_auxiliary_support")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">settings_suggest</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              {t("svc_engines.diesel_engine_overhaul_servicing")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_engines.scheduled_250h_500h_and_1_000h")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            {t("svc_engines.oem_diagnostics_genuine_filters_factory_seals")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">speed</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              {t("svc_engines.propulsion_pod_drives_running_gear")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_engines.specialized_volvo_ips_and_cummins_zeus")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            {t("svc_engines.vibration_analysis_pod_seal_kits_shaft")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">bolt</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              {t("svc_engines.marine_generators_electrical_systems")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_engines.auxiliary_genset_maintenance_for_onan_fischer")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            {t("svc_engines.genset_overhaul_lifepo4_upgrades_isolation_transformers")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">water_drop</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              {t("svc_engines.watermakers_hydraulics_steering")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_engines.high_pressure_reverse_osmosis_membrane_servicing")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            {t("svc_engines.membrane_replacement_seal_rebuilds_thruster_gearboxes")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">ac_unit</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              {t("svc_engines.air_conditioning_marine_refrigeration")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_engines.chilled_water_marine_hvac_loop_chemical")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            {t("svc_engines.hvac_descaling_f_gas_certified_pump")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[28px]">file_upload_off</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
              {t("svc_engines.winterisation_spring_commissioning")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_engines.autumn_preservation_protocols_non_toxic_propylene")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
            {t("svc_engines.glycol_preservation_battery_float_sea_trials")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="mb-space-xl">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_engines.client_profiles")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-space-xs">
          {t("svc_engines.tailored_engineering_for_demanding_maritime_operations")}
        </h2>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-[22px]">directions_boat</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_engines.private_yacht_owners")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_engines.vessel_owners_who_refuse_compromises_requiring")}
            </p>
</div>
<div className="mt-space-md pt-space-sm bg-surface-container-low p-2.5 rounded-lg text-on-surface-variant font-label-sm text-label-sm">
            {t("svc_engines.focus_resale_preservation_manufacturer_warranty_protection")}
          </div>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary mb-space-sm">
<span className="material-symbols-outlined text-[22px]">sailing</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_engines.commercial_charter_fleets")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_engines.high_duty_charter_fleets_in_the")}
            </p>
</div>
<div className="mt-space-md pt-space-sm bg-surface-container-low p-2.5 rounded-lg text-on-surface-variant font-label-sm text-label-sm">
            {t("svc_engines.focus_maximum_uptime_expedited_dockside_parts")}
          </div>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-[22px]">search_check</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_engines.pre_purchase_buyers")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_engines.discerning_yacht_purchasers_requiring_rigorous_independent")}
            </p>
</div>
<div className="mt-space-md pt-space-sm bg-surface-container-low p-2.5 rounded-lg text-on-surface-variant font-label-sm text-label-sm">
            {t("svc_engines.focus_unbiased_pre_closing_risk_discovery")}
          </div>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded-full bg-primary-fixed-dim flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-[22px]">explore</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_engines.transiting_cruisers")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_engines.international_yachts_transiting_the_western_mediterranean")}
            </p>
</div>
<div className="mt-space-md pt-space-sm bg-surface-container-low p-2.5 rounded-lg text-on-surface-variant font-label-sm text-label-sm">
            {t("svc_engines.focus_english_spanish_italian_speaking_dockside")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mb-space-xl">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_engines.standard_operating_protocol")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-space-xs">
          {t("svc_engines.the_4_step_engineering_methodology")}
        </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
          {t("svc_engines.every_repair_and_scheduled_maintenance_engagement")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<div className="text-secondary font-display-hero text-headline-lg font-bold opacity-30 mb-space-xs">01</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">{t("svc_engines.diagnostic_triage_telemetry")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_engines.remote_intake_of_ecm_fault_codes")}
            </p>
</div>
<div className="pt-space-md mt-space-md font-label-sm text-label-sm text-primary font-semibold">
            Initial SLA: &lt; 24h Confirmation
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<div className="text-secondary font-display-hero text-headline-lg font-bold opacity-30 mb-space-xs">02</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">{t("svc_engines.dockside_or_drydock_inspection")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_engines.physical_inspection_onboard_your_mooring_slip")}
            </p>
</div>
<div className="pt-space-md mt-space-md font-label-sm text-label-sm text-primary font-semibold">
            {t("svc_engines.hardware_certified_field_kits")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<div className="text-secondary font-display-hero text-headline-lg font-bold opacity-30 mb-space-xs">03</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">{t("svc_engines.transparent_work_order")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_engines.a_comprehensive_technical_quotation_breaking_down")}
            </p>
</div>
<div className="pt-space-md mt-space-md font-label-sm text-label-sm text-primary font-semibold">
            {t("svc_engines.pricing_itemized_fixed_quotation")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<div className="text-secondary font-display-hero text-headline-lg font-bold opacity-30 mb-space-xs">04</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs">{t("svc_engines.sea_trials_certification")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_engines.full_load_sea_trials_validating_manifold")}
            </p>
</div>
<div className="pt-space-md mt-space-md font-label-sm text-label-sm text-secondary font-semibold">
            {t("svc_engines.outcome_stamped_naval_logbook")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-md">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-low p-space-lg rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<span className="font-label-sm text-label-sm text-on-surface-variant tracking-widest uppercase font-semibold">{t("svc_engines.advertisement")}</span>
<h4 className="font-headline-sm text-headline-sm text-primary font-display-hero">{t("svc_engines.marina_barcelona_92_specialist_fabrication_machining")}</h4>
<p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            {t("svc_engines.custom_precision_lathe_machining_titanium_exhaust")}
          </p>
</div>
<Link href="/services/professionals/" className="inline-flex items-center gap-space-xs bg-surface-container-lowest hover:bg-surface text-primary px-space-md py-2.5 rounded font-body-md text-body-md font-semibold shrink-0 shadow-sm transition-colors" >
<span>{t("svc_engines.visit_partner_facility")}</span>
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
<span>{t("svc_engines.intake_requirements")}</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-md">
              {t("svc_engines.information_required_for_service_scheduling")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-lg">
              {t("svc_engines.to_expedite_diagnostic_triage_and_ensure")}
            </p>
<ul className="flex flex-col gap-space-md">
<li className="flex items-start gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">1</span>
<div>
<strong className="font-title-md text-title-md text-primary block">{t("svc_engines.engine_brand_model_serial_numbers")}</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.e_g_twin_volvo_penta_d13")}</span>
</div>
</li>
<li className="flex items-start gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">2</span>
<div>
<strong className="font-title-md text-title-md text-primary block">{t("svc_engines.current_operating_hours")}</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.separate_meter_readings_for_port_engine")}</span>
</div>
</li>
<li className="flex items-start gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">3</span>
<div>
<strong className="font-title-md text-title-md text-primary block">{t("svc_engines.port_of_berth_slip_access_authorization")}</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.current_marina_pontoon_slip_number_and")}</span>
</div>
</li>
<li className="flex items-start gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">4</span>
<div>
<strong className="font-title-md text-title-md text-primary block">{t("svc_engines.logbook_service_history_heat_exchanger_date")}</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.date_and_operating_hours_of_last")}</span>
</div>
</li>
<li className="flex items-start gap-space-sm">
<span className="w-6 h-6 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-[12px] shrink-0 mt-0.5">5</span>
<div>
<strong className="font-title-md text-title-md text-primary block">{t("svc_engines.detailed_symptom_or_error_code_description")}</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.active_digital_display_fault_codes_vibration")}</span>
</div>
</li>
</ul>
</div>
<div className="mt-space-lg p-space-sm rounded-lg bg-surface-container-low text-on-surface-variant font-body-sm text-body-sm flex items-center gap-space-xs">
<span className="material-symbols-outlined text-secondary text-[20px]">info</span>
<span>{t("svc_engines.accurate_serial_numbers_allow_mechanics_to")}</span>
</div>
</div>

<div className="lg:col-span-6 flex flex-col justify-between">
<div>
<div className="flex items-center gap-space-xs text-secondary font-label-md text-label-md uppercase tracking-wider mb-space-xs">
<span className="material-symbols-outlined text-[18px]">pin_drop</span>
<span>{t("svc_engines.regional_coverage")}</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-md">
              {t("svc_engines.shipyard_mobile_technical_hubs")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-lg">
              {t("svc_engines.authorized_mobile_service_vans_and_partner")}
            </p>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">{t("svc_engines.palma_de_mallorca_port_adriano")}</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_engines.balearic_marine_engineering_desk")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.full_shipyard_haul_out_up_to")}</p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">{t("svc_engines.barcelona_marina_port_vell")}</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_engines.catalan_shipyard_services")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.superyacht_refit_basin_caterpillar_authorized_diagnostics")}</p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">{t("svc_engines.valencia_denia")}</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_engines.levante_marine_technical_hub")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.rapid_ferry_catamaran_mechanical_dispatch_yanmar")}</p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">{t("svc_engines.costa_brava_palamos")}</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_engines.northern_spanish_cluster")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.dry_storage_winterisation_yards_shaft_alignment")}</p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">{t("svc_engines.genoa_la_spezia")}</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_engines.ligurian_marine_engineering_cluster")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.man_and_mtu_authorized_master_workshops")}</p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center justify-between mb-1">
<h4 className="font-title-md text-title-md text-primary">{t("svc_engines.naples_salerno")}</h4>
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_engines.tyrrhenian_technical_desk")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_engines.rapid_dockside_van_dispatch_covering_amalfi")}</p>
</div>
</div>
</div>
<div className="mt-space-md p-space-md rounded-xl bg-primary text-on-primary flex items-center justify-between shadow-sm">
<div className="flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary-fixed text-[28px]">support_agent</span>
<div>
<span className="font-title-md text-title-md text-on-primary block">{t("svc_engines.urgent_dockside_dispatch_needed")}</span>
<span className="font-body-sm text-body-sm text-on-primary-container">{t("svc_engines.spanish_italian_technical_hotlines_open_08")}</span>
</div>
</div>
<Link href="/contact/" className="bg-surface text-primary px-space-md py-2 rounded font-body-sm text-body-sm font-semibold hover:bg-surface-container-low transition-colors shrink-0" >{t("svc_engines.contact_desk")}</Link>
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
<span>{t("svc_engines.direct_shipyard_intake")}</span>
</div>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">
            {t("svc_engines.request_marine_maintenance_or_repair")}
          </h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
            {t("svc_engines.connect_with_certified_master_mechanics_and")}
          </p>
</div>
<form className="flex flex-col gap-space-md">

<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="full-name">{t("svc_engines.full_name")}</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="full-name" placeholder="Captain / Owner Name" required type="text"/>
</div>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="email">{t("svc_engines.email_address")}</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="email" placeholder="e.g. captain@vessel.com" required type="email"/>
</div>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="phone">{t("svc_engines.phone_with_country_code")}</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="phone" placeholder="+34 600 000 000 / +39 340..." required type="tel"/>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="vessel-location">{t("svc_engines.vessel_location_port_marina")}</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="vessel-location" placeholder="e.g. Marina Ibiza, Slip 42" required type="text"/>
</div>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="engine-model">{t("svc_engines.engine_brand_model")}</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="engine-model" placeholder="e.g. Twin Volvo IPS 600" required type="text"/>
</div>
<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="engine-hours">{t("svc_engines.current_operating_hours")}</label>
<input className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="engine-hours" placeholder="e.g. Port: 640h / Stbd: 642h" type="text"/>
</div>
</div>

<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="service-category">{t("svc_engines.service_category")}</label>
<select className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="service-category" required>
<option disabled  value="">{t("svc_engines.select_service_tier_or_technical_requirement")}</option>
<option value="scheduled">{t("svc_engines.scheduled_maintenance_250h_500h_annual_service")}</option>
<option value="propulsion">{t("svc_engines.propulsion_pod_drives_running_gear_ips")}</option>
<option value="cooling">{t("svc_engines.raw_water_heat_exchangers_descaling")}</option>
<option value="electrical">{t("svc_engines.auxiliary_generators_marine_electrical")}</option>
<option value="winterisation">{t("svc_engines.winterisation_spring_sea_trial_commissioning")}</option>
<option value="pre-purchase">{t("svc_engines.pre_purchase_mechanical_engine_survey")}</option>
<option value="urgent">{t("svc_engines.urgent_dockside_mechanical_repair_breakdown")}</option>
</select>
</div>

<div className="flex flex-col gap-space-xs">
<label className="font-label-md text-label-md text-primary font-medium" htmlFor="work-description">{t("svc_engines.detailed_description_of_work_or_fault")}</label>
<textarea className="w-full bg-surface-container-low p-3 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner" id="work-description" placeholder="Provide symptom details, ECM alarm codes, recent service history, or target completion dates..." required rows={4}></textarea>
</div>

<div className="p-space-md rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container transition-colors shadow-sm">
<span className="material-symbols-outlined text-secondary text-[32px] mb-space-xs">upload_file</span>
<span className="font-title-md text-title-md text-primary font-semibold">{t("svc_engines.upload_engine_photos_error_codes_or")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">{t("svc_engines.pdf_jpg_png_or_diagnostic_csv")}</span>
</div>

<div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-space-sm">
<div className="flex flex-col font-body-sm text-body-sm text-on-surface-variant">
<span className="font-medium text-primary">{t("svc_engines.direct_technical_engineering_helplines")}</span>
<span>{t("svc_engines.palma")} <strong className="text-secondary font-semibold">+34 971 00 24 10</strong> {t("svc_engines.genoa")} <strong className="text-secondary font-semibold">+39 010 89 32 40</strong></span>
</div>
<button className="w-full sm:w-auto bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md px-space-xl py-3.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-space-xs" type="submit">
<span>{t("svc_engines.request_certified_engineering_service")}</span>
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
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_engines.technical_queries")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-space-xs">
          {t("svc_engines.frequently_asked_questions")}
        </h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
          {t("svc_engines.essential_insights_into_naval_maintenance_practices")}
        </p>
</div>
<div className="flex flex-col gap-space-md" id="faq-accordion">

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-lg text-title-lg text-primary font-semibold hover:text-secondary transition-colors" type="button">
<span>{t("svc_engines.why_is_oem_certified_maintenance_critical")}</span>
<span className="material-symbols-outlined text-secondary text-[24px] transform transition-transform">expand_more</span>
</button>
<div className="px-space-md pb-space-md font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {t("svc_engines.prospective_yacht_buyers_and_accredited_international")}
          </div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-lg text-title-lg text-primary font-semibold hover:text-secondary transition-colors" type="button">
<span>{t("svc_engines.how_often_should_marine_heat_exchangers")}</span>
<span className="material-symbols-outlined text-secondary text-[24px] transform transition-transform">expand_more</span>
</button>
<div className="px-space-md pb-space-md font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {t("svc_engines.due_to_the_higher_summer_water")}
          </div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-lg text-title-lg text-primary font-semibold hover:text-secondary transition-colors" type="button">
<span>{t("svc_engines.can_certified_mechanics_perform_dockside_servicing")}</span>
<span className="material-symbols-outlined text-secondary text-[24px] transform transition-transform">expand_more</span>
</button>
<div className="px-space-md pb-space-md font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {t("svc_engines.yes_routine_servicing_fluid_exchanges_fuel")}
          </div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-lg text-title-lg text-primary font-semibold hover:text-secondary transition-colors" type="button">
<span>{t("svc_engines.what_diagnostic_procedures_are_performed_during")}</span>
<span className="material-symbols-outlined text-secondary text-[24px] transform transition-transform">expand_more</span>
</button>
<div className="px-space-md pb-space-md font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {t("svc_engines.our_pre_purchase_mechanical_survey_includes")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col sm:flex-row sm:items-end justify-between mb-space-xl gap-space-sm">
<div>
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_engines.integrated_brokerage_ecosystem")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-space-xs">
            {t("svc_engines.related_nautical_services")}
          </h2>
</div>
<Link href="/services/professionals/" className="font-title-md text-title-md text-secondary hover:underline flex items-center gap-space-xs" >
<span>{t("svc_engines.view_all_maritime_services")}</span>
<span className="material-symbols-outlined text-[18px]">east</span>
</Link>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">

<Link href="/services/professionals/" className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between" >
<div className="relative h-52 bg-primary overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/c5d7c9c3a7.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
<div className="absolute bottom-3 left-4 text-on-primary">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed font-semibold">{t("svc_engines.logistics")}</span>
<h3 className="font-headline-sm text-headline-sm text-on-primary">{t("svc_engines.transport_delivery")}</h3>
</div>
</div>
<div className="p-space-md flex flex-col justify-between flex-grow">
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              {t("svc_engines.skippered_coastal_deliveries_across_the_western")}
            </p>
<div className="flex items-center text-secondary font-title-md text-title-md gap-space-xs">
<span>{t("svc_engines.learn_more")}</span>
<span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
</div>
</div>
</Link>

<Link href="/services/professionals/" className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between" >
<div className="relative h-52 bg-primary overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/87e9f1fad5.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
<div className="absolute bottom-3 left-4 text-on-primary">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed font-semibold">{t("svc_engines.risk_protection")}</span>
<h3 className="font-headline-sm text-headline-sm text-on-primary">{t("svc_engines.yacht_insurance")}</h3>
</div>
</div>
<div className="p-space-md flex flex-col justify-between flex-grow">
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              {t("svc_engines.bespoke_marine_hull_and_machinery_policies")}
            </p>
<div className="flex items-center text-secondary font-title-md text-title-md gap-space-xs">
<span>{t("svc_engines.learn_more")}</span>
<span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
</div>
</div>
</Link>

<Link href="/services/professionals/" className="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between" >
<div className="relative h-52 bg-primary overflow-hidden">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/c7c7a91759.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent"></div>
<div className="absolute bottom-3 left-4 text-on-primary">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed font-semibold">{t("svc_engines.maritime_jurisprudence")}</span>
<h3 className="font-headline-sm text-headline-sm text-on-primary">{t("svc_engines.nautical_legal_services")}</h3>
</div>
</div>
<div className="p-space-md flex flex-col justify-between flex-grow">
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              {t("svc_engines.cross_border_spanish_matriculation_tax_iedmt")}
            </p>
<div className="flex items-center text-secondary font-title-md text-title-md gap-space-xs">
<span>{t("svc_engines.learn_more")}</span>
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
<span className="font-label-md text-label-md text-secondary-fixed uppercase tracking-widest font-semibold block mb-space-xs">{t("svc_engines.engineering_readiness")}</span>
<h2 className="font-headline-lg text-headline-lg text-on-primary tracking-tight">
            {t("svc_engines.keep_your_vessel_performing_at_peak")}
          </h2>
<p className="font-body-lg text-body-lg text-on-primary-container mt-space-xs">
            {t("svc_engines.from_scheduled_seasonal_diagnostics_to_complex")}
          </p>
</div>
<div className="flex flex-wrap items-center justify-center gap-space-md shrink-0">
<Link href="/services/professionals/" className="bg-surface text-primary hover:bg-surface-container-low px-space-xl py-3.5 rounded-lg font-title-md text-title-md shadow-md transition-colors" >
            {t("svc_engines.request_technical_service")}
          </Link>
<Link href="/services/professionals/" className="bg-primary-container hover:bg-primary text-on-primary px-space-xl py-3.5 rounded-lg font-title-md text-title-md transition-colors" >
            {t("svc_engines.all_nautical_services")}
          </Link>
</div>
</div>
</div>
</section>


</div>
    </main>
  );
}
