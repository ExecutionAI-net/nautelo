import { getT } from "@/i18n/server";
import Link from "@/components/layout/LocaleLink";

export default async function NauticalMarketing() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="w-full bg-surface-container-low/60 py-space-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
<nav className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
<Link href="/" className="hover:text-primary transition-colors" >{t("svc_marketing.home")}</Link>
<span className="text-outline-variant">/</span>
<Link href="/services/professionals/" className="hover:text-primary transition-colors" >{t("svc_marketing.services")}</Link>
<span className="text-outline-variant">/</span>
<span className="text-primary font-medium">{t("svc_marketing.nautical_marketing")}</span>
</nav>
<div className="flex items-center gap-space-sm font-label-md text-label-md">
<span className="text-on-surface-variant tracking-wider uppercase">{t("svc_marketing.content_edition")}</span>
<div className="inline-flex items-center p-0.5 rounded-full bg-surface-container-high">
<button className="px-2.5 py-0.5 rounded-full bg-primary text-on-primary font-semibold shadow-xs" type="button">EN</button>
<span className="text-outline-variant px-1 font-label-sm">·</span>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant hover:text-on-surface transition-colors" type="button">IT</button>
<span className="text-outline-variant px-1 font-label-sm">·</span>
<button className="px-2 py-0.5 rounded-full text-on-surface-variant hover:text-on-surface transition-colors" type="button">ES</button>
</div>
</div>
</div>
</section>

<section className="w-full py-space-xl lg:py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">

<div className="lg:col-span-7 flex flex-col items-start">
<div className="inline-flex items-center gap-2 px-space-sm py-1 rounded-sm bg-surface-container-high text-secondary font-label-md text-label-md tracking-wider uppercase mb-space-md">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            {t("svc_marketing.professional_maritime_media_acquisition_exposure_spain")}
          </div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mb-space-md font-serif">
            {t("svc_marketing.yacht_marketing_maritime_photography_and_video")}
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant mb-space-xl max-w-2xl leading-relaxed">
            {t("svc_marketing.specialized_visual_media_production_and_high")}
          </p>

<div className="flex flex-col sm:flex-row gap-space-md w-full mb-space-xl">
<div className="flex items-center gap-space-sm p-space-sm bg-surface-container-lowest rounded-md shadow-sm">
<span className="material-symbols-outlined text-secondary text-[24px]">videocam</span>
<span className="font-body-sm text-body-sm font-medium text-primary leading-snug">{t("svc_marketing.maritime_drone_chase_boat_cinema_operators")}</span>
</div>
<div className="flex items-center gap-space-sm p-space-sm bg-surface-container-lowest rounded-md shadow-sm">
<span className="material-symbols-outlined text-secondary text-[24px]">view_in_ar</span>
<span className="font-body-sm text-body-sm font-medium text-primary leading-snug">{t("svc_marketing.matterport_pro3_digital_twin_walkthroughs")}</span>
</div>
<div className="flex items-center gap-space-sm p-space-sm bg-surface-container-lowest rounded-md shadow-sm">
<span className="material-symbols-outlined text-secondary text-[24px]">hub</span>
<span className="font-body-sm text-body-sm font-medium text-primary leading-snug">{t("svc_marketing.syndicated_high_priority_european_reach")}</span>
</div>
</div>

<div className="flex flex-wrap items-center gap-space-md">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container font-title-md text-title-md px-space-lg py-3 rounded-lg shadow-sm transition-all duration-200" >
              {t("svc_marketing.request_marketing_proposal")}
              <span className="material-symbols-outlined ml-2 text-[20px]">arrow_downward</span>
</Link>
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-transparent text-primary hover:bg-surface-container font-title-md text-title-md px-space-lg py-3 rounded-lg transition-colors" >
              {t("svc_marketing.explore_media_packages")}
            </Link>
</div>
</div>

<div className="lg:col-span-5 relative">
<div className="relative rounded-xl overflow-hidden shadow-xl bg-surface-container aspect-[4/3] group">
<img alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" src="/design/afc29d14b9.webp"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent"></div>

<div className="absolute bottom-4 left-4 right-4 p-space-sm bg-surface-container-lowest/95 backdrop-blur-md rounded-md shadow-md">
<div className="flex items-center justify-between gap-2">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-secondary text-[18px]">near_me</span>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">{t("svc_marketing.active_fleet_production")}</span>
</div>
<span className="font-label-sm text-label-sm text-secondary bg-surface-container-low px-2 py-0.5 rounded-sm font-medium">{t("svc_marketing.bespoke_4k_hdr")}</span>
</div>
<p className="font-spec-num text-spec-num text-primary mt-1">{t("svc_marketing.balearic_islands_costa_brava_liguria_cote")}</p>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface-container-low">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">

<div className="lg:col-span-7 space-y-space-md">
<div className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">
            {t("svc_marketing.institutional_technical_perspective")}
          </div>
<h2 className="font-headline-md text-headline-md text-primary font-serif">
            {t("svc_marketing.the_impact_of_cinematic_visual_assets")}
          </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
            {t("svc_marketing.more_than_85_of_international_yacht")}
          </p>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            Filming afloat in the Western Mediterranean requires deep nautical competence alongside cinema mastery. Harsh mid-day Mediterranean sunlight creates severe specular flare across mirror-polished gelcoats, high-exposure teak decks, and chrome deck fittings. Our certified maritime cinema operators deploy calibrated circular polarizing filters, neutral density glass, and customized dynamic color profiles (Log profiles) that retain true deck tones, upholstery textures, and deep oceanic blues without blowout.
          </p>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {t("svc_marketing.by_synchronizing_dedicated_dual_engine_chase")}
          </p>
</div>

<div className="lg:col-span-5 bg-surface-container-lowest p-space-lg rounded-xl shadow-md space-y-space-md">
<div className="flex items-center justify-between pb-space-xs">
<h3 className="font-title-lg text-title-lg text-primary">{t("svc_marketing.standard_brokerage_vs_accredited_nautical_media")}</h3>
<span className="material-symbols-outlined text-secondary">compare_arrows</span>
</div>
<div className="grid grid-cols-2 gap-space-md pt-space-xs">

<div className="p-space-sm bg-surface-container-low rounded-lg space-y-2">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block font-semibold">{t("svc_marketing.standard_listing")}</span>
<ul className="font-body-sm text-body-sm text-on-surface-variant space-y-2">
<li className="flex items-start gap-1.5">
<span className="material-symbols-outlined text-outline text-[16px] shrink-0 mt-0.5">close</span>
                  {t("svc_marketing.static_dockside_phone_photos_with_wide")}
                </li>
<li className="flex items-start gap-1.5">
<span className="material-symbols-outlined text-outline text-[16px] shrink-0 mt-0.5">close</span>
                  {t("svc_marketing.blown_out_salon_windows_and_dark")}
                </li>
<li className="flex items-start gap-1.5">
<span className="material-symbols-outlined text-outline text-[16px] shrink-0 mt-0.5">close</span>
                  {t("svc_marketing.average_190_days_on_market_across")}
                </li>
<li className="flex items-start gap-1.5">
<span className="material-symbols-outlined text-outline text-[16px] shrink-0 mt-0.5">close</span>
                  {t("svc_marketing.repetitive_low_intent_tire_kicker_inquiries")}
                </li>
</ul>
</div>

<div className="p-space-sm bg-primary/5 rounded-lg space-y-2">
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block font-semibold">{t("svc_marketing.nauta_accredited")}</span>
<ul className="font-body-sm text-body-sm text-primary space-y-2">
<li className="flex items-start gap-1.5">
<span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">check</span>
                  {t("svc_marketing.4k_60fps_chase_boat_tracking_with")}
                </li>
<li className="flex items-start gap-1.5">
<span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">check</span>
                  {t("svc_marketing.architectural_hdr_interior_bracketing_and_dusk")}
                </li>
<li className="flex items-start gap-1.5">
<span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">check</span>
                  {t("svc_marketing.54_average_reduction_in_active_listing")}
                </li>
<li className="flex items-start gap-1.5">
<span className="material-symbols-outlined text-secondary text-[16px] shrink-0 mt-0.5">check</span>
                  {t("svc_marketing.direct_pre_qualified_overseas_buyer_inquiries")}
                </li>
</ul>
</div>
</div>
<div className="pt-space-xs font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
<span className="material-symbols-outlined text-secondary text-[16px]">verified</span>
            {t("svc_marketing.audited_over_140_mediterranean_yacht_listings")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl" id="core-services">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mb-space-xl">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold block mb-1">{t("svc_marketing.pillars_of_execution")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary font-serif">
          {t("svc_marketing.the_six_core_pillars_of_nautical")}
        </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-2">
          {t("svc_marketing.from_stabilized_sea_trial_tracking_to")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors mb-space-md">
<span className="material-symbols-outlined text-[28px]">flight</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs font-serif">
              {t("svc_marketing.cinematic_chase_boat_drone_videography")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_marketing.4k_60fps_dynamic_aerial_tracking_shots")}
            </p>
</div>
<div className="mt-space-md pt-space-sm flex items-center text-secondary font-label-md text-label-md">
<span>{t("svc_marketing.aesa_enac_certified_operations")}</span>
<span className="material-symbols-outlined text-[16px] ml-1">chevron_right</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors mb-space-md">
<span className="material-symbols-outlined text-[28px]">photo_camera</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs font-serif">
              {t("svc_marketing.architectural_interior_deck_photography")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_marketing.specialized_tilt_shift_and_wide_angle")}
            </p>
</div>
<div className="mt-space-md pt-space-sm flex items-center text-secondary font-label-md text-label-md">
<span>{t("svc_marketing.high_dynamic_range_hdr_color_balanced")}</span>
<span className="material-symbols-outlined text-[16px] ml-1">chevron_right</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors mb-space-md">
<span className="material-symbols-outlined text-[28px]">{t("svc_marketing.3d_rotation")}</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs font-serif">
              {t("svc_marketing.matterport_3d_virtual_walkthroughs")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_marketing.complete_interactive_digital_twins_allowing_overseas")}
            </p>
</div>
<div className="mt-space-md pt-space-sm flex items-center text-secondary font-label-md text-label-md">
<span>{t("svc_marketing.pro3_lidar_sensor_infrastructure")}</span>
<span className="material-symbols-outlined text-[16px] ml-1">chevron_right</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors mb-space-md">
<span className="material-symbols-outlined text-[28px]">picture_as_pdf</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs font-serif">
              {t("svc_marketing.technical_specification_pdf_brochures")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_marketing.editorial_print_ready_dossiers_designed_for")}
            </p>
</div>
<div className="mt-space-md pt-space-sm flex items-center text-secondary font-label-md text-label-md">
<span>{t("svc_marketing.print_ready_interactive_web_ready")}</span>
<span className="material-symbols-outlined text-[16px] ml-1">chevron_right</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors mb-space-md">
<span className="material-symbols-outlined text-[28px]">language</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs font-serif">
              {t("svc_marketing.multi_portal_listing_syndication")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_marketing.high_priority_featured_placement_across_yachtworld")}
            </p>
</div>
<div className="mt-space-md pt-space-sm flex items-center text-secondary font-label-md text-label-md">
<span>{t("svc_marketing.maximized_cross_border_search_exposure")}</span>
<span className="material-symbols-outlined text-[16px] ml-1">chevron_right</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors mb-space-md">
<span className="material-symbols-outlined text-[28px]">ads_click</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs font-serif">
              {t("svc_marketing.targeted_hnw_digital_campaigns")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_marketing.precision_algorithmic_targeting_focusing_on_certified")}
            </p>
</div>
<div className="mt-space-md pt-space-sm flex items-center text-secondary font-label-md text-label-md">
<span>{t("svc_marketing.granular_maritime_geo_demographics")}</span>
<span className="material-symbols-outlined text-[16px] ml-1">chevron_right</span>
</div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface-container-low">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">

<div className="mb-space-2xl">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold block mb-1">{t("svc_marketing.tailored_strategic_delivery")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary font-serif mb-space-lg">
          {t("svc_marketing.engineered_for_maritime_commercial_success")}
        </h2>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center gap-2 mb-space-xs text-primary font-serif font-semibold">
<span className="material-symbols-outlined text-secondary text-[20px]">person</span>
<h4 className="font-title-md text-title-md">{t("svc_marketing.private_boat_owners")}</h4>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.seeking_rapid_discreet_transactions_at_maximum")}
            </p>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center gap-2 mb-space-xs text-primary font-serif font-semibold">
<span className="material-symbols-outlined text-secondary text-[20px]">badge</span>
<h4 className="font-title-md text-title-md">{t("svc_marketing.brokers_central_agents")}</h4>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.elevating_mandate_pitch_presentations_to_secure")}
            </p>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center gap-2 mb-space-xs text-primary font-serif font-semibold">
<span className="material-symbols-outlined text-secondary text-[20px]">sailing</span>
<h4 className="font-title-md text-title-md">{t("svc_marketing.charter_fleet_operators")}</h4>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.driving_peak_season_calendar_fill_rates")}
            </p>
</div>

<div className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
<div className="flex items-center gap-2 mb-space-xs text-primary font-serif font-semibold">
<span className="material-symbols-outlined text-secondary text-[20px]">handyman</span>
<h4 className="font-title-md text-title-md">{t("svc_marketing.shipyards_refit_yards")}</h4>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.documenting_master_craftsman_refits_hull_restorations")}
            </p>
</div>
</div>
</div>

<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold block mb-1">{t("svc_marketing.standardized_execution_protocol")}</span>
<h3 className="font-headline-md text-headline-md text-primary font-serif mb-space-xl">
          {t("svc_marketing.four_stage_production_methodology")}
        </h3>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">

<div className="relative flex flex-col bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
<div className="font-headline-lg text-headline-lg text-secondary/30 font-serif font-bold mb-space-sm">01</div>
<h4 className="font-title-lg text-title-lg text-primary mb-space-xs font-serif">{t("svc_marketing.creative_brief_weather_scheduling")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.we_define_primary_selling_angles_key")}
            </p>
</div>

<div className="relative flex flex-col bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
<div className="font-headline-lg text-headline-lg text-secondary/30 font-serif font-bold mb-space-sm">02</div>
<h4 className="font-title-lg text-title-lg text-primary mb-space-xs font-serif">{t("svc_marketing.on_water_production_day")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.full_day_or_half_day_deployment")}
            </p>
</div>

<div className="relative flex flex-col bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
<div className="font-headline-lg text-headline-lg text-secondary/30 font-serif font-bold mb-space-sm">03</div>
<h4 className="font-title-lg text-title-lg text-primary mb-space-xs font-serif">{t("svc_marketing.post_production_color_grading")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.arri_d_log_cinema_color_grading")}
            </p>
</div>

<div className="relative flex flex-col bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
<div className="font-headline-lg text-headline-lg text-secondary/30 font-serif font-bold mb-space-sm">04</div>
<h4 className="font-title-lg text-title-lg text-primary mb-space-xs font-serif">{t("svc_marketing.multi_channel_handover_syndication")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.delivery_of_master_4k_cuts_vertical")}
            </p>
</div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-high p-space-lg rounded-xl shadow-sm relative overflow-hidden">
<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
<div className="space-y-1">
<div className="flex items-center gap-2">
<span className="font-label-sm text-label-sm tracking-widest uppercase text-on-surface-variant font-semibold">{t("svc_marketing.advertisement")}</span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="font-label-sm text-label-sm text-secondary font-medium">{t("svc_marketing.verified_maritime_partner")}</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary font-serif">
              {t("svc_marketing.aeromarine_palma_commercial_drone_permits_maritime")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              {t("svc_marketing.specialist_safety_chase_tenders_twin_engine")}
            </p>
</div>
<Link href="/services/professionals/" className="shrink-0 inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container px-space-md py-2.5 rounded-md font-title-md text-title-md transition-colors" >
            {t("svc_marketing.view_production_support")}
            <span className="material-symbols-outlined ml-1.5 text-[18px]">open_in_new</span>
</Link>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface-container-lowest">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">

<div className="lg:col-span-6 space-y-space-md">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold block mb-1">{t("svc_marketing.shoot_preparation_protocol")}</span>
<h3 className="font-headline-sm text-headline-sm text-primary font-serif">
              {t("svc_marketing.intake_checklist_for_vessel_owners_brokers")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {t("svc_marketing.to_maximize_production_output_and_ensure")}
            </p>
</div>
<div className="space-y-space-sm">
<div className="flex items-start gap-space-sm p-space-sm bg-surface rounded-lg shadow-xs">
<span className="w-6 h-6 rounded-full bg-secondary/15 text-secondary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
<div>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.berth_location_shore_clearance")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.vessel_moored_with_accessible_finger_pontoon")}</p>
</div>
</div>
<div className="flex items-start gap-space-sm p-space-sm bg-surface rounded-lg shadow-xs">
<span className="w-6 h-6 rounded-full bg-secondary/15 text-secondary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
<div>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.skipper_navigation_crew_on_board")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.qualified_helmsperson_ready_to_cast_off")}</p>
</div>
</div>
<div className="flex items-start gap-space-sm p-space-sm bg-surface rounded-lg shadow-xs">
<span className="w-6 h-6 rounded-full bg-secondary/15 text-secondary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
<div>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.salon_cabin_architectural_staging")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.interior_spaces_cleared_of_private_personal")}</p>
</div>
</div>
<div className="flex items-start gap-space-sm p-space-sm bg-surface rounded-lg shadow-xs">
<span className="w-6 h-6 rounded-full bg-secondary/15 text-secondary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">4</span>
<div>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.target_brokerage_launch_date")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.defined_timeline_for_central_listing_release")}</p>
</div>
</div>
<div className="flex items-start gap-space-sm p-space-sm bg-surface rounded-lg shadow-xs">
<span className="w-6 h-6 rounded-full bg-secondary/15 text-secondary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">5</span>
<div>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.specific_engineering_design_highlights")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.highlighting_unique_optional_extras_hydraulic_swim")}</p>
</div>
</div>
</div>
</div>

<div className="lg:col-span-6 space-y-space-md">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold block mb-1">{t("svc_marketing.strategic_operations")}</span>
<h3 className="font-headline-sm text-headline-sm text-primary font-serif">
              {t("svc_marketing.regional_production_hubs_across_spain_italy")}
            </h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {t("svc_marketing.our_permanent_camera_units_licensed_drone")}
            </p>
</div>
<div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm">
<div className="p-space-sm bg-surface rounded-lg shadow-xs">
<span className="material-symbols-outlined text-secondary text-[20px] mb-1">anchor</span>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.palma_de_mallorca")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.club_de_mar_stp")}</p>
</div>
<div className="p-space-sm bg-surface rounded-lg shadow-xs">
<span className="material-symbols-outlined text-secondary text-[20px] mb-1">anchor</span>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.ibiza")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.marina_botafoch_magna")}</p>
</div>
<div className="p-space-sm bg-surface rounded-lg shadow-xs">
<span className="material-symbols-outlined text-secondary text-[20px] mb-1">anchor</span>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.barcelona")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.oneocean_port_vell")}</p>
</div>
<div className="p-space-sm bg-surface rounded-lg shadow-xs">
<span className="material-symbols-outlined text-secondary text-[20px] mb-1">anchor</span>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.valencia")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.marina_real_juan_carlos_i")}</p>
</div>
<div className="p-space-sm bg-surface rounded-lg shadow-xs">
<span className="material-symbols-outlined text-secondary text-[20px] mb-1">anchor</span>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.genoa")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.marina_porto_antico")}</p>
</div>
<div className="p-space-sm bg-surface rounded-lg shadow-xs">
<span className="material-symbols-outlined text-secondary text-[20px] mb-1">anchor</span>
<h4 className="font-title-md text-title-md text-primary">{t("svc_marketing.naples_amalfi")}</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.marina_di_stabia_mergellina")}</p>
</div>
</div>
<div className="p-space-md bg-surface-container rounded-lg">
<div className="flex items-center gap-2 text-primary font-medium font-body-sm text-body-sm">
<span className="material-symbols-outlined text-secondary">tune</span>
              {t("svc_marketing.cannes_monaco_liaison_coverage")}
            </div>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {t("svc_marketing.cross_border_shoots_across_the_french")}
            </p>
</div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface-container-low" id="proposal-form">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-4xl mx-auto bg-surface-container-lowest rounded-2xl shadow-xl p-space-lg sm:p-space-xl">
<div className="text-center max-w-2xl mx-auto mb-space-xl">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold block mb-1">{t("svc_marketing.custom_maritime_production")}</span>
<h2 className="font-headline-lg text-headline-lg text-primary font-serif">
            {t("svc_marketing.request_a_nautical_marketing_proposal")}
          </h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
            {t("svc_marketing.connect_directly_with_certified_maritime_videographers")}
          </p>
</div>
<form className="space-y-space-md">

<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.full_name")}</label>
<input className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary placeholder-outline focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs" placeholder="Captain Mateo Rossi" required type="text"/>
</div>
<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.email_address")}</label>
<input className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary placeholder-outline focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs" placeholder="m.rossi@med-brokerage.com" required type="email"/>
</div>
<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.phone_with_country_code")}</label>
<input className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary placeholder-outline focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs" placeholder="+34 600 000 000" required type="tel"/>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.vessel_name")}</label>
<input className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary placeholder-outline focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs" placeholder="M/Y Sirena" type="text"/>
</div>
<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.shipyard_model")}</label>
<input className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary placeholder-outline focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs" placeholder="e.g. Sanlorenzo SL86 or Riva 68" required type="text"/>
</div>
<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.loa_length_overall_m")}</label>
<input className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary placeholder-outline focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs" placeholder="26.4" required step={0.1} type="number"/>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.vessel_current_location_marina_port")}</label>
<input className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary placeholder-outline focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs" placeholder="e.g. Marina Port de Mallorca, Palma" required type="text"/>
</div>
<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.requested_production_scope")}</label>
<select className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs">
<option value="complete">{t("svc_marketing.complete_package_4k_chase_cinema_photo")}</option>
<option value="drone-running">{t("svc_marketing.drone_exterior_running_footage_only")}</option>
<option value="interior-3d">{t("svc_marketing.architectural_stills_3d_matterport_twin")}</option>
<option value="brochure-syndication">{t("svc_marketing.sales_pdf_dossier_multi_portal_syndication")}</option>
<option value="custom">{t("svc_marketing.custom_commercial_campaign_specification")}</option>
</select>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.production_timeline_urgency")}</label>
<select className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs">
<option value="urgent">{t("svc_marketing.immediate_within_7_14_days")}</option>
<option value="month">{t("svc_marketing.upcoming_month")}</option>
<option value="flexible">{t("svc_marketing.flexible_planning_for_next_refit_or")}</option>
</select>
</div>
<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.existing_listing_url_or_photo_vault")}</label>
<input className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary placeholder-outline focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs" placeholder="https://..." type="url"/>
</div>
</div>

<div>
<label className="block font-label-md text-label-md text-primary mb-1">{t("svc_marketing.specific_features_staging_focus")}</label>
<textarea className="w-full px-3 py-2.5 bg-surface rounded-md font-body-md text-body-md text-primary placeholder-outline focus:outline-none focus:ring-2 focus:ring-secondary/50 shadow-xs" placeholder="Specify any unique hull highlights, custom carpentry, sea-keeper stabilizers, or specific delivery file requirements..." rows={3}></textarea>
</div>

<div className="p-space-md bg-surface rounded-lg text-center cursor-pointer hover:bg-surface-container-high transition-colors">
<span className="material-symbols-outlined text-outline text-[32px] block mb-1">cloud_upload</span>
<span className="font-title-md text-title-md text-primary block">{t("svc_marketing.drop_vessel_photos_ga_plans_or")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_marketing.supports_pdf_jpg_png_up_to")}</span>
</div>

<div className="pt-space-sm flex flex-col sm:flex-row items-center justify-between gap-space-md">
<button className="w-full sm:w-auto inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container font-title-md text-title-md px-space-xl py-3 rounded-lg shadow-md transition-all" type="submit">
              {t("svc_marketing.request_marketing_proposal_2")}
              <span className="material-symbols-outlined ml-2 text-[20px]">send</span>
</button>
<div className="text-on-surface-variant font-body-sm text-body-sm flex items-center gap-4">
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-secondary text-[16px]">call</span>
                {t("svc_marketing.palma_34_971_000_000")}
              </span>
<span className="text-outline-variant">·</span>
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-secondary text-[16px]">call</span>
                {t("svc_marketing.genoa_39_010_000_000")}
              </span>
</div>
</div>

<div className="hidden p-space-md bg-surface-container text-primary rounded-md text-center font-body-md text-body-md" id="form-success">
<span className="material-symbols-outlined text-secondary text-[24px] align-middle mr-1">check_circle</span>
            {t("svc_marketing.thank_you_your_marketing_brief_has")}
          </div>
</form>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mx-auto">
<div className="text-center mb-space-xl">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold block mb-1">{t("svc_marketing.frequently_asked_questions")}</span>
<h2 className="font-headline-md text-headline-md text-primary font-serif">
            {t("svc_marketing.nautical_production_rights_clearances")}
          </h2>
</div>
<div className="space-y-space-sm" id="faq-accordion">

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-xs open:shadow-sm transition-all">
<summary className="flex items-center justify-between cursor-pointer font-title-lg text-title-lg text-primary list-none font-serif">
<span>{t("svc_marketing.how_long_does_a_typical_maritime")}</span>
<span className="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform">expand_more</span>
</summary>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-sm leading-relaxed">
              {t("svc_marketing.standard_full_scope_packages_typically_require")}
            </p>
</details>

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-xs open:shadow-sm transition-all">
<summary className="flex items-center justify-between cursor-pointer font-title-lg text-title-lg text-primary list-none font-serif">
<span>{t("svc_marketing.does_the_vessel_need_to_leave")}</span>
<span className="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform">expand_more</span>
</summary>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-sm leading-relaxed">
              {t("svc_marketing.yes_for_cinematic_running_footage_the")}
            </p>
</details>

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-xs open:shadow-sm transition-all">
<summary className="flex items-center justify-between cursor-pointer font-title-lg text-title-lg text-primary list-none font-serif">
<span>{t("svc_marketing.who_owns_the_copyright_and_distribution")}</span>
<span className="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform">expand_more</span>
</summary>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-sm leading-relaxed">
              {t("svc_marketing.full_worldwide_commercial_usage_rights_are")}
            </p>
</details>

<details className="group bg-surface-container-lowest p-space-md rounded-xl shadow-xs open:shadow-sm transition-all">
<summary className="flex items-center justify-between cursor-pointer font-title-lg text-title-lg text-primary list-none font-serif">
<span>{t("svc_marketing.can_the_3d_matterport_tour_be")}</span>
<span className="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform">expand_more</span>
</summary>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-sm leading-relaxed">
              {t("svc_marketing.yes_we_supply_standardized_responsive_iframe")}
            </p>
</details>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface-container-low">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col sm:flex-row sm:items-end justify-between mb-space-xl">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold block mb-1">{t("svc_marketing.integrated_support")}</span>
<h2 className="font-headline-md text-headline-md text-primary font-serif">
            {t("svc_marketing.complementary_nautical_services")}
          </h2>
</div>
<Link href="/services/professionals/" className="font-title-md text-title-md text-secondary hover:text-primary transition-colors inline-flex items-center gap-1 mt-2 sm:mt-0" >
          {t("svc_marketing.view_all_maritime_services")}
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">

<Link href="/services/professionals/" className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all group flex flex-col justify-between" >
<div>
<span className="material-symbols-outlined text-secondary text-[32px] mb-space-sm">directions_boat</span>
<h3 className="font-title-lg text-title-lg text-primary group-hover:text-secondary transition-colors mb-space-xs font-serif">{t("svc_marketing.full_brokerage")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.bespoke_international_vessel_representation_qualified_buyer")}
            </p>
</div>
<div className="mt-space-md flex items-center text-primary font-label-md text-label-md">
<span>{t("svc_marketing.explore_brokerage")}</span>
<span className="material-symbols-outlined text-[16px] ml-1">chevron_right</span>
</div>
</Link>

<Link href="/services/professionals/" className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all group flex flex-col justify-between" >
<div>
<span className="material-symbols-outlined text-secondary text-[32px] mb-space-sm">gavel</span>
<h3 className="font-title-lg text-title-lg text-primary group-hover:text-secondary transition-colors mb-space-xs font-serif">{t("svc_marketing.nautical_legal_services")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.cross_border_flag_registration_maritime_title")}
            </p>
</div>
<div className="mt-space-md flex items-center text-primary font-label-md text-label-md">
<span>{t("svc_marketing.explore_legal")}</span>
<span className="material-symbols-outlined text-[16px] ml-1">chevron_right</span>
</div>
</Link>

<Link href="/services/professionals/" className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-all group flex flex-col justify-between" >
<div>
<span className="material-symbols-outlined text-secondary text-[32px] mb-space-sm">verified_user</span>
<h3 className="font-title-lg text-title-lg text-primary group-hover:text-secondary transition-colors mb-space-xs font-serif">{t("svc_marketing.yacht_insurance")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              {t("svc_marketing.hull_and_machinery_underwriting_p_i")}
            </p>
</div>
<div className="mt-space-md flex items-center text-primary font-label-md text-label-md">
<span>{t("svc_marketing.explore_insurance")}</span>
<span className="material-symbols-outlined text-[16px] ml-1">chevron_right</span>
</div>
</Link>
</div>
</div>
</section>

<section className="w-full bg-primary text-on-primary py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col lg:flex-row items-center justify-between gap-space-xl">
<div className="space-y-2 text-center lg:text-left">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed font-semibold">{t("svc_marketing.immediate_maritime_exposure")}</span>
<h2 className="font-headline-lg text-headline-lg font-serif">
            {t("svc_marketing.showcase_your_vessel_with_mediterranean_cinematic")}
          </h2>
<p className="font-body-lg text-body-lg text-on-primary-container max-w-2xl">
            {t("svc_marketing.book_certified_camera_operators_and_drone")}
          </p>
</div>
<div className="flex flex-wrap items-center justify-center gap-space-md shrink-0">
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary-fixed-dim font-title-md text-title-md px-space-lg py-3 rounded-lg shadow-md transition-colors" >
            {t("svc_marketing.request_marketing_proposal")}
          </Link>
<Link href="/services/professionals/" className="inline-flex items-center justify-center bg-transparent text-on-primary hover:bg-white/10 font-title-md text-title-md px-space-lg py-3 rounded-lg transition-colors" >
            {t("svc_marketing.all_nautical_services")}
          </Link>
</div>
</div>
</div>
</section>
</div>
    </main>
  );
}
