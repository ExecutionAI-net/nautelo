import { getT } from "@/i18n/server";
import Link from "@/components/layout/LocaleLink";

export default async function ComparePage() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">
<section className="w-full bg-surface-container-low pt-space-xl pb-space-lg">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
<div>
<nav className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-space-xs">
<Link href="/boats/" className="hover:text-primary transition-colors" >{t("boats.compare.vessels")}</Link>
<span className="text-outline-variant">/</span>
<span className="text-primary font-semibold">{t("boats.compare.technical_comparison")}</span>
</nav>
<div className="flex items-baseline gap-space-md">
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{t("boats.compare.boat_comparison")}</h1>
<span className="font-label-md text-label-md px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
              {t("boats.compare.comparing_3_of_3_vessels")}
            </span>
</div>
</div>
<div className="flex items-center gap-space-sm self-start md:self-auto shrink-0">
<button className="inline-flex items-center gap-1.5 px-space-md py-space-xs rounded bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container-high transition-colors font-body-sm text-body-sm font-medium" id="toggle-diff-btn" type="button">
<span className="material-symbols-outlined text-[18px] text-secondary">tune</span>
<span id="toggle-diff-label">{t("boats.compare.highlight_differences")}</span>
</button>
<button className="inline-flex items-center gap-1.5 px-space-md py-space-xs rounded bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container-high transition-colors font-body-sm text-body-sm font-medium" type="button">
<span className="material-symbols-outlined text-[18px]">print</span>
<span>{t("boats.compare.print_specification")}</span>
</button>
<button className="inline-flex items-center gap-1.5 px-space-md py-space-xs rounded bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container-high transition-colors font-body-sm text-body-sm font-medium" type="button">
<span className="material-symbols-outlined text-[18px]">share</span>
<span id="share-btn-text">{t("boats.compare.share_sheet")}</span>
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
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold mb-space-xs">{t("boats.compare.maritime_matrix")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  {t("boats.compare.direct_structural_mechanical_and_legal_specifications")}
                </p>
<div className="mt-space-md pt-space-sm flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span>{t("boats.compare.legal_registry_verified_via_nauta_api")}</span>
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
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">{t("boats.compare.sanlorenzo")}</span>
<h2 className="font-headline-sm text-headline-sm text-primary leading-tight">{t("boats.compare.sx88")}</h2>
</div>
<button className="text-on-surface-variant hover:text-error transition-colors p-1 -mr-1" title="Remove Sanlorenzo SX88">
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<div className="mb-space-md">
<div className="font-title-lg text-title-lg text-primary font-semibold">€5,200,000</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("boats.compare.eu_vat_paid")}</span>
</div>
<div className="flex flex-col gap-space-xs mt-auto">
<Link href="/boats/" className="w-full text-center bg-primary-container hover:bg-primary text-on-primary py-2 px-space-md rounded font-body-sm text-body-sm font-medium transition-colors shadow-sm" >
                    {t("boats.compare.view_listing")}
                  </Link>
<button className="w-full text-center text-on-surface-variant hover:text-error py-1.5 font-label-md text-label-md transition-colors flex items-center justify-center gap-1">
<span className="material-symbols-outlined text-[15px]">delete</span>
<span>{t("boats.compare.remove")}</span>
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
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">{t("boats.compare.arcadia")}</span>
<h2 className="font-headline-sm text-headline-sm text-primary leading-tight">{t("boats.compare.sherpa_80")}</h2>
</div>
<button className="text-on-surface-variant hover:text-error transition-colors p-1 -mr-1" title="Remove Arcadia Sherpa 80">
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<div className="mb-space-md">
<div className="font-title-lg text-title-lg text-primary font-semibold">€4,150,000</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("boats.compare.excl_vat")}</span>
</div>
<div className="flex flex-col gap-space-xs mt-auto">
<Link href="/boats/" className="w-full text-center bg-primary-container hover:bg-primary text-on-primary py-2 px-space-md rounded font-body-sm text-body-sm font-medium transition-colors shadow-sm" >
                    {t("boats.compare.view_listing")}
                  </Link>
<button className="w-full text-center text-on-surface-variant hover:text-error py-1.5 font-label-md text-label-md transition-colors flex items-center justify-center gap-1">
<span className="material-symbols-outlined text-[15px]">delete</span>
<span>{t("boats.compare.remove")}</span>
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
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">{t("boats.compare.princess")}</span>
<h2 className="font-headline-sm text-headline-sm text-primary leading-tight">Y85</h2>
</div>
<button className="text-on-surface-variant hover:text-error transition-colors p-1 -mr-1" title="Remove Princess Y85">
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<div className="mb-space-md">
<div className="font-title-lg text-title-lg text-primary font-semibold">€5,450,000</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("boats.compare.eu_vat_paid")}</span>
</div>
<div className="flex flex-col gap-space-xs mt-auto">
<Link href="/boats/" className="w-full text-center bg-primary-container hover:bg-primary text-on-primary py-2 px-space-md rounded font-body-sm text-body-sm font-medium transition-colors shadow-sm" >
                    {t("boats.compare.view_listing")}
                  </Link>
<button className="w-full text-center text-on-surface-variant hover:text-error py-1.5 font-label-md text-label-md transition-colors flex items-center justify-center gap-1">
<span className="material-symbols-outlined text-[15px]">delete</span>
<span>{t("boats.compare.remove")}</span>
</button>
</div>
</div>
</div>
</div>

<div className="flex flex-col mt-space-md">

<div className="w-full py-space-sm px-space-md bg-surface-container rounded font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold mb-1">
              {t("boats.compare.dimensions_hull_architecture")}
            </div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">calendar_today</span>
<span>{t("boats.compare.year_of_build")}</span>
</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface font-semibold">2021</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface font-semibold">2020</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface font-semibold">2021</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">straighten</span>
<span>{t("boats.compare.length_overall_loa")}</span>
</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">26.70 m <span className="text-on-surface-variant font-body-sm">{t("boats.compare.87_ft_7_in")}</span></div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">24.00 m <span className="text-on-surface-variant font-body-sm">{t("boats.compare.78_ft_9_in")}</span></div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">26.20 m <span className="text-on-surface-variant font-body-sm">{t("boats.compare.86_ft_0_in")}</span></div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">arrows_outward</span>
<span>{t("boats.compare.maximum_beam")}</span>
</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">7.20 m</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">6.95 m</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">6.30 m</div>
</div>

<div className="grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium">{t("boats.compare.beam_ratio_stability")}</div>
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
              {t("boats.compare.propulsion_engineering")}
            </div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">settings</span>
<span>{t("boats.compare.engine_configuration")}</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.3x_volvo_penta_ips_1050")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.2x_volvo_penta_ips_800")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.2x_twin_man_v12_1900_hp")}</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">bolt</span>
<span>{t("boats.compare.total_output")}</span>
</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">{t("boats.compare.2_400_hp")}</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">{t("boats.compare.1_600_hp")}</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">{t("boats.compare.3_800_hp")}</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">schedule</span>
<span>{t("boats.compare.engine_hours")}</span>
</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">{t("boats.compare.420_hrs")}</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">{t("boats.compare.310_hrs")}</div>
<div className="col-span-3 font-spec-num text-spec-num text-on-surface">{t("boats.compare.550_hrs")}</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm" data-diff="false">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">local_gas_station</span>
<span>{t("boats.compare.fuel_type")}</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.diesel")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.diesel")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.diesel")}</div>
</div>

<div className="w-full py-space-sm px-space-md bg-surface-container rounded font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold mt-space-md mb-1">
              {t("boats.compare.accommodation_living_spaces")}
            </div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">bed</span>
<span>{t("boats.compare.guest_cabins")}</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface font-semibold">{t("boats.compare.4_cabins_8_guests")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface font-semibold">{t("boats.compare.3_cabins_6_guests")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface font-semibold">{t("boats.compare.4_cabins_8_guests")}</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">shower</span>
<span>{t("boats.compare.bathrooms_heads")}</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.4_en_suite_1_day_head")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.3_en_suite")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.4_en_suite")}</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">group</span>
<span>{t("boats.compare.crew_berths")}</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.2_cabins_3_crew")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.1_cabin_2_crew")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.2_cabins_3_crew")}</div>
</div>

<div className="w-full py-space-sm px-space-md bg-surface-container rounded font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold mt-space-md mb-1">
              {t("boats.compare.registry_berth_representation")}
            </div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">pin_drop</span>
<span>{t("boats.compare.current_mooring_location")}</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.palma_de_mallorca_es")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.capri_marina_grande_it")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.ibiza_marina_botafoch_es")}</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-low transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">verified_user</span>
<span>{t("boats.compare.representation_seller_type")}</span>
</div>
<div className="col-span-3">
<span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-on-surface font-body-sm text-body-sm font-medium">
                  {t("boats.compare.professional_broker_exclusive")}
                </span>
</div>
<div className="col-span-3">
<span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-on-surface font-body-sm text-body-sm font-medium">
                  {t("boats.compare.professional_broker_central")}
                </span>
</div>
<div className="col-span-3">
<span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-container text-on-surface font-body-sm text-body-sm font-medium">
                  {t("boats.compare.private_seller")}
                </span>
</div>
</div>

<div className="spec-row grid grid-cols-12 gap-gutter-desktop items-center py-space-sm px-space-md bg-surface-container-lowest transition-colors rounded-sm" data-diff="true">
<div className="col-span-3 font-body-sm text-body-sm text-on-surface-variant font-medium flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-secondary">flag</span>
<span>{t("boats.compare.flag_state")}</span>
</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.spain_lista_6a")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.italy_registro_naviglio")}</div>
<div className="col-span-3 font-body-md text-body-md text-on-surface">{t("boats.compare.malta_commercial")}</div>
</div>

<div className="grid grid-cols-12 gap-gutter-desktop items-center pt-space-xl pb-space-md">
<div className="col-span-3 flex flex-col justify-center">
<span className="font-title-md text-title-md text-primary">{t("boats.compare.inquiry_survey")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">{t("boats.compare.request_surveyor_records_or_arrange_dockside")}</span>
</div>
<div className="col-span-3">
<Link href="/contact/" className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-on-primary py-2.5 px-space-md rounded shadow-sm hover:bg-primary-container transition-colors font-body-sm text-body-sm font-semibold" >
<span>{t("boats.compare.contact_broker")}</span>
<span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</Link>
</div>
<div className="col-span-3">
<Link href="/contact/" className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-on-primary py-2.5 px-space-md rounded shadow-sm hover:bg-primary-container transition-colors font-body-sm text-body-sm font-semibold" >
<span>{t("boats.compare.contact_broker")}</span>
<span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</Link>
</div>
<div className="col-span-3">
<Link href="/contact/" className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-on-primary py-2.5 px-space-md rounded shadow-sm hover:bg-primary-container transition-colors font-body-sm text-body-sm font-semibold" >
<span>{t("boats.compare.contact_owner")}</span>
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
<span className="font-body-md text-body-md text-primary font-medium">{t("boats.compare.comparison_slot_open_browse_our_mediterranean")}</span>
</div>
<Link href="/boats/" className="inline-flex items-center gap-1 px-space-md py-1.5 rounded bg-primary text-on-primary font-body-sm text-body-sm hover:bg-primary-container transition-colors" >
<span>{t("boats.compare.browse_inventory")}</span>
<span className="material-symbols-outlined text-[16px]">chevron_right</span>
</Link>
</div>
</div>
</div>

    </main>
  );
}
