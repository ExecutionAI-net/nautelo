import { getT } from "@/i18n/server";
import ContactRequestForm from "@/components/contact/ContactRequestForm";
import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("contact.meta_title"), description: t("contact.meta_description") };
}

export default async function ContactPage() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<div className="relative w-full overflow-hidden">
<div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1100px] h-72 bg-gradient-to-b from-secondary-fixed/30 via-surface-container-low/50 to-transparent blur-3xl pointer-events-none -z-10"></div>
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop pt-space-md pb-space-2xl">

<nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant mb-space-lg">
<Link href="/" className="hover:text-primary transition-colors flex items-center gap-1" >
<span className="material-symbols-outlined text-[16px] text-outline">sailing</span>
<span>{t("contact.page.home")}</span>
</Link>
<span className="text-outline-variant">/</span>
<span className="text-primary font-medium">{t("contact.page.contact")}</span>
</nav>

<div className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg pb-space-xl border-b-0">
<div className="max-w-3xl">
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm tracking-wider uppercase mb-space-sm shadow-sm">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            {t("contact.page.maritime_advisory_platform_desk")}
          </div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-display-hero">
            {t("contact.page.contact_nauta")}
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs leading-relaxed max-w-2xl">
            {t("contact.page.reach_our_maritime_transaction_coordinators_certified")}
          </p>
</div>

<div className="flex flex-col sm:flex-row items-start sm:items-center gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-transparent">
<div className="flex items-center gap-3">
<div className="relative flex h-3 w-3">
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
<span className="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
</div>
<div>
<div className="font-title-md text-title-md text-primary leading-tight">{t("contact.page.desks_in_three_ports")}</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">{t("contact.page.palma_genoa_barcelona")}</div>
</div>
</div>
<div className="h-8 w-px bg-surface-container-highest hidden sm:block"></div>
<div className="text-right">
<div className="font-label-sm text-label-sm uppercase text-outline">{t("contact.page.reply_time")}</div>
<div className="font-spec-num text-spec-num text-primary">{t("contact.page.usually_one_working_day")}</div>
</div>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl mt-space-xl items-start">

<div className="lg:col-span-7 flex flex-col gap-space-lg">
<div className="bg-surface-container-lowest rounded-xl p-space-lg lg:p-space-xl shadow-md relative">
<div className="flex items-center justify-between pb-space-md">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">{t("contact.page.direct_maritime_dossier")}</span>
<h2 className="font-headline-sm text-headline-sm text-primary mt-1">{t("contact.page.submit_an_official_inquiry")}</h2>
</div>
<div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary-container">
<span className="material-symbols-outlined text-[22px]">assignment_turned_in</span>
</div>
</div>
<ContactRequestForm />
</div>
</div>

<div className="lg:col-span-5 flex flex-col gap-space-lg">

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
<div className="flex items-center justify-between mb-space-md pb-space-xs border-b border-surface-container">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-outline">{t("contact.page.direct_desks")}</span>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("contact.page.nautical_comms_channels")}</h3>
</div>
<div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-[18px]">headset_mic</span>
</div>
</div>

<div className="space-y-space-md">
<div>
<div className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-2">{t("contact.page.telephone_hotlines")}</div>
<div className="space-y-2.5">
<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2.5">
<span className="w-6 h-4 inline-flex items-center justify-center font-label-sm text-primary font-bold bg-surface-container-highest rounded-sm">ES</span>
<div>
<div className="font-title-md text-body-md text-primary">{t("contact.page.spanish_maritime_operations")}</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">{t("contact.page.palma_de_mallorca_barcelona_hubs")}</div>
</div>
</div>
<Link href="#contact-form" className="font-label-md text-label-md text-secondary hover:text-primary font-semibold flex items-center gap-1" >
                      {t("contact.page.use_the_form")}
                    </Link>
</div>
<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2.5">
<span className="w-6 h-4 inline-flex items-center justify-center font-label-sm text-primary font-bold bg-surface-container-highest rounded-sm">IT</span>
<div>
<div className="font-title-md text-body-md text-primary">{t("contact.page.italian_maritime_operations")}</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">{t("contact.page.genoa_liguria_naples_hubs")}</div>
</div>
</div>
<Link href="#contact-form" className="font-label-md text-label-md text-secondary hover:text-primary font-semibold flex items-center gap-1" >
                      {t("contact.page.use_the_form")}
                    </Link>
</div>
<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2.5">
<span className="w-6 h-4 inline-flex items-center justify-center font-label-sm text-primary font-bold bg-surface-container-highest rounded-sm">EU</span>
<div>
<div className="font-title-md text-body-md text-primary">{t("contact.page.international_broker_relations")}</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">{t("contact.page.cross_border_flag_transfers")}</div>
</div>
</div>
<Link href="#contact-form" className="font-label-md text-label-md text-secondary hover:text-primary font-semibold flex items-center gap-1" >
                      {t("contact.page.use_the_form")}
                    </Link>
</div>
</div>
</div>

<div className="pt-2">
<div className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-2">{t("contact.page.dedicated_department_emails")}</div>
<div className="grid grid-cols-1 gap-2">
<Link href="#contact-form" className="flex items-center justify-between p-2 rounded hover:bg-surface-container-low transition-colors group" >
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary transition-colors">mail</span>
<span className="font-body-md text-body-md text-primary">{t("contact.page.general_support_listings")}</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-primary transition-colors">{t("contact.page.use_the_form")}</span>
</Link>
<Link href="#contact-form" className="flex items-center justify-between p-2 rounded hover:bg-surface-container-low transition-colors group" >
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary transition-colors">domain</span>
<span className="font-body-md text-body-md text-primary">{t("contact.page.broker_yard_verification")}</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-primary transition-colors">{t("contact.page.use_the_form")}</span>
</Link>
<Link href="#contact-form" className="flex items-center justify-between p-2 rounded hover:bg-surface-container-low transition-colors group" >
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary transition-colors">gavel</span>
<span className="font-body-md text-body-md text-primary">{t("contact.page.legal_tax_desk")}</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-primary transition-colors">{t("contact.page.use_the_form")}</span>
</Link>
</div>
</div>

<div className="p-space-md rounded bg-surface-container-low flex flex-col gap-2">
<div className="flex items-center justify-between font-label-md text-label-md text-primary">
<span className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">pace</span>
                    {t("contact.page.central_european_maritime_hours_cet")}
                  </span>
<span className="text-secondary font-semibold">{t("contact.page.utc_1")}</span>
</div>
<div className="space-y-1 font-body-sm text-body-sm text-on-surface-variant">
<div className="flex justify-between">
<span>{t("contact.page.monday_friday")}</span>
<span className="font-medium text-primary">{t("contact.page.08_30_19_00_cet")}</span>
</div>
<div className="flex justify-between">
<span>{t("contact.page.saturday")}</span>
<span className="font-medium text-primary">{t("contact.page.09_00_13_00_cet")}</span>
</div>
<div className="flex justify-between text-outline">
<span>{t("contact.page.sunday")}</span>
<span>{t("contact.page.closed")}</span>
</div>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-outline">{t("contact.page.maritime_footprint")}</span>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("contact.page.regional_operations_hubs")}</h3>
</div>

<div className="relative w-full h-48 rounded-lg overflow-hidden group">
<div className="w-full h-full bg-cover bg-center" style={{"backgroundImage": "url('https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg')"}}></div>

<div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] p-3 flex flex-col justify-between pointer-events-none">
<div className="flex justify-between items-start">
<span className="px-2 py-1 rounded bg-primary text-on-primary font-label-sm text-label-sm uppercase">{t("contact.page.nauta_western_med_operational_basin")}</span>
<span className="px-2 py-1 rounded bg-surface-container-lowest/90 text-primary font-label-sm text-label-sm shadow-sm">{t("contact.page.3_port_desks")}</span>
</div>

<div className="flex justify-around items-center px-4">
<div className="flex flex-col items-center">
<span className="w-3 h-3 rounded-full bg-secondary ring-4 ring-white shadow-md animate-pulse"></span>
<span className="mt-1 px-1.5 py-0.5 rounded bg-primary/90 text-on-primary font-label-sm text-[10px]">{t("contact.page.barcelona")}</span>
</div>
<div className="flex flex-col items-center -translate-y-2">
<span className="w-3 h-3 rounded-full bg-secondary ring-4 ring-white shadow-md animate-pulse"></span>
<span className="mt-1 px-1.5 py-0.5 rounded bg-primary/90 text-on-primary font-label-sm text-[10px]">{t("contact.page.palma")}</span>
</div>
<div className="flex flex-col items-center translate-x-4">
<span className="w-3 h-3 rounded-full bg-secondary ring-4 ring-white shadow-md animate-pulse"></span>
<span className="mt-1 px-1.5 py-0.5 rounded bg-primary/90 text-on-primary font-label-sm text-[10px]">{t("contact.page.genoa")}</span>
</div>
</div>
</div>
</div>

<div className="space-y-3 divide-y divide-surface-container">

<div className="pt-2 flex items-start gap-3">
<div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">anchor</span>
</div>
<div>
<div className="font-title-md text-title-md text-primary">{t("contact.page.palma_de_mallorca_desk")}</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    {t("contact.page.moll_vell_muelle_de_levante_edificio")}
                  </p>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">{t("contact.page.flag_registry_balearic_sea_trials")}</span>
</div>
</div>

<div className="pt-3 flex items-start gap-3">
<div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">sailing</span>
</div>
<div>
<div className="font-title-md text-title-md text-primary">{t("contact.page.genoa_maritime_desk")}</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    {t("contact.page.marina_porto_antico_calata_molo_vecchio")}
                  </p>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">{t("contact.page.tirreno_brokerage_rina_survey_liaison")}</span>
</div>
</div>

<div className="pt-3 flex items-start gap-3">
<div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">architecture</span>
</div>
<div>
<div className="font-title-md text-title-md text-primary">{t("contact.page.barcelona_refit_legal_desk")}</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    {t("contact.page.marina_port_vell_moll_del_diposit")}
                  </p>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">{t("contact.page.technical_support_superyacht_transit")}</span>
</div>
</div>
</div>
</div>

<div className="p-space-md rounded bg-surface-container-low border border-dashed border-outline-variant flex items-center justify-between gap-space-md">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-outline block mb-1">{t("contact.page.advertisement")}</span>
<div className="font-headline-sm text-headline-sm text-primary font-serif">{t("contact.page.tirreno_marine_chronometers")}</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("contact.page.official_timepieces_calibrated_for_mediterranean_offshore")}</p>
</div>
<Link href="/contact/" className="shrink-0 px-3 py-2 rounded bg-surface-container-lowest text-primary hover:bg-surface-container-high font-label-md text-label-md transition-colors shadow-sm" >
              {t("contact.page.explore_collection")}
            </Link>
</div>
</div>
</div>

<div className="mt-space-2xl pt-space-xl">
<div className="max-w-2xl mb-space-lg">
<div className="inline-flex items-center gap-2 font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
<span>{t("contact.page.maritime_transaction_support")}</span>
</div>
<h2 className="font-headline-lg text-headline-lg text-primary mt-1">{t("contact.page.frequently_addressed_queries")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {t("contact.page.immediate_guidance_on_brokerage_licensing_flag")}
          </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[20px]">verified_user</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">
                {t("contact.page.how_do_i_check_that_a")}
              </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {t("contact.page.nauta_reviews_every_broker_and_professional")}
              </p>
</div>
<div className="mt-space-md pt-space-sm border-t border-surface-container">
<Link href="/contact/" className="font-label-md text-label-md text-secondary hover:underline flex items-center gap-1" >
<span>{t("contact.page.view_certified_broker_registry")}</span>
<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</Link>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[20px]">flag</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">
                {t("contact.page.can_nauta_assist_with_foreign_to")}
              </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {t("contact.page.yes_our_maritime_legal_desks_in")}
              </p>
</div>
<div className="mt-space-md pt-space-sm border-t border-surface-container">
<Link href="/contact/" className="font-label-md text-label-md text-secondary hover:underline flex items-center gap-1" >
<span>{t("contact.page.flag_registration_guidelines")}</span>
<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</Link>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[20px]">price_check</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">
                {t("contact.page.what_is_the_fee_structure_for")}
              </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {t("contact.page.direct_private_vessel_listings_up_to")}
              </p>
</div>
<div className="mt-space-md pt-space-sm border-t border-surface-container">
<Link href="/contact/" className="font-label-md text-label-md text-secondary hover:underline flex items-center gap-1" >
<span>{t("contact.page.brokerage_commission_structure")}</span>
<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
</Link>
</div>
</div>
</div>
</div>

<div className="mt-space-2xl p-space-lg rounded-xl bg-surface-container flex flex-col md:flex-row items-center justify-between gap-space-md">
<div className="flex items-center gap-space-md">
<div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0">
<span className="material-symbols-outlined text-[26px]">shield_with_heart</span>
</div>
<div>
<div className="font-title-lg text-title-lg text-primary">{t("contact.page.a_marketplace_not_a_payment_desk")}</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">
              {t("contact.page.nauta_is_a_marketplace_we_connect")}
            </p>
</div>
</div>
<div className="flex items-center gap-space-lg shrink-0 text-on-surface-variant font-label-md text-label-md">
<span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary"></span>{t("contact.page.iso_27001_secure")}</span>

<span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary"></span>{t("contact.page.anen_ucina_aligned")}</span>
</div>
</div>
</div>
</div>
</div>
    </main>
  );
}
