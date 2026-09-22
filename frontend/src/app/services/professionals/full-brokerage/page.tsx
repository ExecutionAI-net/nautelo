import { getT } from "@/i18n/server";
import Link from "@/components/layout/LocaleLink";

export default async function FullBrokerage() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<div className="w-full bg-surface-container-low">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
<nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant">
<Link href="/services/professionals/" className="hover:text-primary transition-colors" >{t("svc_brokerage.services")}</Link>
<span className="text-outline">/</span>
<span className="text-primary font-semibold">{t("svc_brokerage.full_brokerage")}</span>
</nav>

<div className="flex items-center gap-space-xs self-start sm:self-auto">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mr-1">{t("svc_brokerage.content_edition")}</span>
<div className="inline-flex items-center p-0.5 rounded-full bg-surface-container-lowest shadow-sm">
<button className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary font-label-md text-label-md" type="button">EN</button>
<span className="text-outline-variant px-1 font-label-sm">·</span>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant hover:text-primary font-label-md text-label-md transition-colors" type="button">IT</button>
<span className="text-outline-variant px-1 font-label-sm">·</span>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant hover:text-primary font-label-md text-label-md transition-colors" type="button">ES</button>
</div>
</div>
</div>
</div>

<section className="w-full bg-surface py-space-xl md:py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-center">

<div className="lg:col-span-7 flex flex-col gap-space-md">
<div className="inline-flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-md text-label-md text-secondary tracking-widest uppercase font-semibold">{t("svc_brokerage.selling_your_boat_with_a_broker")}</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary leading-tight">
            {t("svc_brokerage.yacht_broker_services_for_selling_a")}
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
            {t("svc_brokerage.professional_representation_across_principal_western_mediterranean")}
          </p>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm pt-space-sm">
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-1">
<span className="material-symbols-outlined text-secondary text-2xl">verified_user</span>
<span className="font-title-md text-title-md text-primary pt-1">{t("svc_brokerage.professional_brokers")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_brokerage.brokers_listed_on_nauta_and_reviewed")}</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-1">
<span className="material-symbols-outlined text-secondary text-2xl">account_balance</span>
<span className="font-title-md text-title-md text-primary pt-1">{t("svc_brokerage.end_to_end_support")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_brokerage.one_accountable_broker_from_first_viewing")}</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-1">
<span className="material-symbols-outlined text-secondary text-2xl">hub</span>
<span className="font-title-md text-title-md text-primary pt-1">{t("svc_brokerage.buyers_in_two_countries")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_brokerage.buyers_looking_for_boats_in_spain")}</span>
</div>
</div>
<div className="pt-space-xs flex items-center gap-space-md">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-primary-container text-on-primary hover:bg-primary font-body-md text-body-md px-space-lg py-space-sm rounded-lg transition-colors shadow-sm" >
              {t("svc_brokerage.ask_a_broker_to_sell_my")}
            </Link>
<span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
<span className="material-symbols-outlined text-base text-secondary">anchor</span>
              {t("svc_brokerage.balearic_ligurian_basins")}
            </span>
</div>
</div>

<div className="lg:col-span-5 relative">
<div className="relative overflow-hidden rounded-2xl shadow-xl bg-surface-container-high aspect-[4/3] w-full">
<img alt="" className="w-full h-full object-cover" src="/design/d196cba470.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-transparent"></div>
<div className="absolute bottom-4 left-4 right-4 bg-surface-container-lowest/95 backdrop-blur p-space-sm rounded-lg shadow-md flex items-center justify-between">
<div className="flex items-center gap-space-xs">
<span className="material-symbols-outlined text-secondary text-xl">location_on</span>
<div>
<div className="font-label-md text-label-md text-primary">{t("svc_brokerage.palma_de_mallorca_marina_port_de")}</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_brokerage.represented_by_a_broker")}</div>
</div>
</div>
<div className="text-right">
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">{t("svc_brokerage.flag_registry")}</span>
<div className="font-spec-num text-spec-num text-primary">{t("svc_brokerage.es_it_uk")}</div>
</div>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-4xl mx-auto flex flex-col gap-space-lg">
<div className="flex flex-col gap-space-xs text-center">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_brokerage.naval_conveyancing_representation")}</span>
<h2 className="font-headline-md text-headline-md text-primary">
            {t("svc_brokerage.the_mediterranean_brokerage_lifecycle")}
          </h2>
</div>
<div className="space-y-space-md text-on-surface font-body-lg text-body-lg leading-relaxed bg-surface-container-lowest p-space-xl rounded-2xl shadow-sm">
<p>
            {t("svc_brokerage.vessel_disposal_across_the_western_mediterranean")} <em>{t("svc_brokerage.capitanias_maritimas")}</em> {t("svc_brokerage.and_italys")} <em>{t("svc_brokerage.guardia_costiera_uffici_circondariali_marittimi")}</em>{t("svc_brokerage.when_transacting_high_value_assets_between")}
          </p>
<p>
            {t("svc_brokerage.our_dedicated_full_brokerage_division_acts")} <em>{t("svc_brokerage.agencia_tributaria")}</em> {t("svc_brokerage.documentation_or_italian")} <em>{t("svc_brokerage.dichiarazione_di_costruzione")}</em>{t("svc_brokerage.to_cross_referencing_rina_and_lloyds")}
          </p>
<div className="grid grid-cols-1 md:grid-cols-2 gap-space-md pt-space-xs">
<div className="bg-surface-container p-space-md rounded-xl">
<h4 className="font-title-md text-title-md text-primary mb-1">{t("svc_brokerage.cross_border_title_discharge")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_brokerage.coordination_of_mortgage_deletion_and_deletion")}</p>
</div>
<div className="bg-surface-container p-space-md rounded-xl">
<h4 className="font-title-md text-title-md text-primary mb-1">{t("svc_brokerage.fiscal_status_harmonisation")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_brokerage.validation_of_eu_vat_compliance_matricula")}</p>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col gap-space-xs mb-space-xl">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_brokerage.what_is_included")}</span>
<h2 className="font-headline-md text-headline-md text-primary">{t("svc_brokerage.what_the_service_includes")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          {t("svc_brokerage.six_focused_structured_pillars_that_define")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-2xl">imagesmode</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.preparing_the_boat_for_sale")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.standardized_cosmetic_staging_protocols_professional_wide")}
            </p>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold mt-space-md">{t("svc_brokerage.01_staging_curation")}</span>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-2xl">analytics</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.pricing_strategy")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.comprehensive_comparative_market_appraisal_cma_leveraging")}
            </p>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold mt-space-md">{t("svc_brokerage.02_valuation_analytics")}</span>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-2xl">support_agent</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.managing_buyer_enquiries")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.rigorous_prospect_vetting_to_verify_financial")}
            </p>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold mt-space-md">{t("svc_brokerage.03_multilingual_triage")}</span>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-2xl">sailing</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.organising_viewings")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.discreet_dockside_inspections_accompanied_by_a")}
            </p>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold mt-space-md">{t("svc_brokerage.04_dockside_logistics")}</span>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-2xl">handshake</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.supporting_negotiation")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.commercial_counteroffers_handled_strictly_through_structured")}
            </p>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold mt-space-md">{t("svc_brokerage.05_commercial_defense")}</span>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-space-sm">
<span className="material-symbols-outlined text-2xl">fact_check</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.coordinating_the_sales_process")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.supervision_of_haul_out_and_marine")}
            </p>
</div>
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold mt-space-md">{t("svc_brokerage.06_closing_handover")}</span>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-lowest rounded-2xl p-space-lg md:p-space-xl shadow-sm">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-center">
<div className="lg:col-span-8 flex flex-col gap-space-sm">
<span className="font-label-md text-label-md text-secondary uppercase tracking-wider font-semibold">{t("svc_brokerage.eligibility_focus")}</span>
<h2 className="font-headline-md text-headline-md text-primary">{t("svc_brokerage.who_the_service_is_for")}</h2>
<p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.private_owners_of")} <strong>{t("svc_brokerage.motor_yachts_sailing_yachts_and_catamarans")}</strong> {t("svc_brokerage.berthed_or_flagged_in_spain_and")}
            </p>
</div>
<div className="lg:col-span-4 bg-surface-container p-space-md rounded-xl flex flex-col gap-2">
<div className="flex items-center gap-2 text-primary font-title-md text-title-md">
<span className="material-symbols-outlined text-secondary">straighten</span>
<span>{t("svc_brokerage.12m_to_50m_loa")}</span>
</div>
<div className="flex items-center gap-2 text-primary font-title-md text-title-md">
<span className="material-symbols-outlined text-secondary">directions_boat</span>
<span>{t("svc_brokerage.motor_sail_catamarans")}</span>
</div>
<div className="flex items-center gap-2 text-primary font-title-md text-title-md">
<span className="material-symbols-outlined text-secondary">gavel</span>
<span>{t("svc_brokerage.broker_agreement")}</span>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col gap-space-xs mb-space-xl text-center items-center">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_brokerage.step_by_step_execution")}</span>
<h2 className="font-headline-md text-headline-md text-primary">{t("svc_brokerage.how_the_service_works")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
          {t("svc_brokerage.from_initial_naval_assessment_to_handover")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col relative">
<div className="font-display-hero text-display-hero text-surface-container-high font-semibold leading-none mb-2">01</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.initial_consultation_valuation")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {t("svc_brokerage.detailed_inspection_of_registry_certificates_physical")}
          </p>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col relative">
<div className="font-display-hero text-display-hero text-surface-container-high font-semibold leading-none mb-2">02</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.listing_syndication")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {t("svc_brokerage.production_of_high_resolution_sales_collateral")}
          </p>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col relative">
<div className="font-display-hero text-display-hero text-surface-container-high font-semibold leading-none mb-2">03</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.qualified_viewings_negotiation")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {t("svc_brokerage.coordination_of_private_accompanied_dock_visits")}
          </p>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col relative">
<div className="font-display-hero text-display-hero text-surface-container-high font-semibold leading-none mb-2">04</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.completion_handover")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {t("svc_brokerage.resolution_of_survey_conditions_coordination_of")}
          </p>
</div>
</div>
</div>
</section>


<aside aria-label="Commercial Sponsor" className="w-full bg-surface py-space-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-low rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md">
<div className="flex flex-col gap-1">
<span className="font-label-sm text-label-sm text-outline tracking-widest uppercase">{t("svc_brokerage.advertisement")}</span>
<div className="font-headline-sm text-headline-sm text-primary">{t("svc_brokerage.liguria_drydock_refit_facility")}</div>
<p className="font-body-sm text-body-sm text-on-surface-variant max-w-2xl">
            {t("svc_brokerage.500t_syncrolift_services_in_genoa_specialised")}
          </p>
</div>
<div className="shrink-0 flex items-center gap-space-md">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md px-space-md py-space-sm rounded-lg transition-colors" >
            {t("svc_brokerage.inquire_drydock_availability")}
          </Link>
</div>
</div>
</div>
</aside>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col gap-space-xs mb-space-lg">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_brokerage.before_you_sign_checklist")}</span>
<h2 className="font-headline-md text-headline-md text-primary">{t("svc_brokerage.information_required_from_the_customer")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          {t("svc_brokerage.to_initiate_an_expedited_market_valuation")}
        </p>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-2">
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-lg">pin_drop</span>
</div>
<h3 className="font-title-md text-title-md text-primary">{t("svc_brokerage.current_berth_marina")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {t("svc_brokerage.exact_marina_location_pontoon_and_lease")}
          </p>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-2">
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-lg">description</span>
</div>
<h3 className="font-title-md text-title-md text-primary">{t("svc_brokerage.registration_flag_state")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {t("svc_brokerage.current_flag_certificate_commercial_private_classification")}
          </p>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-2">
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-lg">speed</span>
</div>
<h3 className="font-title-md text-title-md text-primary">{t("svc_brokerage.engine_hours_logs")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {t("svc_brokerage.port_and_starboard_main_machinery_hours")}
          </p>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-2">
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-lg">receipt_long</span>
</div>
<h3 className="font-title-md text-title-md text-primary">{t("svc_brokerage.vat_invoice_status")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {t("svc_brokerage.original_vat_invoice_customs_clearance_certificate")}
          </p>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-2">
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-lg">euro</span>
</div>
<h3 className="font-title-md text-title-md text-primary">{t("svc_brokerage.price_expectations")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            {t("svc_brokerage.target_asking_price_and_net_minimum")}
          </p>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col gap-space-xs mb-space-lg">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_brokerage.active_operational_bases")}</span>
<h2 className="font-headline-md text-headline-md text-primary">{t("svc_brokerage.service_coverage_locations")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
          {t("svc_brokerage.our_accredited_brokers_and_survey_liaison")}
        </p>
</div>
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-space-sm text-center">
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col items-center gap-1">
<span className="material-symbols-outlined text-secondary text-xl">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_brokerage.palma")}</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_brokerage.mallorca_es")}</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col items-center gap-1">
<span className="material-symbols-outlined text-secondary text-xl">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_brokerage.ibiza")}</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_brokerage.balearics_es")}</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col items-center gap-1">
<span className="material-symbols-outlined text-secondary text-xl">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_brokerage.barcelona")}</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_brokerage.catalonia_es")}</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col items-center gap-1">
<span className="material-symbols-outlined text-secondary text-xl">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_brokerage.valencia")}</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_brokerage.levante_es")}</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col items-center gap-1">
<span className="material-symbols-outlined text-secondary text-xl">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_brokerage.costa_smeralda")}</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_brokerage.sardinia_it")}</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col items-center gap-1">
<span className="material-symbols-outlined text-secondary text-xl">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_brokerage.genoa")}</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_brokerage.liguria_it")}</span>
</div>
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col items-center gap-1">
<span className="material-symbols-outlined text-secondary text-xl">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_brokerage.naples")}</span>
<span className="font-label-sm text-label-sm text-on-surface-variant">{t("svc_brokerage.campania_it")}</span>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl" id="brokerage-request-form">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mx-auto bg-surface-container-lowest rounded-2xl p-space-lg md:p-space-xl shadow-md">
<div className="flex flex-col gap-space-xs mb-space-lg text-center">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_brokerage.representation_inquiry")}</span>
<h2 className="font-headline-md text-headline-md text-primary">{t("svc_brokerage.request_brokerage_service")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant">
            {t("svc_brokerage.talk_directly_to_a_broker_who")}
          </p>
</div>
<form className="flex flex-col gap-space-md">
<div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">

<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary" htmlFor="vendor_name">{t("svc_brokerage.full_name")}</label>
<input className="w-full bg-surface p-space-sm rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary" id="vendor_name" placeholder="Capt. Matteo Rossi / Javier Ortega" required type="text"/>
</div>

<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary" htmlFor="vendor_email">{t("svc_brokerage.email_address")}</label>
<input className="w-full bg-surface p-space-sm rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary" id="vendor_email" placeholder="vesselowner@domain.com" required type="email"/>
</div>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">

<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary" htmlFor="vendor_phone">{t("svc_brokerage.phone_number")}</label>
<input className="w-full bg-surface p-space-sm rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary" id="vendor_phone" placeholder="+34 600 000 000 / +39 330 000000" required type="tel"/>
</div>

<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary" htmlFor="boat_location">{t("svc_brokerage.boat_location_port_marina")}</label>
<input className="w-full bg-surface p-space-sm rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary" id="boat_location" placeholder="e.g. Marina Port Vell, Barcelona" required type="text"/>
</div>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">

<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary" htmlFor="boat_type">{t("svc_brokerage.boat_type")}</label>
<select className="w-full bg-surface p-space-sm rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary" id="boat_type" required>
<option value="">{t("svc_brokerage.select_vessel_category")}</option>
<option value="motor_yacht">{t("svc_brokerage.motor_yacht")}</option>
<option value="sailing_yacht">{t("svc_brokerage.sailing_yacht")}</option>
<option value="catamaran">{t("svc_brokerage.catamaran")}</option>
<option value="other">{t("svc_brokerage.other")}</option>
</select>
</div>

<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary" htmlFor="boat_length">{t("svc_brokerage.length_overall_loa")}</label>
<div className="flex gap-2">
<input className="w-full bg-surface p-space-sm rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary" id="boat_length" placeholder="e.g. 24.5" required type="text"/>
<select className="bg-surface p-space-sm rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary">
<option value="meters">m</option>
<option value="feet">ft</option>
</select>
</div>
</div>
</div>

<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary" htmlFor="broker_message">{t("svc_brokerage.message_vessel_details")}</label>
<textarea className="w-full bg-surface p-space-sm rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary" id="broker_message" placeholder="State shipyard builder, year built, current asking price expectation, and any active lease or surveyor details..." rows={4}></textarea>
</div>

<div className="flex flex-col gap-1">
<span className="font-label-md text-label-md text-primary">{t("svc_brokerage.vessel_inventory_or_photos_optional")}</span>
<div className="relative bg-surface p-space-md rounded-xl text-center flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container transition-colors">
<span className="material-symbols-outlined text-secondary text-2xl mb-1">upload_file</span>
<span className="font-title-md text-title-md text-primary">{t("svc_brokerage.upload_vessel_inventory_or_photos")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_brokerage.pdf_jpeg_or_zip_up_to")}</span>
<input className="absolute inset-0 opacity-0 cursor-pointer" multiple type="file"/>
</div>
</div>

<div className="flex flex-col gap-space-xs pt-space-sm">
<button className="w-full bg-primary-container text-on-primary hover:bg-primary font-title-md text-title-md py-space-sm px-space-md rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2" type="submit">
<span className="material-symbols-outlined text-xl">gavel</span>
              {t("svc_brokerage.request_brokerage_service")}
            </button>
<p className="font-body-sm text-body-sm text-on-surface-variant text-center">
              {t("svc_brokerage.direct_dispatch_to_accredited_brokers_in")}
            </p>
</div>
</form>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mx-auto flex flex-col gap-space-lg">
<div className="text-center flex flex-col gap-space-xs">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_brokerage.advisory_clarifications")}</span>
<h2 className="font-headline-md text-headline-md text-primary">{t("svc_brokerage.frequently_asked_questions")}</h2>
</div>
<div className="space-y-space-sm">

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-sm [&amp;_summary::-webkit-details-marker]:hidden">
<summary className="flex items-center justify-between cursor-pointer font-title-lg text-title-lg text-primary select-none">
<span>{t("svc_brokerage.what_commission_rate_do_mediterranean_brokers")}</span>
<span className="material-symbols-outlined text-secondary transition-transform group-open:rotate-180">expand_more</span>
</summary>
<p className="mt-space-sm font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.standard_central_agency_commission_in_spain")}
            </p>
</details>

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-sm [&amp;_summary::-webkit-details-marker]:hidden">
<summary className="flex items-center justify-between cursor-pointer font-title-lg text-title-lg text-primary select-none">
<span>{t("svc_brokerage.how_long_does_it_typically_take")}</span>
<span className="material-symbols-outlined text-secondary transition-transform group-open:rotate-180">expand_more</span>
</summary>
<p className="mt-space-sm font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.in_mediterranean_waters_well_maintained_yachts")}
            </p>
</details>

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-sm [&amp;_summary::-webkit-details-marker]:hidden">
<summary className="flex items-center justify-between cursor-pointer font-title-lg text-title-lg text-primary select-none">
<span>{t("svc_brokerage.can_i_keep_using_my_boat")}</span>
<span className="material-symbols-outlined text-secondary transition-transform group-open:rotate-180">expand_more</span>
</summary>
<p className="mt-space-sm font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.yes_under_an_exclusive_central_agency")}
            </p>
</details>

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-sm [&amp;_summary::-webkit-details-marker]:hidden">
<summary className="flex items-center justify-between cursor-pointer font-title-lg text-title-lg text-primary select-none">
<span>{t("svc_brokerage.what_happens_if_the_buyer_requires")}</span>
<span className="material-symbols-outlined text-secondary transition-transform group-open:rotate-180">expand_more</span>
</summary>
<p className="mt-space-sm font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.all_customary_mediterranean_sale_agreements_are")}
            </p>
</details>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col gap-space-xs mb-space-lg">
<span className="font-label-md text-label-md text-secondary uppercase tracking-widest font-semibold">{t("svc_brokerage.complementary_solutions")}</span>
<h2 className="font-headline-md text-headline-md text-primary">{t("svc_brokerage.related_nautical_services")}</h2>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">

<Link href="/services/professionals/" className="group bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between" >
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-sm group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
<span className="material-symbols-outlined text-2xl">gavel</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.nautical_legal_services")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.spanish_matriculation_tax_management_italian_flag")}
            </p>
</div>
<div className="flex items-center gap-1 font-label-md text-label-md text-secondary mt-space-md">
<span>{t("svc_brokerage.learn_more")}</span>
<span className="material-symbols-outlined text-base">arrow_forward</span>
</div>
</Link>

<Link href="/services/professionals/" className="group bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between" >
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-sm group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
<span className="material-symbols-outlined text-2xl">shield</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.yacht_insurance")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.agreed_value_hull_machinery_protection_p")}
            </p>
</div>
<div className="flex items-center gap-1 font-label-md text-label-md text-secondary mt-space-md">
<span>{t("svc_brokerage.learn_more")}</span>
<span className="material-symbols-outlined text-base">arrow_forward</span>
</div>
</Link>

<Link href="/services/professionals/" className="group bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between" >
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-sm group-hover:bg-primary-container group-hover:text-on-primary transition-colors">
<span className="material-symbols-outlined text-2xl">rv_hookup</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_brokerage.transport_and_delivery")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_brokerage.cross_mediterranean_skipper_delivery_voyages_overland")}
            </p>
</div>
<div className="flex items-center gap-1 font-label-md text-label-md text-secondary mt-space-md">
<span>{t("svc_brokerage.learn_more")}</span>
<span className="material-symbols-outlined text-base">arrow_forward</span>
</div>
</Link>
</div>
</div>
</section>

<section className="w-full bg-primary-container text-on-primary py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop text-center">
<div className="max-w-2xl mx-auto flex flex-col items-center gap-space-md">
<span className="font-label-md text-label-md text-secondary-fixed uppercase tracking-widest font-semibold">{t("svc_brokerage.central_agency_representation")}</span>
<h2 className="font-headline-lg text-headline-lg text-on-primary">
          {t("svc_brokerage.ready_to_sell_your_vessel_with")}
        </h2>
<p className="font-body-lg text-body-lg text-on-primary-container leading-relaxed">
          {t("svc_brokerage.submit_your_vessel_specifications_today_receive")}
        </p>
<div className="pt-space-xs flex flex-col sm:flex-row items-center gap-space-md">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-secondary text-on-secondary hover:bg-on-secondary-container font-title-md text-title-md px-space-xl py-space-sm rounded-lg transition-colors shadow-md" >
            {t("svc_brokerage.request_brokerage_service")}
          </Link>
<span className="font-body-sm text-body-sm text-on-primary-container">
            {t("svc_brokerage.spain_balearics_liguria_campania")}
          </span>
</div>
</div>
</div>
</section>
</div>
    </main>
  );
}
