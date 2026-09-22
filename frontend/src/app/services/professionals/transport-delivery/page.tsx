import { getT } from "@/i18n/server";
import Link from "@/components/layout/LocaleLink";

export default async function TransportDelivery() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="w-full bg-surface-container-low/60">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-sm flex flex-wrap items-center justify-between gap-space-sm">
<nav aria-label="Breadcrumbs" className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
<Link href="/" className="hover:text-primary transition-colors" >{t("svc_transport.home")}</Link>
<span className="text-outline-variant font-label-sm">/</span>
<Link href="/services/professionals/" className="hover:text-primary transition-colors" >{t("svc_transport.services")}</Link>
<span className="text-outline-variant font-label-sm">/</span>
<span className="text-on-surface font-medium">{t("svc_transport.transport_delivery")}</span>
</nav>
<div className="flex items-center gap-space-xs">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t("svc_transport.content_edition")}</span>
<div className="inline-flex items-center p-0.5 rounded-full bg-surface-container-highest font-label-md text-label-md">
<button className="px-2 py-0.5 rounded-full bg-primary text-on-primary" type="button">EN</button>
<span className="text-outline-variant px-1 font-label-sm">·</span>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant hover:text-on-surface" type="button">IT</button>
<span className="text-outline-variant px-1 font-label-sm">·</span>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant hover:text-on-surface" type="button">ES</button>
</div>
</div>
</div>
</section>

<section className="w-full relative overflow-hidden py-space-xl lg:py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">

<div className="lg:col-span-7 flex flex-col gap-space-md">
<div className="inline-flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-label-sm text-secondary tracking-wider uppercase font-semibold">
              {t("svc_transport.licensed_mediterranean_logistics_skippers_spain_italy")}
            </span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight text-balance">
            {t("svc_transport.yacht_transport_skipper_delivery_and_overland")}
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
            {t("svc_transport.professional_maritime_logistics_across_the_western")}
          </p>

<div className="flex flex-col sm:flex-row flex-wrap gap-y-space-xs gap-x-space-lg py-space-xs text-on-surface font-body-sm text-body-sm">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[20px]">verified_user</span>
<span>{t("svc_transport.mca_rya_ocean_yachtmaster_patron_de")}</span>
</div>
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[20px]">local_shipping</span>
<span>{t("svc_transport.specialized_low_loader_overland_road_convoys")}</span>
</div>
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[20px]">security</span>
<span>{t("svc_transport.comprehensive_marine_transit_cargo_insurance_to")}</span>
</div>
</div>

<div className="flex flex-wrap items-center gap-space-md pt-space-xs">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container px-space-lg py-3 rounded font-title-md text-title-md transition-all shadow-sm" >
              {t("svc_transport.request_transport_quote")}
            </Link>
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-transparent text-primary hover:bg-surface-container-high px-space-lg py-3 rounded font-title-md text-title-md transition-all" >
              {t("svc_transport.explore_delivery_options")}
            </Link>
</div>
</div>

<div className="lg:col-span-5 relative">
<div className="relative rounded-xl overflow-hidden shadow-xl bg-surface-container-low">
<img alt="" className="w-full h-[420px] object-cover" src="/design/b97589331d.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent"></div>

<div className="absolute bottom-4 left-4 right-4 bg-surface-container-lowest/95 backdrop-blur-sm p-space-sm rounded-lg shadow-md flex items-center gap-3">
<div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-on-primary text-[20px]">explore</span>
</div>
<div className="min-w-0">
<span className="block font-label-sm text-label-sm text-secondary uppercase font-semibold">{t("svc_transport.active_maritime_corridor")}</span>
<span className="block font-body-sm text-body-sm text-on-surface truncate font-medium">{t("svc_transport.baleares_liguria_tyrrhenian_gibraltar_atlantic")}</span>
</div>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-xl bg-surface-container-low">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mb-space-lg">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold block mb-2">{t("svc_transport.maritime_jurisdictions_passage_planning")}</span>
<h2 className="font-headline-md text-headline-md text-primary tracking-tight">{t("svc_transport.cross_border_maritime_logistics_in_mediterranean")}</h2>
</div>
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
<div className="lg:col-span-7 space-y-space-md text-on-surface-variant font-body-lg text-body-lg leading-relaxed">
<p>
            Vessel movements between the Iberian Peninsula and the Italian seaboard present intricate operational requirements. Traversing the Gulf of Lion and navigating the Bonifacio Strait require precise meteorological discernment to handle high-velocity Tramontane, Mistral, and seasonal Scirocco flows. Our certified delivery masters continuously evaluate synoptic wind models, barometric gradients, and swell fetch patterns before clearing transient harbor lines.
          </p>
<p>
            {t("svc_transport.cross_border_administrative_navigation_demands_equal")} <em>{t("svc_transport.agencia_tributaria")}</em> {t("svc_transport.aduanas_and_the_italian")} <em>{t("svc_transport.agenzia_delle_dogane_e_dei_monopoli")}</em>{t("svc_transport.for_non_eu_flagged_vessels_or")} <em>{t("svc_transport.regimen_de_perfeccionamiento_activo")}</em>{t("svc_transport.eliminating_exposure_to_unnecessary_vat_and")}
          </p>
<p>
            {t("svc_transport.when_schedule_deadlines_unstepped_rigs_or")}
          </p>
</div>

<div className="lg:col-span-5 bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md">
<div className="flex items-center justify-between pb-space-xs">
<span className="font-title-md text-title-md text-primary font-semibold">{t("svc_transport.passage_mode_feasibility_matrix")}</span>
<span className="font-label-sm text-label-sm bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant">{t("svc_transport.es_it_corridors")}</span>
</div>

<div className="space-y-space-sm font-body-sm text-body-sm">
<div className="p-space-sm bg-surface-container rounded-lg">
<div className="font-title-md text-title-md text-primary font-semibold mb-1 flex items-center justify-between">
<span>{t("svc_transport.skippered_water_passage")}</span>
<span className="material-symbols-outlined text-secondary text-[18px]">sailing</span>
</div>
<ul className="space-y-1 text-on-surface-variant font-body-sm">
<li><strong>{t("svc_transport.max_draft_beam")}</strong> {t("svc_transport.unrestricted_harbor_depth_contingent")}</li>
<li><strong>{t("svc_transport.mast_preparation")}</strong> {t("svc_transport.rigs_remain_stepped_and_fully_tuned")}</li>
<li><strong>{t("svc_transport.average_duration")}</strong> {t("svc_transport.3_to_6_days_palma_to")}</li>
<li><strong>{t("svc_transport.prerequisites")}</strong> {t("svc_transport.valid_safety_certs_functional_ais_seaworthy")}</li>
</ul>
</div>
<div className="p-space-sm bg-surface-container-high/60 rounded-lg">
<div className="font-title-md text-title-md text-primary font-semibold mb-1 flex items-center justify-between">
<span>{t("svc_transport.overland_heavy_haulage")}</span>
<span className="material-symbols-outlined text-secondary text-[18px]">rv_hookup</span>
</div>
<ul className="space-y-1 text-on-surface-variant font-body-sm">
<li><strong>{t("svc_transport.max_dimensions")}</strong> {t("svc_transport.up_to_4_80m_beam_4")}</li>
<li><strong>{t("svc_transport.mast_preparation")}</strong> {t("svc_transport.unstepping_de_rigging_cradling_required")}</li>
<li><strong>{t("svc_transport.average_duration")}</strong> {t("svc_transport.48_to_72_hours_highway_transit")}</li>
<li><strong>{t("svc_transport.prerequisites")}</strong> {t("svc_transport.route_survey_wide_load_police_convoys")}</li>
</ul>
</div>
</div>
<div className="text-on-surface-variant font-label-sm text-label-sm pt-space-xs">
            {t("svc_transport.nauta_logistics_coordinators_determine_the_optimal")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface" id="delivery-pillars">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-2xl mb-space-xl">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold block mb-2">{t("svc_transport.comprehensive_transit_capability")}</span>
<h2 className="font-headline-md text-headline-md text-primary tracking-tight">{t("svc_transport.the_six_core_pillars_of_nauta")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
          {t("svc_transport.from_self_propelled_sea_deliveries_to")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[26px]">navigation</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_transport.skippered_sea_deliveries")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_transport.experienced_fully_credentialed_masters_and_professional")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_transport.coastal_blue_water_transits")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[26px]">local_shipping</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_transport.overland_heavy_haulage")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_transport.custom_extendable_low_bed_trailers_pneumatic")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_transport.special_convoys_highway_permits")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[26px]">directions_boat</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_transport.yacht_carrier_semi_submersible_shipping")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_transport.lift_on_lift_off_lolo_and")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_transport.ocean_freight_cradle_securing")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[26px]">precision_manufacturing</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_transport.mast_unstepping_rigging_preparation")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_transport.professional_shipyard_de_rigging_mast_craning")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_transport.certified_shipyard_handling")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[26px]">description</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_transport.customs_port_logistics_handling")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_transport.clearance_documentation_transit_customs_bonds_t1")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_transport.bilateral_duty_marina_clearances")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[26px]">verified</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_transport.pre_departure_technical_sea_trial_fueling")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_transport.rigorous_pre_voyage_mechanical_inspection_bilge")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_transport.naval_readiness_protocol")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface-container-low">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop space-y-space-2xl">

<div>
<div className="max-w-2xl mb-space-lg">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold block mb-2">{t("svc_transport.targeted_operational_profiles")}</span>
<h2 className="font-headline-md text-headline-md text-primary tracking-tight">{t("svc_transport.tailored_logistics_for_discerning_owners_shipyards")}</h2>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
<span className="font-label-sm text-label-sm text-secondary font-semibold uppercase block mb-1">{t("svc_transport.segment_01")}</span>
<h4 className="font-title-md text-title-md text-primary mb-2">{t("svc_transport.private_yacht_owners")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_transport.seamless_seasonal_vessel_relocation_between_balearic")}
            </p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
<span className="font-label-sm text-label-sm text-secondary font-semibold uppercase block mb-1">{t("svc_transport.segment_02")}</span>
<h4 className="font-title-md text-title-md text-primary mb-2">{t("svc_transport.new_build_handover")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_transport.pristine_transit_for_newly_commissioned_builds")}
            </p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
<span className="font-label-sm text-label-sm text-secondary font-semibold uppercase block mb-1">{t("svc_transport.segment_03")}</span>
<h4 className="font-title-md text-title-md text-primary mb-2">{t("svc_transport.charter_fleet_repositioning")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_transport.high_punctuality_positioning_of_catamarans_and")}
            </p>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
<span className="font-label-sm text-label-sm text-secondary font-semibold uppercase block mb-1">{t("svc_transport.segment_04")}</span>
<h4 className="font-title-md text-title-md text-primary mb-2">{t("svc_transport.pre_purchase_transfers")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_transport.safe_transit_of_recently_surveyed_or")}
            </p>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg lg:p-space-xl rounded-xl shadow-sm">
<div className="max-w-2xl mb-space-lg">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold block mb-2">{t("svc_transport.systematic_execution")}</span>
<h2 className="font-headline-md text-headline-md text-primary tracking-tight">{t("svc_transport.the_4_step_mediterranean_delivery_protocol")}</h2>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg relative">

<div className="flex flex-col">
<div className="flex items-center gap-3 mb-space-sm">
<span className="w-10 h-10 rounded-full bg-primary text-on-primary font-spec-num text-spec-num flex items-center justify-center font-semibold">01</span>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">{t("svc_transport.phase_one")}</span>
</div>
<h4 className="font-title-md text-title-md text-primary mb-2 font-semibold">{t("svc_transport.route_planning_risk_assessment")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_transport.high_resolution_meteorological_modeling_sea_state")}
            </p>
</div>

<div className="flex flex-col">
<div className="flex items-center gap-3 mb-space-sm">
<span className="w-10 h-10 rounded-full bg-primary text-on-primary font-spec-num text-spec-num flex items-center justify-center font-semibold">02</span>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">{t("svc_transport.phase_two")}</span>
</div>
<h4 className="font-title-md text-title-md text-primary mb-2 font-semibold">{t("svc_transport.vessel_preparation_rigging")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_transport.mechanical_fluid_verification_safety_inventory_certification")}
            </p>
</div>

<div className="flex flex-col">
<div className="flex items-center gap-3 mb-space-sm">
<span className="w-10 h-10 rounded-full bg-primary text-on-primary font-spec-num text-spec-num flex items-center justify-center font-semibold">03</span>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">{t("svc_transport.phase_three")}</span>
</div>
<h4 className="font-title-md text-title-md text-primary mb-2 font-semibold">{t("svc_transport.active_transit_live_telemetry")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_transport.twice_daily_satellite_position_briefings_continuous")}
            </p>
</div>

<div className="flex flex-col">
<div className="flex items-center gap-3 mb-space-sm">
<span className="w-10 h-10 rounded-full bg-primary text-on-primary font-spec-num text-spec-num flex items-center justify-center font-semibold">04</span>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">{t("svc_transport.phase_four")}</span>
</div>
<h4 className="font-title-md text-title-md text-primary mb-2 font-semibold">{t("svc_transport.arrival_inspection_handover")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_transport.full_post_passage_exterior_fresh_water")}
            </p>
</div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-lg bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-[#F2F6F6] p-space-md lg:p-space-lg rounded-xl flex flex-col md:flex-row items-center justify-between gap-space-md shadow-sm">
<div className="flex flex-col gap-1">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest font-semibold">{t("svc_transport.advertisement")}</span>
<h4 className="font-headline-sm text-headline-sm text-primary font-serif">{t("svc_transport.mediterranean_pilot_escorts_heavy_haul_craning")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">
            {t("svc_transport.specialized_route_scouting_100_ton_hydraulic")}
          </p>
</div>
<div className="shrink-0">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container px-space-md py-2 rounded font-title-md text-title-md transition-colors" >
            {t("svc_transport.visit_partner_fleet")}
          </Link>
</div>
</div>
</div>
</section>

<section className="w-full py-space-xl bg-surface-container-low">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">

<div className="lg:col-span-6 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm space-y-space-md">
<div>
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold block mb-1">{t("svc_transport.owner_preparation_guide")}</span>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_transport.pre_transport_documentation_checklist")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {t("svc_transport.have_these_five_critical_records_accessible")}
            </p>
</div>
<div className="space-y-space-sm">
<div className="flex items-start gap-3 p-space-sm bg-surface-container rounded-lg">
<span className="w-6 h-6 rounded bg-primary text-on-primary font-spec-num text-spec-num flex items-center justify-center shrink-0 font-medium">1</span>
<div>
<strong className="block font-title-md text-title-md text-primary">{t("svc_transport.vessel_registration_flag_state_documents")}</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_transport.original_certificate_of_registry_bill_of")}</span>
</div>
</div>
<div className="flex items-start gap-3 p-space-sm bg-surface-container rounded-lg">
<span className="w-6 h-6 rounded bg-primary text-on-primary font-spec-num text-spec-num flex items-center justify-center shrink-0 font-medium">2</span>
<div>
<strong className="block font-title-md text-title-md text-primary">{t("svc_transport.valid_marine_insurance_certificate")}</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_transport.policy_indicating_navigation_limits_matching_the")}</span>
</div>
</div>
<div className="flex items-start gap-3 p-space-sm bg-surface-container rounded-lg">
<span className="w-6 h-6 rounded bg-primary text-on-primary font-spec-num text-spec-num flex items-center justify-center shrink-0 font-medium">3</span>
<div>
<strong className="block font-title-md text-title-md text-primary">{t("svc_transport.precise_hull_dimensions_displacement")}</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_transport.true_overall_length_loa_maximum_beam")}</span>
</div>
</div>
<div className="flex items-start gap-3 p-space-sm bg-surface-container rounded-lg">
<span className="w-6 h-6 rounded bg-primary text-on-primary font-spec-num text-spec-num flex items-center justify-center shrink-0 font-medium">4</span>
<div>
<strong className="block font-title-md text-title-md text-primary">{t("svc_transport.required_departure_target_arrival_window")}</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_transport.anticipated_readiness_date_and_required_destination")}</span>
</div>
</div>
<div className="flex items-start gap-3 p-space-sm bg-surface-container rounded-lg">
<span className="w-6 h-6 rounded bg-primary text-on-primary font-spec-num text-spec-num flex items-center justify-center shrink-0 font-medium">5</span>
<div>
<strong className="block font-title-md text-title-md text-primary">{t("svc_transport.marina_berth_haul_out_reservations")}</strong>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_transport.written_slip_confirmation_at_origin_and")}</span>
</div>
</div>
</div>
</div>

<div className="lg:col-span-6 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm space-y-space-md">
<div>
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold block mb-1">{t("svc_transport.strategic_presence")}</span>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_transport.primary_logistics_hubs_dispatch_bases")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {t("svc_transport.stationed_coordinators_and_licensed_skippers_maintaining")}
            </p>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
<div className="p-space-sm bg-surface-container rounded-lg">
<div className="flex items-center gap-2 mb-1">
<span className="material-symbols-outlined text-secondary text-[20px]">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_transport.palma_de_mallorca")}</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_transport.balearic_central_hub_offshore_skipper_rally")}</span>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<div className="flex items-center gap-2 mb-1">
<span className="material-symbols-outlined text-secondary text-[20px]">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_transport.barcelona_port_forum_mb92")}</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_transport.superyacht_refit_transfers_ap_7_overland")}</span>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<div className="flex items-center gap-2 mb-1">
<span className="material-symbols-outlined text-secondary text-[20px]">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_transport.valencia")}</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_transport.heavy_cargo_craning_terminal_catamaran_road")}</span>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<div className="flex items-center gap-2 mb-1">
<span className="material-symbols-outlined text-secondary text-[20px]">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_transport.genoa_porto_antico")}</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_transport.ligurian_gateway_northern_italian_shipyard_connections")}</span>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<div className="flex items-center gap-2 mb-1">
<span className="material-symbols-outlined text-secondary text-[20px]">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_transport.livorno_viareggio")}</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_transport.tuscan_superyacht_corridor_dispatch_mast_unstepping")}</span>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<div className="flex items-center gap-2 mb-1">
<span className="material-symbols-outlined text-secondary text-[20px]">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_transport.naples_algeciras")}</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_transport.southern_tyrrhenian_links_strait_of_gibraltar")}</span>
</div>
</div>
<div className="p-space-sm bg-primary text-on-primary rounded-lg flex items-center gap-3">
<span className="material-symbols-outlined text-[24px]">headset_mic</span>
<div className="font-body-sm text-body-sm">
<span className="font-medium block">{t("svc_transport.nauta_inter_hub_vessel_relocation_network")}</span>
<span className="text-on-primary-container">{t("svc_transport.scheduled_convoys_and_certified_skippers_depart")}</span>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface" id="quote-request-form">
<div className="max-w-[1100px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-2xl shadow-xl">
<div className="text-center max-w-2xl mx-auto mb-space-xl">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold block mb-1">{t("svc_transport.direct_logistics_inquiry")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">{t("svc_transport.request_a_yacht_transport_or_delivery")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
            {t("svc_transport.direct_dispatch_to_certified_delivery_captains")}
          </p>
</div>
<form className="space-y-space-lg">

<div>
<h4 className="font-title-md text-title-md text-primary font-semibold mb-space-sm pb-1 flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[18px]">person</span>
<span>{t("svc_transport.1_contact_client_information")}</span>
</h4>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.full_name")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="e.g. Marcella Riva" required type="text"/>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.email_address")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="m.riva@nauta-maritime.com" required type="email"/>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.phone_whatsapp_enabled")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="+34 600 000 000 / +39 330 000000" required type="tel"/>
</div>
</div>
</div>

<div>
<h4 className="font-title-md text-title-md text-primary font-semibold mb-space-sm pb-1 flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[18px]">directions_boat</span>
<span>{t("svc_transport.2_vessel_specifications")}</span>
</h4>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-md">
<div className="flex flex-col gap-1 lg:col-span-2">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.vessel_make_model_hull_name")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="e.g. Beneteau Oceanis 51.1 / M/Y Levante" required type="text"/>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.length_loa")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="e.g. 15.94 m" required type="text"/>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.beam_width")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="e.g. 4.80 m" required type="text"/>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.draft_weight_t")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="e.g. 2.30 m / 14.5 T" required type="text"/>
</div>
</div>
</div>

<div>
<h4 className="font-title-md text-title-md text-primary font-semibold mb-space-sm pb-1 flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[18px]">alt_route</span>
<span>{t("svc_transport.3_route_transit_method")}</span>
</h4>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.preferred_transport_mode")}</label>
<select className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" required>
<option value="">{t("svc_transport.select_mode")}</option>
<option value="skippered">{t("svc_transport.skippered_sea_delivery_water_passage")}</option>
<option value="overland">{t("svc_transport.overland_heavy_haulage_low_loader")}</option>
<option value="cargo">{t("svc_transport.yacht_carrier_cargo_ship_lolo_flofo")}</option>
<option value="consult">{t("svc_transport.consulting_recommend_best_option")}</option>
</select>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.origin_marina_country")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="e.g. Real Club Náutico de Palma (ES)" required type="text"/>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.destination_marina_country")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="e.g. Marina Genova / Portofino (IT)" required type="text"/>
</div>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.target_departure_delivery_window")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="e.g. Mid-October 2025 (Flexible +/- 5 days)" required type="text"/>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.rigging_special_instructions")}</label>
<input className="bg-surface-container-lowest px-space-sm py-2.5 rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-low shadow-sm" placeholder="e.g. Mast stepped; requires de-rigging in Barcelona" type="text"/>
</div>
</div>

<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_transport.vessel_specifications_or_registry_documents_optional")}</label>
<div className="p-space-md bg-surface-container-low rounded-xl text-center flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container transition-colors">
<span className="material-symbols-outlined text-secondary text-[32px] mb-1">cloud_upload</span>
<span className="font-title-md text-title-md text-primary font-medium">{t("svc_transport.upload_vessel_photos_or_registration_dimensions")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_transport.pdf_jpg_or_png_up_to")}</span>
</div>
</div>

<div className="pt-space-sm flex flex-col sm:flex-row items-center justify-between gap-space-md">
<button className="w-full sm:w-auto inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container px-space-xl py-3 rounded font-title-md text-title-md transition-all shadow-md" type="submit">
              {t("svc_transport.request_transport_quote_2")}
            </button>
<div className="font-body-sm text-body-sm text-on-surface-variant text-center sm:text-right">
              {t("svc_transport.response_guaranteed_within_24_operational_hours")}
            </div>
</div>

<div className="p-space-md bg-surface-container rounded-xl flex flex-col sm:flex-row items-center justify-between gap-space-md mt-space-md">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
<span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
</div>
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block">{t("svc_transport.immediate_operational_dispatch")}</span>
<span className="font-title-md text-title-md text-primary font-medium">{t("svc_transport.speak_directly_with_our_marine_logistics")}</span>
</div>
</div>
<div className="flex items-center gap-space-md font-spec-num text-spec-num font-semibold text-primary">
<span>{t("svc_transport.es_34_971_00_22_11")}</span>
<span className="text-outline-variant">|</span>
<span>{t("svc_transport.it_39_010_890_3300")}</span>
</div>
</div>
</form>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface-container-low">
<div className="max-w-[960px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="text-center mb-space-xl">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold block mb-1">{t("svc_transport.operational_clarity")}</span>
<h2 className="font-headline-md text-headline-md text-primary tracking-tight">{t("svc_transport.frequently_asked_questions_regarding_vessel_transit")}</h2>
</div>
<div className="space-y-space-sm" id="faq-accordion">

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-md text-title-md text-primary font-semibold hover:bg-surface-container-high/40 transition-colors" type="button">
<span>{t("svc_transport.how_is_the_vessel_insured_during")}</span>
<span className="material-symbols-outlined text-secondary chevron transition-transform text-[20px]">expand_more</span>
</button>
<div className="p-space-md pt-0 font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Every Nauta operation is backed by comprehensive transit insurance underwritten by leading marine syndicates (Lloyd’s and Generali Marine). For sea passages, our skipper carries professional liability with policy extensions covering accidental hull damage, salvage, and third-party liabilities up to €15,000,000. For overland haulage, comprehensive CMR and specialized cargo insurance covers full replacement value during crane loading, highway transport, and offloading.
          </div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-md text-title-md text-primary font-semibold hover:bg-surface-container-high/40 transition-colors" type="button">
<span>{t("svc_transport.what_weather_constraints_apply_to_skippered")}</span>
<span className="material-symbols-outlined text-secondary chevron transition-transform text-[20px]">expand_more</span>
</button>
<div className="p-space-md pt-0 font-body-md text-body-md text-on-surface-variant leading-relaxed">
            The Gulf of Lion is one of Europe&apos;s most volatile wind corridors. Delivery captains adhere strictly to safe operational parameters: we do not initiate open passages if sustained winds exceed Beaufort Force 6 (25 knots) or if significant wave height exceeds 2.5 meters in the open basin. Our shore-side routing team monitors Meteo-France and AEMET ECMWF models around the clock, routing via coastal lee anchorages (Roses, Port-Vendres, Hyères) when required.
          </div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-md text-title-md text-primary font-semibold hover:bg-surface-container-high/40 transition-colors" type="button">
<span>{t("svc_transport.when_is_overland_transport_preferable_over")}</span>
<span className="material-symbols-outlined text-secondary chevron transition-transform text-[20px]">expand_more</span>
</button>
<div className="p-space-md pt-0 font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Overland haulage is optimal for motor yachts and sailing boats up to 48 feet that require winter repositioning when open sea conditions are unpredictable. It prevents engine wear, conserves fuel, eliminates coastal wear-and-tear, and offers strict guaranteed arrival dates (typically under 72 hours from Barcelona to Genoa). It is also ideal for vessels requiring mast repairs or undergoing shipyard refits in northern Italy.
          </div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="w-full p-space-md text-left flex items-center justify-between font-title-md text-title-md text-primary font-semibold hover:bg-surface-container-high/40 transition-colors" type="button">
<span>{t("svc_transport.can_personal_belongings_and_spare_parts")}</span>
<span className="material-symbols-outlined text-secondary chevron transition-transform text-[20px]">expand_more</span>
</button>
<div className="p-space-md pt-0 font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Yes, standard vessel equipment, emergency gear, tender outboards, and owner personal effects may remain on board, provided a detailed itemized inventory is submitted during Phase 02 (Preparation). Loose items must be securely stowed in lockers and protected against sea motion or highway vibrations. Any high-value non-fixtures (art, fine watches, high-end electronics) must be declared explicitly for customs manifest verification.
          </div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-md">
<div>
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold block mb-1">{t("svc_transport.end_to_end_maritime_ecosystem")}</span>
<h2 className="font-headline-md text-headline-md text-primary tracking-tight">{t("svc_transport.related_maritime_services")}</h2>
</div>
<Link href="/services/professionals/" className="font-title-md text-title-md text-secondary hover:underline inline-flex items-center gap-1" >
<span>{t("svc_transport.view_all_nautical_services")}</span>
<span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">

<Link href="/services/professionals/" className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col" >
<div className="h-48 overflow-hidden bg-surface-container-low">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/50977b2590.jpg"/>
</div>
<div className="p-space-md flex-1 flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_transport.pre_passage_servicing")}</span>
<h4 className="font-title-lg text-title-lg text-primary group-hover:text-secondary transition-colors mb-2">{t("svc_transport.engines_and_maintenance")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {t("svc_transport.full_propulsion_diagnostics_fluid_lab_tests")}
              </p>
</div>
<div className="mt-space-md pt-space-xs flex items-center text-secondary font-title-md text-title-md">
<span>{t("svc_transport.explore_maintenance")}</span>
<span className="material-symbols-outlined text-[18px] ml-1">chevron_right</span>
</div>
</div>
</Link>

<Link href="/services/professionals/" className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col" >
<div className="h-48 overflow-hidden bg-surface-container-low">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/c0a1e49c37.jpg"/>
</div>
<div className="p-space-md flex-1 flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_transport.hull_cargo_coverage")}</span>
<h4 className="font-title-lg text-title-lg text-primary group-hover:text-secondary transition-colors mb-2">{t("svc_transport.yacht_insurance")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {t("svc_transport.comprehensive_marine_hull_and_machinery_policies")}
              </p>
</div>
<div className="mt-space-md pt-space-xs flex items-center text-secondary font-title-md text-title-md">
<span>{t("svc_transport.explore_coverage")}</span>
<span className="material-symbols-outlined text-[18px] ml-1">chevron_right</span>
</div>
</div>
</Link>

<Link href="/services/professionals/" className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col" >
<div className="h-48 overflow-hidden bg-surface-container-low">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="/design/54f3bbf12d.jpg"/>
</div>
<div className="p-space-md flex-1 flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_transport.customs_registration")}</span>
<h4 className="font-title-lg text-title-lg text-primary group-hover:text-secondary transition-colors mb-2">{t("svc_transport.nautical_legal_services")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {t("svc_transport.flag_registration_spanish_matriculation_tax_exemptions")}
              </p>
</div>
<div className="mt-space-md pt-space-xs flex items-center text-secondary font-title-md text-title-md">
<span>{t("svc_transport.explore_legal")}</span>
<span className="material-symbols-outlined text-[18px] ml-1">chevron_right</span>
</div>
</div>
</Link>
</div>
</div>
</section>

<section className="w-full py-space-xl bg-primary-container text-on-primary">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex flex-col lg:flex-row items-center justify-between gap-space-lg">
<div className="max-w-2xl text-center lg:text-left">
<h3 className="font-headline-md text-headline-md tracking-tight font-serif text-white">{t("svc_transport.safeguard_your_mediterranean_vessel_transit_today")}</h3>
<p className="font-body-md text-body-md text-on-primary-container mt-1">
          {t("svc_transport.direct_liaison_with_certified_delivery_masters")}
        </p>
</div>
<div className="flex flex-wrap items-center justify-center gap-space-md shrink-0">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-secondary text-on-secondary hover:bg-secondary-fixed hover:text-on-secondary-fixed px-space-lg py-3 rounded font-title-md text-title-md transition-all shadow-md" >
          {t("svc_transport.request_transport_quote")}
        </Link>
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-transparent text-white hover:bg-white/10 px-space-lg py-3 rounded font-title-md text-title-md transition-all" >
          {t("svc_transport.all_nautical_services")}
        </Link>
</div>
</div>
</section>
</div>
    </main>
  );
}
