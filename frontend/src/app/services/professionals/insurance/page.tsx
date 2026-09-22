import { getT } from "@/i18n/server";
import Link from "@/components/layout/LocaleLink";

export default async function YachtInsurance() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="w-full bg-surface-container-low/60">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs text-on-surface-variant">
<nav className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
<Link href="/" className="hover:text-primary transition-colors" >{t("svc_insurance.home")}</Link>
<span className="text-outline-variant font-label-sm">/</span>
<Link href="/services/professionals/" className="hover:text-primary transition-colors" >{t("svc_insurance.services")}</Link>
<span className="text-outline-variant font-label-sm">/</span>
<span className="text-primary font-medium">{t("svc_insurance.yacht_insurance")}</span>
</nav>
<div className="flex items-center gap-space-sm self-start sm:self-auto">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-on-surface-variant/80">{t("svc_insurance.coverage_edition")}</span>
<div className="inline-flex items-center p-0.5 rounded-full bg-surface-container-lowest shadow-sm font-label-md text-label-md">
<span className="px-2 py-0.5 rounded-full bg-primary text-on-primary font-medium text-[11px]">EN</span>
<span className="text-outline-variant font-label-sm px-0.5">·</span>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant hover:text-on-surface transition-all text-[11px]" type="button">IT</button>
<span className="text-outline-variant font-label-sm px-0.5">·</span>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant hover:text-on-surface transition-all text-[11px]" type="button">ES</button>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-xl lg:py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">

<div className="lg:col-span-7 flex flex-col gap-space-md">
<div className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-surface-container w-fit text-secondary font-label-sm text-label-sm uppercase tracking-wider">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            {t("svc_insurance.maritime_underwriting_desk_spain_italy")}
          </div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-semibold text-balance">
            {t("svc_insurance.yacht_insurance_and_boat_coverage_in")}
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed max-w-2xl">
            {t("svc_insurance.specialised_mediterranean_hull_machinery_third_party")}
          </p>

<div className="flex flex-wrap gap-space-xs pt-space-xs">
<div className="inline-flex items-center gap-space-xs bg-surface-container-lowest px-3 py-1.5 rounded-lg shadow-sm text-on-surface font-body-sm text-body-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
<span>{t("svc_insurance.lloyds_mediterranean_underwriting_syndicates")}</span>
</div>
<div className="inline-flex items-center gap-space-xs bg-surface-container-lowest px-3 py-1.5 rounded-lg shadow-sm text-on-surface font-body-sm text-body-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">gavel</span>
<span>{t("svc_insurance.compliant_with_rd_607_1999_spain")}</span>
</div>
<div className="inline-flex items-center gap-space-xs bg-surface-container-lowest px-3 py-1.5 rounded-lg shadow-sm text-on-surface font-body-sm text-body-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">anchor</span>
<span>{t("svc_insurance.all_risk_hull_agreed_fixed_value")}</span>
</div>
</div>

<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md pt-space-sm">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container px-space-lg py-3 rounded-lg font-body-md text-body-md font-medium transition-colors shadow-sm" >
              {t("svc_insurance.request_insurance_quote")}
            </Link>
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-surface-container text-primary hover:bg-surface-container-high px-space-lg py-3 rounded-lg font-body-md text-body-md font-medium transition-colors" >
              {t("svc_insurance.explore_policy_tiers")}
              <span className="material-symbols-outlined text-[18px] ml-1">arrow_downward</span>
</Link>
</div>
</div>

<div className="lg:col-span-5">
<div className="relative rounded-xl overflow-hidden shadow-lg bg-surface-container-highest aspect-[4/3] group">
<img alt="" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" src="/design/f006531086.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent"></div>
<div className="absolute bottom-0 left-0 right-0 p-space-md flex flex-col gap-1">
<div className="inline-flex items-center gap-1.5 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded-full w-fit">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-primary">{t("svc_insurance.navigational_zone")}</span>
</div>
<p className="font-body-sm text-body-sm text-on-primary font-medium">
                {t("svc_insurance.gibraltar_to_ionian_sea_p_i")}
              </p>
<span className="font-label-sm text-label-sm text-on-primary/75">
                {t("svc_insurance.capitanerie_di_porto_capitanias_maritimas_certified")}
              </span>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mb-space-xl">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary font-semibold">{t("svc_insurance.regulatory_framework")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary mt-1 font-semibold">
          {t("svc_insurance.navigating_mediterranean_marine_risk_regulatory_compliance")}
        </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-sm leading-relaxed">
          {t("svc_insurance.nautical_insurance_in_the_western_mediterranean")}
        </p>
</div>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg mb-space-xl">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="flex items-center justify-between mb-space-sm">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[24px]">balance</span>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_insurance.spanish_mandatory_liability_rd_607_1999")}</h3>
</div>
<span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded bg-surface-container text-on-surface-variant uppercase">{t("svc_insurance.espana")}</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md leading-relaxed">
              {t("svc_insurance.under_royal_decree_607_1999_all")}
            </p>
<ul className="space-y-2 font-body-sm text-body-sm text-on-surface">
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>{t("svc_insurance.original_official_bilingual_insurance_certificate_mandatory")}</span>
</li>
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>{t("svc_insurance.specific_endorsements_required_for_foreign_flagged")}</span>
</li>
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>{t("svc_insurance.special_registration_extensions_for_vessels_under")}</span>
</li>
</ul>
</div>
<div className="mt-space-md pt-space-sm bg-surface-container/50 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
<span>{t("svc_insurance.statutory_cap_336_566_78_property")}</span>
<span className="text-secondary font-medium">{t("svc_insurance.rd_607_1999_mandate")}</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="flex items-center justify-between mb-space-sm">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[24px]">shield</span>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_insurance.italian_marine_navigation_shield")}</h3>
</div>
<span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded bg-surface-container text-on-surface-variant uppercase">{t("svc_insurance.italia")}</span>
</div>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md leading-relaxed">
              {t("svc_insurance.italian_waters_enforce_decreto_legislativo_209")}
            </p>
<ul className="space-y-2 font-body-sm text-body-sm text-on-surface">
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>{t("svc_insurance.mandatory_civil_liability_coverage_with_statutory")}</span>
</li>
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>{t("svc_insurance.compulsory_for_access_to_private_marinas")}</span>
</li>
<li className="flex items-start gap-2">
<span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check_circle</span>
<span>{t("svc_insurance.charter_protection_compliance_for_italian_noleggio")}</span>
</li>
</ul>
</div>
<div className="mt-space-md pt-space-sm bg-surface-container/50 -mx-space-lg -mb-space-lg px-space-lg py-space-sm rounded-b-xl flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
<span>{t("svc_insurance.d_lgs_209_2005_harmonised_eu")}</span>
<span className="text-secondary font-medium">{t("svc_insurance.capitanerie_certified")}</span>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
<h4 className="font-headline-sm text-headline-sm text-primary mb-space-xs">
          {t("svc_insurance.agreed_fixed_value_valor_convenido_valore")}
        </h4>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-space-sm">
          {t("svc_insurance.a_fundamental_pitfall_in_leisure_craft")} <span className="text-primary font-medium">{t("svc_insurance.agreed_fixed_value")}</span> {t("svc_insurance.policies_locked_via_accredited_marine_surveyors")}
        </p>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-md pt-space-xs">
<div className="p-space-sm bg-surface-container rounded-lg">
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_insurance.salvage_wreck_removal")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_insurance.spanish_capitanias_and_italian_capitanerie_possess")}</p>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_insurance.cross_border_continuity")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_insurance.single_seamless_policy_across_the_mediterranean")}</p>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<span className="font-label-sm text-label-sm text-secondary uppercase font-semibold block mb-1">{t("svc_insurance.berth_storm_assurances")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_insurance.covers_named_mediterranean_squalls_tramontana_mistral")}</p>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl" id="core-pillars">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-space-xl">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary font-semibold">{t("svc_insurance.underwriting_scope")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary mt-1 font-semibold">
          {t("svc_insurance.what_our_mediterranean_marine_policies_cover")}
        </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
          {t("svc_insurance.precision_engineered_marine_risk_architecture_constructed")}
        </p>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">directions_boat</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.1_comprehensive_hull_machinery_h_m")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_insurance.total_loss_constructive_total_loss_accidental")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_insurance.agreed_valuation_structure")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">policy</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.2_protection_indemnity_p_i_civil")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_insurance.high_limit_coverage_reaching_up_to")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_insurance.up_to_10_000_000_indemnity")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">sailing</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.3_marine_salvage_wreck_removal")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_insurance.full_unreserved_contractual_underwriting_for_emergency")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_insurance.zero_deductible_on_towing")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">build</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.4_machinery_breakdown_propulsion_cover")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_insurance.specialist_policy_add_ons_covering_accidental")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_insurance.inboard_pod_drive_extensions")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">group</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.5_skipper_professional_crew_guest_accident")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_insurance.maritime_labour_convention_mlc_compliant_crew")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_insurance.mlc_guest_medical_coverage")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">water</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.6_marina_berth_severe_weather_moorings")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_insurance.protection_for_leased_and_concession_marina")}
            </p>
</div>
<div className="mt-space-md pt-space-sm font-label-sm text-label-sm text-secondary uppercase font-semibold">
            {t("svc_insurance.balearics_italian_riviera_verified")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mb-space-xl">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary font-semibold">{t("svc_insurance.naval_profiles")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary mt-1 font-semibold">
          {t("svc_insurance.who_our_marine_underwriting_serves")}
        </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
          {t("svc_insurance.each_vessel_type_and_operational_model")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary font-semibold uppercase block mb-1">{t("svc_insurance.category_a")}</span>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.private_yacht_owners")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.recreational_motor_yachts_and_sailing_vessels")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-primary font-medium">
            {t("svc_insurance.10m_50m_loa_private_use")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary font-semibold uppercase block mb-1">{t("svc_insurance.category_b")}</span>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.cross_border_cruisers")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.navigators_traversing_the_western_mediterranean_balearics")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-primary font-medium">
            {t("svc_insurance.international_passage_endorsement")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary font-semibold uppercase block mb-1">{t("svc_insurance.category_c")}</span>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.charter_operators")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.commercial_vessels_registered_under_spain_s")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-primary font-medium">
            {t("svc_insurance.lista_6a_noleggio_occasionale")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary font-semibold uppercase block mb-1">{t("svc_insurance.category_d")}</span>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.classic_bespoke_crafts")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.wooden_sailing_ketches_carbon_multihulls_and")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-primary font-medium">
            {t("svc_insurance.surveyor_backed_underwriting")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-space-xl">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary font-semibold">{t("svc_insurance.clear_protocol")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary mt-1 font-semibold">
          {t("svc_insurance.how_our_underwriting_process_works")}
        </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs">
          {t("svc_insurance.a_disciplined_four_step_institutional_path")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<span className="font-spec-num text-spec-num text-secondary font-bold mb-space-sm block">01</span>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.vessel_risk_audit")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.we_review_your_vessel_s_technical")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-on-surface-variant">
            {t("svc_insurance.completed_within_24_hours")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<span className="font-spec-num text-spec-num text-secondary font-bold mb-space-sm block">02</span>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.syndicate_tender")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.we_approach_accredited_a_rated_marine")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-on-surface-variant">
            {t("svc_insurance.direct_syndicate_negotiation")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<span className="font-spec-num text-spec-num text-secondary font-bold mb-space-sm block">03</span>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.agreed_value_locking")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.review_of_independent_survey_findings_to")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-on-surface-variant">
            {t("svc_insurance.zero_depreciation_clauses")}
          </div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative">
<div>
<span className="font-spec-num text-spec-num text-secondary font-bold mb-space-sm block">04</span>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">{t("svc_insurance.binder_certification")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.immediate_binding_and_dispatch_of_official")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-on-surface-variant">
            {t("svc_insurance.marina_clearance_in_24h")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container/60 p-space-md md:p-space-lg rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md">
<div className="flex flex-col gap-1 max-w-2xl">
<div className="flex items-center gap-2">
<span className="font-label-sm text-label-sm text-on-surface-variant/80 uppercase tracking-widest font-semibold">{t("svc_insurance.advertisement")}</span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="font-headline-sm text-headline-sm text-primary font-serif">{t("svc_insurance.mallorca_nautical_rigging_ultrasonic_surveyors")}</span>
</div>
<span className="font-label-sm text-label-sm text-secondary font-medium">{t("svc_insurance.palma_port_adriano")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-1">
            {t("svc_insurance.independent_rig_inspections_and_ultrasonic_hull")}
          </p>
</div>
<Link href="/services/professionals/" className="inline-flex items-center gap-1 shrink-0 bg-surface-container-lowest hover:bg-surface text-primary px-space-md py-2 rounded-lg font-body-sm text-body-sm font-medium transition-colors shadow-sm" >
<span>{t("svc_insurance.visit_partner_directory")}</span>
<span className="material-symbols-outlined text-[16px]">arrow_outward</span>
</Link>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">

<div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary font-semibold block mb-1">{t("svc_insurance.preparation_guide")}</span>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs font-semibold">{t("svc_insurance.information_required_for_marine_underwriting")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
            {t("svc_insurance.to_ensure_rapid_quote_turnaround_and")}
          </p>
<div className="space-y-space-sm">
<div className="flex items-start gap-space-sm p-space-sm bg-surface-container rounded-lg">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">description</span>
<div>
<h4 className="font-title-md text-title-md text-primary">{t("svc_insurance.vessel_registration_patente_de_navegacion_registro")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{t("svc_insurance.official_flag_state_registration_document_stating")}</p>
</div>
</div>
<div className="flex items-start gap-space-sm p-space-sm bg-surface-container rounded-lg">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">assignment_turned_in</span>
<div>
<h4 className="font-title-md text-title-md text-primary">{t("svc_insurance.recent_independent_marine_survey")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{t("svc_insurance.mandatory_for_hulls_older_than_1015")}</p>
</div>
</div>
<div className="flex items-start gap-space-sm p-space-sm bg-surface-container rounded-lg">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">badge</span>
<div>
<h4 className="font-title-md text-title-md text-primary">{t("svc_insurance.builders_certificate_hin_cin_identification")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{t("svc_insurance.official_yard_documentation_verifying_year_of")}</p>
</div>
</div>
<div className="flex items-start gap-space-sm p-space-sm bg-surface-container rounded-lg">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">pin_drop</span>
<div>
<h4 className="font-title-md text-title-md text-primary">{t("svc_insurance.primary_mooring_navigational_perimeter_declaration")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{t("svc_insurance.home_port_berth_contract_dry_marina")}</p>
</div>
</div>
<div className="flex items-start gap-space-sm p-space-sm bg-surface-container rounded-lg">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">school</span>
<div>
<h4 className="font-title-md text-title-md text-primary">{t("svc_insurance.skipper_owner_nautical_certifications")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{t("svc_insurance.valid_certifications_per_patron_de_yate")}</p>
</div>
</div>
</div>
</div>

<div className="lg:col-span-5 flex flex-col gap-space-md">
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary font-semibold block mb-1">{t("svc_insurance.local_representation")}</span>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-xs font-semibold">{t("svc_insurance.regional_underwriting_desks")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              {t("svc_insurance.specialist_marine_claims_coordinators_and_underwriters")}
            </p>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
<div className="p-space-sm bg-surface-container rounded-lg">
<span className="font-title-md text-title-md text-primary block">{t("svc_insurance.palma_de_mallorca")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_insurance.balearic_islands_desk")}</span>
<span className="font-label-sm text-label-sm text-secondary mt-1 block">{t("svc_insurance.stp_marina_port_de_mallorca")}</span>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<span className="font-title-md text-title-md text-primary block">{t("svc_insurance.barcelona")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_insurance.port_vell_superyacht_desk")}</span>
<span className="font-label-sm text-label-sm text-secondary mt-1 block">{t("svc_insurance.catalonia_coastal_risk")}</span>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<span className="font-title-md text-title-md text-primary block">{t("svc_insurance.valencia")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_insurance.levante_maritime_desk")}</span>
<span className="font-label-sm text-label-sm text-secondary mt-1 block">{t("svc_insurance.marina_de_valencia")}</span>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<span className="font-title-md text-title-md text-primary block">{t("svc_insurance.madrid")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_insurance.central_risk_syndicate")}</span>
<span className="font-label-sm text-label-sm text-secondary mt-1 block">{t("svc_insurance.general_underwriting_directorate")}</span>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<span className="font-title-md text-title-md text-primary block">{t("svc_insurance.genoa")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_insurance.ligurian_admiralty_desk")}</span>
<span className="font-label-sm text-label-sm text-secondary mt-1 block">{t("svc_insurance.porto_antico_marina_genova")}</span>
</div>
<div className="p-space-sm bg-surface-container rounded-lg">
<span className="font-title-md text-title-md text-primary block">{t("svc_insurance.naples_capri")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block">{t("svc_insurance.tyrrhenian_island_desk")}</span>
<span className="font-label-sm text-label-sm text-secondary mt-1 block">{t("svc_insurance.campania_amalfi_navigation")}</span>
</div>
</div>
</div>

<div className="bg-primary-container p-space-md rounded-xl text-on-primary shadow-sm flex items-center justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary-fixed uppercase tracking-wider block font-semibold">{t("svc_insurance.immediate_assistance")}</span>
<p className="font-body-sm text-body-sm text-on-primary/90 mt-0.5">{t("svc_insurance.need_expedited_mooring_certification_for_port")}</p>
</div>
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-secondary text-on-secondary hover:bg-secondary/90 px-space-md py-2 rounded-lg font-body-sm text-body-sm font-medium transition-colors shrink-0" >
              {t("svc_insurance.submit_form")}
            </Link>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl" id="quote-form">
<div className="max-w-[1000px] mx-auto px-margin-mobile md:px-margin">
<div className="bg-surface-container-lowest p-space-lg md:p-space-xl rounded-xl shadow-md">
<div className="mb-space-lg">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary font-semibold">{t("svc_insurance.underwriting_inquiry")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary mt-1 font-semibold">
            {t("svc_insurance.request_a_marine_insurance_assessment")}
          </h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {t("svc_insurance.submit_your_vessel_details_for_a")}
          </p>
</div>
<form className="space-y-space-md">

<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
<div>
<label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="full_name">{t("svc_insurance.full_name")}</label>
<input className="w-full px-3 py-2.5 rounded-lg bg-surface font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary" id="full_name" placeholder="e.g. Marc de Boer" required type="text"/>
</div>
<div>
<label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="email_address">{t("svc_insurance.email_address")}</label>
<input className="w-full px-3 py-2.5 rounded-lg bg-surface font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary" id="email_address" placeholder="name@domain.com" required type="email"/>
</div>
<div>
<label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="phone_number">{t("svc_insurance.phone_with_country_code")}</label>
<input className="w-full px-3 py-2.5 rounded-lg bg-surface font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary" id="phone_number" placeholder="+34 600 000 000" required type="tel"/>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
<div>
<label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="boat_location">{t("svc_insurance.boat_current_location")}</label>
<input className="w-full px-3 py-2.5 rounded-lg bg-surface font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary" id="boat_location" placeholder="e.g. Marina Ibiza / Genoa" required type="text"/>
</div>
<div>
<label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="boat_type">{t("svc_insurance.boat_type")}</label>
<select className="w-full px-3 py-2.5 rounded-lg bg-surface font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary" id="boat_type" required>
<option value="motor">{t("svc_insurance.motor_yacht")}</option>
<option value="sailing">{t("svc_insurance.sailing_yacht")}</option>
<option value="catamaran">{t("svc_insurance.catamaran_multihull")}</option>
<option value="classic">{t("svc_insurance.classic_wood_vessel")}</option>
</select>
</div>
<div>
<label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="boat_loa">{t("svc_insurance.length_loa_in_meters")}</label>
<input className="w-full px-3 py-2.5 rounded-lg bg-surface font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary" id="boat_loa" max={100} min={5} placeholder="e.g. 18.5" required step={0.1} type="number"/>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
<div>
<label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="year_build">{t("svc_insurance.year_of_build")}</label>
<input className="w-full px-3 py-2.5 rounded-lg bg-surface font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary" id="year_build" max={2026} min={1950} placeholder="e.g. 2019" required type="number"/>
</div>
<div>
<label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="vessel_value">{t("svc_insurance.estimated_vessel_market_value")}</label>
<input className="w-full px-3 py-2.5 rounded-lg bg-surface font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary" id="vessel_value" min={20000} placeholder="e.g. 850,000" required step={5000} type="number"/>
</div>
<div>
<label className="block font-label-md text-label-md text-on-surface mb-1" htmlFor="navigation_area">{t("svc_insurance.navigation_area")}</label>
<select className="w-full px-3 py-2.5 rounded-lg bg-surface font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary" id="navigation_area" required>
<option value="spanish">{t("svc_insurance.spanish_waters_balearics")}</option>
<option value="italian">{t("svc_insurance.italian_waters_liguria_sardinia")}</option>
<option value="western_med">{t("svc_insurance.western_mediterranean_es_fr_it")}</option>
<option value="whole_med">{t("svc_insurance.whole_mediterranean_atlantic_gibraltar_to_greece")}</option>
</select>
</div>
</div>

<div>
<label className="block font-label-md text-label-md text-on-surface mb-1">{t("svc_insurance.upload_survey_report_or_current_policy")}</label>
<div className="flex flex-col items-center justify-center p-space-md rounded-lg bg-surface cursor-pointer hover:bg-surface-container transition-colors">
<span className="material-symbols-outlined text-secondary text-[28px] mb-1">cloud_upload</span>
<p className="font-body-sm text-body-sm text-on-surface text-center">
<span className="font-medium text-secondary">{t("svc_insurance.click_to_upload")}</span> {t("svc_insurance.or_drag_and_drop_your_maritime")}
              </p>
<p className="font-label-sm text-label-sm text-on-surface-variant/70 mt-0.5">{t("svc_insurance.pdf_jpg_up_to_25mb")}</p>
</div>
</div>

<div className="hidden p-space-md bg-secondary-container text-on-secondary-container rounded-lg font-body-sm text-body-sm flex items-center gap-2" id="form-feedback">
<span className="material-symbols-outlined text-[20px]">check_circle</span>
<span>{t("svc_insurance.thank_you_your_vessel_dossier_has")}</span>
</div>

<div className="pt-space-xs">
<button className="w-full bg-primary hover:bg-primary-container text-on-primary py-3.5 px-space-lg rounded-lg font-body-md text-body-md font-medium transition-colors shadow-sm text-center" type="submit">
              {t("svc_insurance.request_confidential_insurance_quote")}
            </button>
</div>

<div className="pt-space-sm flex flex-col sm:flex-row items-center justify-between gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[18px]">phone_in_talk</span>
<span>{t("svc_insurance.direct_underwriting_desk")}</span>
<Link href="/services/professionals/" className="hover:text-primary font-medium" >{t("svc_insurance.palma_34_971_00_24_10")}</Link>
<span className="text-outline-variant">·</span>
<Link href="/services/professionals/" className="hover:text-primary font-medium" >{t("svc_insurance.genoa_39_010_89_32_40")}</Link>
</div>
<span className="font-label-sm text-label-sm text-on-surface-variant/70">{t("svc_insurance.hours_monfri_08_30_19_30")}</span>
</div>
</form>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1000px] mx-auto px-margin-mobile md:px-margin">
<div className="mb-space-xl text-center">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary font-semibold">{t("svc_insurance.regulatory_clarity")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary mt-1 font-semibold">
          {t("svc_insurance.frequently_asked_questions")}
        </h2>
</div>
<div className="space-y-space-sm" id="faq-accordion">

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-sm [&amp;_summary::-webkit-details-marker]:hidden cursor-pointer">
<summary className="flex items-center justify-between font-title-lg text-title-lg text-primary list-none">
<span>{t("svc_insurance.what_is_the_difference_between_agreed")}</span>
<span className="material-symbols-outlined text-secondary transition-transform duration-300 group-open:rotate-180">expand_more</span>
</summary>
<div className="pt-space-sm font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Actual Cash Value (ACV) settles losses based on the vessel&apos;s depreciated worth at the exact second of loss, taking into account age, engine hours, and market downturns. In contrast, an Agreed Fixed Value (Valor Convenido) policy guarantees that the hull valuation stated in your schedule will be paid out entirely in a total loss without any deductions for market fluctuation or age depreciation. Nauta structures agreed value policies backed by accredited marine survey certificates.
          </div>
</details>

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-sm [&amp;_summary::-webkit-details-marker]:hidden cursor-pointer">
<summary className="flex items-center justify-between font-title-lg text-title-lg text-primary list-none">
<span>{t("svc_insurance.is_third_party_liability_insurance_legally")}</span>
<span className="material-symbols-outlined text-secondary transition-transform duration-300 group-open:rotate-180">expand_more</span>
</summary>
<div className="pt-space-sm font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Yes, without exception. In Spain, under Royal Decree 607/1999, every motor craft and sailing vessel over 6 meters LOA must maintain mandatory civil liability cover. In Italy, pursuant to the Codice delle Assicurazioni Private, all motorised vessels require certified third-party liability. No marina captaincy in the Balearics, Catalonia, Liguria, or Sardinia will assign a berth or allow transit without validating the physical or digital insurance certificate.
          </div>
</details>

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-sm [&amp;_summary::-webkit-details-marker]:hidden cursor-pointer">
<summary className="flex items-center justify-between font-title-lg text-title-lg text-primary list-none">
<span>{t("svc_insurance.how_does_cross_border_navigation_between")}</span>
<span className="material-symbols-outlined text-secondary transition-transform duration-300 group-open:rotate-180">expand_more</span>
</summary>
<div className="pt-space-sm font-body-md text-body-md text-on-surface-variant leading-relaxed">
            When bound through Nauta&apos;s Mediterranean underwriting partners, policies encompass an expansive geographical navigation limit (typically Gibraltar to the Ionian Sea, including the Spanish archipelagos, Ligurian coastline, Corsica, and Sardinia). Coverage, salvage liabilities, and P&amp;I guarantees remain completely intact as you traverse Spanish, French, and Italian jurisdictions without notifying the insurer for each passage.
          </div>
</details>

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-sm [&amp;_summary::-webkit-details-marker]:hidden cursor-pointer">
<summary className="flex items-center justify-between font-title-lg text-title-lg text-primary list-none">
<span>{t("svc_insurance.when_is_a_marine_surveyor_inspection")}</span>
<span className="material-symbols-outlined text-secondary transition-transform duration-300 group-open:rotate-180">expand_more</span>
</summary>
<div className="pt-space-sm font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {t("svc_insurance.most_lloyd_s_and_european_underwriters")}
          </div>
</details>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-sm">
<div>
<span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary font-semibold">{t("svc_insurance.ecosystem_services")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary mt-1 font-semibold">
            {t("svc_insurance.related_maritime_advisory")}
          </h2>
</div>
<Link href="/services/professionals/" className="inline-flex items-center gap-1 font-body-md text-body-md text-secondary hover:text-primary font-medium transition-colors" >
<span>{t("svc_insurance.view_all_maritime_services")}</span>
<span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">

<Link href="/services/professionals/" className="group bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between" >
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors mb-space-md">
<span className="material-symbols-outlined text-[24px]">gavel</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs group-hover:text-secondary transition-colors">{t("svc_insurance.nautical_legal_services")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.flag_registry_changes_spanish_matriculation_tax")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-secondary font-semibold flex items-center gap-1">
<span>{t("svc_insurance.learn_more")}</span>
<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</div>
</Link>

<Link href="/services/professionals/" className="group bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between" >
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors mb-space-md">
<span className="material-symbols-outlined text-[24px]">engineering</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs group-hover:text-secondary transition-colors">{t("svc_insurance.engines_maintenance")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.authorised_caterpillar_man_volvo_penta_and")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-secondary font-semibold flex items-center gap-1">
<span>{t("svc_insurance.learn_more")}</span>
<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</div>
</Link>

<Link href="/services/professionals/" className="group bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between" >
<div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors mb-space-md">
<span className="material-symbols-outlined text-[24px]">real_estate_agent</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs group-hover:text-secondary transition-colors">{t("svc_insurance.full_brokerage")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_insurance.bespoke_international_acquisition_and_representation_for")}
            </p>
</div>
<div className="mt-space-md pt-space-xs font-label-sm text-label-sm text-secondary font-semibold flex items-center gap-1">
<span>{t("svc_insurance.learn_more")}</span>
<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</div>
</Link>
</div>
</div>
</section>

<section className="w-full bg-primary py-space-2xl text-on-primary">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col lg:flex-row items-center justify-between gap-space-xl">
<div className="max-w-2xl">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-secondary-fixed font-semibold block mb-2">{t("svc_insurance.maritime_security")}</span>
<h2 className="font-headline-lg text-headline-lg text-on-primary font-semibold">
            {t("svc_insurance.protect_your_vessel_across_the_western")}
          </h2>
<p className="font-body-lg text-body-lg text-on-primary/80 mt-space-xs leading-relaxed">
            {t("svc_insurance.gain_the_legal_security_and_operational")}
          </p>
</div>
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md shrink-0 w-full sm:w-auto">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary-fixed-dim px-space-lg py-3.5 rounded-lg font-body-md text-body-md font-semibold transition-colors shadow-sm text-center" >
            {t("svc_insurance.request_insurance_quote")}
          </Link>
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-transparent border border-on-primary/30 text-on-primary hover:bg-on-primary/10 px-space-lg py-3.5 rounded-lg font-body-md text-body-md font-medium transition-colors text-center" >
            {t("svc_insurance.all_nautical_services")}
          </Link>
</div>
</div>
</div>
</section>
</div>
    </main>
  );
}
