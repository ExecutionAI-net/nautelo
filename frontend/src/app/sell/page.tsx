import { getT } from "@/i18n/server";
import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("sell.page.meta_title"), description: t("sell.page.meta_description") };
}

export default async function SellLanding() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="w-full bg-surface pt-space-xl pb-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-end">
<div className="lg:col-span-8 flex flex-col gap-space-sm">
<div className="inline-flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">{t("sell.page.maritime_brokerage_direct_listing")}</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{t("sell.page.sell_your_boat_with_nauta")}</h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mt-space-xs">
            {t("sell.page.choose_the_right_path_to_market")}
          </p>
</div>
<div className="lg:col-span-4 flex lg:justify-end items-center gap-space-md pt-space-sm lg:pt-0">
<div className="bg-surface-container-low px-space-md py-space-sm rounded-lg flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary">anchor</span>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant">{t("sell.page.main_sailing_areas")}</span>
<span className="font-title-md text-title-md text-primary font-medium">{t("sell.page.balearics_liguria_tyrrhenian_sea")}</span>
</div>
</div>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mt-space-xl">
<div className="relative h-48 md:h-56 rounded-xl overflow-hidden shadow-sm">
<img alt="" fetchPriority="high" className="w-full h-full object-cover" src="/design/2ea59788a7.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex items-end p-space-md">
<span className="font-label-md text-label-md text-on-primary tracking-wide">{t("sell.page.sell_it_yourself")}</span>
</div>
</div>
<div className="relative h-48 md:h-56 rounded-xl overflow-hidden shadow-sm">
<img alt="" className="w-full h-full object-cover" src="/design/6105378ad2.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex items-end p-space-md">
<span className="font-label-md text-label-md text-on-primary tracking-wide">{t("sell.page.or_let_a_broker_do_it")}</span>
</div>
</div>
<div className="relative h-48 md:h-56 rounded-xl overflow-hidden shadow-sm">
<img alt="" className="w-full h-full object-cover" src="/design/4380ad7d78.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex items-end p-space-md">
<span className="font-label-md text-label-md text-on-primary tracking-wide">{t("sell.page.buyers_in_spain_italy_and_beyond")}</span>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-xl mx-auto text-center mb-space-xl">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">{t("sell.page.structured_options")}</span>
<h2 className="font-headline-md text-headline-md text-primary mt-space-xs">{t("sell.page.select_your_representation_mode")}</h2>
</div>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">

<div className="bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
<div className="flex flex-col">
<div className="flex items-center justify-between pb-space-md">
<div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[28px]">tune</span>
</div>
<span className="inline-flex items-center px-space-sm py-0.5 rounded-full bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                {t("sell.page.direct_seller")}
              </span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mt-space-sm">{t("sell.page.list_it_myself")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
              {t("sell.page.for_private_boat_owners_seeking_direct")}
            </p>

<div className="flex flex-col gap-space-md my-space-lg">
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">{t("sell.page.create_and_manage_the_listing_with")}</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">{t("sell.page.upload_high_resolution_photos_videos_and")}</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">{t("sell.page.receive_enquiries_directly_from_qualified_private")}</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">{t("sell.page.manage_listing_visibility_and_status_from")}</span>
</div>
</div>
</div>
<div className="pt-space-md flex flex-col gap-space-xs">
<Link href="/sell/create/" className="w-full inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container font-title-md text-title-md py-space-sm px-space-md rounded-lg transition-colors shadow-sm" >
              {t("sell.page.create_my_listing")}
            </Link>
<span className="font-label-sm text-label-sm text-center text-outline">{t("sell.page.self_serve_listing_editor_with_direct")}</span>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
<div className="flex flex-col">
<div className="flex items-center justify-between pb-space-md">
<div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-[28px]">handshake</span>
</div>
<span className="inline-flex items-center px-space-sm py-0.5 rounded-full bg-secondary/10 font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider">
                {t("sell.page.managed_brokerage")}
              </span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mt-space-sm">{t("sell.page.sell_with_a_broker")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
              {t("sell.page.for_owners_who_prefer_end_to")}
            </p>

<div className="flex flex-col gap-space-md my-space-lg">
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">{t("sell.page.send_basic_boat_information_to_verified")}</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">{t("sell.page.a_licensed_broker_evaluates_your_vessel")}</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">{t("sell.page.professional_sea_trials_surveys_and_negotiations")}</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">{t("sell.page.service_subject_to_a_commercial_proposal")}</span>
</div>
</div>
</div>
<div className="pt-space-md flex flex-col gap-space-xs">
<Link href="/brokers/" className="w-full inline-flex items-center justify-center bg-transparent text-primary hover:bg-surface-container-low font-title-md text-title-md py-space-sm px-space-md rounded-lg shadow-sm transition-colors" >
              {t("sell.page.request_contact_from_a_broker")}
            </Link>
<span className="font-label-sm text-label-sm text-center text-outline">{t("sell.page.connect_with_certified_spanish_and_italian")}</span>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-low rounded-xl p-space-md md:p-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<span className="font-label-sm text-label-sm uppercase text-outline font-semibold tracking-wider">{t("sell.page.advertisement")}</span>
<span className="font-headline-sm text-headline-sm text-primary">{t("sell.page.baleares_yacht_transport")}</span>
<p className="font-body-sm text-body-sm text-on-surface-variant max-w-xl">
            {t("sell.page.insured_logistical_transport_and_skippered_delivery")}
          </p>
</div>
<Link href="/services/professionals/transport-delivery/" className="inline-flex items-center gap-space-xs font-title-md text-title-md text-secondary hover:text-primary transition-colors shrink-0" >
<span>{t("sell.page.inquire_logistics")}</span>
<span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
</div>
</div>
</section>

<section className="w-full bg-surface pb-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mx-auto">
<div className="flex flex-col items-center text-center mb-space-xl">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">{t("sell.page.clarity_compliance")}</span>
<h2 className="font-headline-md text-headline-md text-primary mt-space-xs">{t("sell.page.frequently_asked_questions")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">{t("sell.page.key_information_on_mediterranean_registration_broker")}</p>
</div>
<div className="flex flex-col gap-space-md" id="faq-accordion">

<div className="faq-item bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="faq-toggle w-full px-space-lg py-space-md flex items-center justify-between text-left gap-space-md focus:outline-none" type="button">
<span className="font-title-lg text-title-lg text-primary">{t("sell.page.what_documentation_is_required_to_list")}</span>
<span className="material-symbols-outlined text-outline transition-transform duration-200 faq-icon shrink-0">expand_more</span>
</button>
<div className="faq-content px-space-lg pb-space-md text-on-surface-variant font-body-md text-body-md">
              {t("sell.page.owners_should_have_their_vessel_registration")}
            </div>
</div>

<div className="faq-item bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="faq-toggle w-full px-space-lg py-space-md flex items-center justify-between text-left gap-space-md focus:outline-none" type="button">
<span className="font-title-lg text-title-lg text-primary">{t("sell.page.how_do_enquiries_reach_me_if")}</span>
<span className="material-symbols-outlined text-outline transition-transform duration-200 faq-icon shrink-0">expand_more</span>
</button>
<div className="faq-content px-space-lg pb-space-md text-on-surface-variant font-body-md text-body-md">
              {t("sell.page.enquiries_submitted_through_your_public_listing")}
            </div>
</div>

<div className="faq-item bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="faq-toggle w-full px-space-lg py-space-md flex items-center justify-between text-left gap-space-md focus:outline-none" type="button">
<span className="font-title-lg text-title-lg text-primary">{t("sell.page.what_are_the_fees_associated_with")}</span>
<span className="material-symbols-outlined text-outline transition-transform duration-200 faq-icon shrink-0">expand_more</span>
</button>
<div className="faq-content px-space-lg pb-space-md text-on-surface-variant font-body-md text-body-md">
              {t("sell.page.brokerage_commission_typically_ranges_between_5")}
            </div>
</div>

<div className="faq-item bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="faq-toggle w-full px-space-lg py-space-md flex items-center justify-between text-left gap-space-md focus:outline-none" type="button">
<span className="font-title-lg text-title-lg text-primary">{t("sell.page.can_i_switch_from_a_private")}</span>
<span className="material-symbols-outlined text-outline transition-transform duration-200 faq-icon shrink-0">expand_more</span>
</button>
<div className="faq-content px-space-lg pb-space-md text-on-surface-variant font-body-md text-body-md">
              {t("sell.page.yes_you_can_pause_or_unpublish")}
            </div>
</div>

<div className="faq-item bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="faq-toggle w-full px-space-lg py-space-md flex items-center justify-between text-left gap-space-md focus:outline-none" type="button">
<span className="font-title-lg text-title-lg text-primary">{t("sell.page.in_which_countries_will_my_vessel")}</span>
<span className="material-symbols-outlined text-outline transition-transform duration-200 faq-icon shrink-0">expand_more</span>
</button>
<div className="faq-content px-space-lg pb-space-md text-on-surface-variant font-body-md text-body-md">
              {t("sell.page.nauta_actively_connects_buyers_across_spain")}
            </div>
</div>
</div>
</div>
</div>
</section>


</div>
    </main>
  );
}
