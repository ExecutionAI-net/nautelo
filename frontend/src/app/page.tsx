import HomeSearch from "@/components/listings/HomeSearch";
import FinanceSection from "@/components/finance/FinanceSection";
import FeaturedSlider from "@/components/listings/FeaturedSlider";
import { getT } from "@/i18n/server";
import { getRequestLocale } from "@/lib/i18n/requestLocale";
import Link from "@/components/layout/LocaleLink";

import BoatCard from "@/components/listings/BoatCard";
import AdLink from "@/components/content/AdLink";
import { fetchAds } from "@/lib/api/contentServer";
import { fetchListingFacets, fetchPublishedListings, type PublicListing } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

async function featured(): Promise<PublicListing[]> {
  try {
    const page = await fetchPublishedListings({ featured: "1", sort: "featured", page_size: "12" });
    return page?.results ?? [];
  } catch {
    return [];
  }
}

async function latest(): Promise<PublicListing[]> {
  try {
    const page = await fetchPublishedListings({ page_size: "4" });
    return page?.results ?? [];
  } catch {
    // The home page must render even when the catalogue is unavailable.
    return [];
  }
}

export default async function Home() {
  const locale = await getRequestLocale();
  const t = await getT();
  const [promoted, newest, facets, [ad, banner]] = await Promise.all([featured(), latest(), fetchListingFacets(), fetchAds("HOME")]);
  // Paid promotions first; until there are any, the newest boats keep the strip from being empty.
  const showingPromoted = promoted.length > 0;
  const boats = showingPromoted ? promoted : newest;
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="relative w-full overflow-hidden bg-surface-container-low pb-space-2xl pt-space-xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">

<div className="lg:col-span-8 flex flex-col">
<div className="mb-space-md flex items-center gap-space-xs">
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">{t("home.eyebrow")}</span>
</div>
<h1 className="font-display-hero text-headline-lg-mobile md:text-display-hero text-primary tracking-tight mb-space-sm max-w-2xl">
            {t("home.title")}
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mb-space-xl">
            {t("home.intro")}
          </p>

<HomeSearch boatTypes={facets.boat_types ?? []} locations={facets.locations ?? []} />
</div>

<div className="lg:col-span-4 w-full h-full flex flex-col justify-start">
{ad ? (
<div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col">
<div className="flex items-center justify-between pb-space-xs mb-space-sm">
<span className="font-label-sm text-label-sm text-outline tracking-widest uppercase">{t("home.ad_label")}</span>
</div>
<div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-space-md group bg-surface-container-high">
{ad.image_url ? (
// eslint-disable-next-line @next/next/no-img-element -- sponsor image, size unknown
<img alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src={ad.image_url}/>
) : null}
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex flex-col justify-end p-space-md">
<span className="font-label-sm text-label-sm text-tertiary-fixed tracking-wider uppercase">{t("home.verified_partner")}</span>
<span className="font-title-lg text-title-lg text-on-primary font-serif">{ad.sponsor}</span>
</div>
</div>
<div className="flex flex-col">
<h2 className="font-headline-sm text-headline-sm text-primary mb-1">{ad.headline}</h2>
{ad.body ? <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">{ad.body}</p> : null}
{ad.cta_url && ad.cta_label ? <AdLink ad={ad} /> : null}
</div>
</div>
) : null}
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex flex-col">
<div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-sm">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-1">{t("home.handpicked")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">{showingPromoted ? t("home.featured") : t("home.latest")}</h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          {t("home.latest_intro")}
        </p>
</div>

<div className="mb-space-xl">
{boats.length > 0 ? (
<FeaturedSlider label={showingPromoted ? t("home.featured") : t("home.latest")}>
{boats.map((listing) => (
<BoatCard key={listing.id} t={t} locale={locale} listing={listing} disclaimerId="finance-disclaimer" />
))}
</FeaturedSlider>
) : <p className="font-body-md text-on-surface-variant">{t("home.no_boats")}</p>}
</div>
<div className="flex justify-center">
<Link className="inline-flex items-center gap-space-xs bg-primary hover:bg-primary-container text-on-primary py-space-sm px-space-xl rounded-lg font-title-md text-title-md transition-colors shadow-sm" href="/boats/">
          {t("home.view_all_boats")}
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
</Link>
</div>
</div>
</section>

<FinanceSection />

{banner ? (
<section className="w-full bg-surface-container-low py-space-lg">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-lg">
<div className="flex flex-col">
<div className="flex items-center gap-2 mb-1">
<span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">{t("home.ad_label")}</span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="font-label-sm text-label-sm text-secondary">{banner.sponsor}</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary font-serif">{banner.headline}</h3>
{banner.body ? <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">{banner.body}</p> : null}
</div>
{banner.cta_url && banner.cta_label ? (
<div className="shrink-0">
<AdLink
ad={banner}
className="inline-flex items-center gap-space-xs px-space-lg py-2.5 rounded-lg bg-primary-container text-on-primary hover:bg-primary transition-all font-label-md text-label-md"
/>
</div>
) : null}
</div>
</div>
</section>
) : null}

<section className="w-full py-space-2xl bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="mb-space-xl">
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-1">{t("home.fleet_eyebrow")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">{t("home.fleet_title")}</h2>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/6e536ead8f.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">{t("home.motor_yachts")}</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              {t("home.explore_fleet")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/65a3e00779.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">{t("home.sailing_yachts")}</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              {t("home.explore_fleet")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/4bbd1b22fd.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">{t("home.catamarans")}</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              {t("home.explore_fleet")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/b8ac8c0656.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">{t("home.motorboats")}</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              {t("home.explore_fleet")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/aedafbad9f.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">{t("home.ribs")}</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              {t("home.explore_fleet")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/b4697fc49d.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">{t("home.fishing_boats")}</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              {t("home.explore_fleet")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface-container-low">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-sm">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-1">{t("home.eco_eyebrow")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">{t("home.eco_title")}</h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          {t("home.eco_intro")}
        </p>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg mb-space-xl">

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">handshake</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">{t("home.svc_brokerage")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              {t("home.svc_brokerage_text")}
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            {t("home.view_service")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">gavel</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">{t("home.svc_legal")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              {t("home.svc_legal_text")}
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            {t("home.view_service")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">verified_user</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">{t("home.svc_insurance")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              {t("home.svc_insurance_text")}
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            {t("home.view_service")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">build</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">{t("home.svc_engines")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              {t("home.svc_engines_text")}
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            {t("home.view_service")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">local_shipping</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">{t("home.svc_transport")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              {t("home.svc_transport_text")}
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            {t("home.view_service")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">photo_camera</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">{t("home.svc_marketing")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              {t("home.svc_marketing_text")}
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            {t("home.view_service")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>
</div>
<div className="flex justify-center">
<Link className="inline-flex items-center gap-space-xs bg-primary hover:bg-primary-container text-on-primary py-space-sm px-space-xl rounded-lg font-title-md text-title-md transition-colors shadow-sm" href="/services/professionals/">
          {t("home.view_all_services")}
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
</Link>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-lg">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-low rounded-xl p-space-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-lg">
<div className="flex flex-col">
<div className="flex items-center gap-2 mb-1">
<span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">{t("home.ad_label")}</span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="font-label-sm text-label-sm text-secondary">Precision Marine Tech</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary font-serif">NaviTech Marine — Radar, Sonar &amp; Marine Electronics</h3>
<p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
            Next-generation solid-state doppler radars, real-time depth profiling, and seamless NMEA 2000 multi-station navigation suites fitted by certified technicians.
          </p>
</div>
<div className="shrink-0">
<Link className="inline-flex items-center gap-space-xs px-space-lg py-2.5 rounded-lg bg-primary-container text-on-primary hover:bg-primary transition-all font-label-md text-label-md" href="/services/professionals/">
            Discover Electronics Suites
            <span className="material-symbols-outlined text-[18px]">satellite_alt</span>
</Link>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface-container-low">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="text-center max-w-2xl mx-auto mb-space-xl">
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-1">{t("home.sell_eyebrow")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">{t("home.sell_title")}</h2>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-space-xl max-w-4xl mx-auto">

<div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between">
<div>
<div className="inline-block px-2.5 py-1 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant mb-space-md uppercase">
              {t("home.direct_sale")}
            </div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-sm">{t("home.list_myself")}</h3>
<ul className="flex flex-col gap-space-sm mb-space-xl">
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>{t("home.for_private_owners")}</span>
</li>
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>{t("home.create_manage")}</span>
</li>
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>{t("home.receive_enquiries")}</span>
</li>
</ul>
</div>
<Link className="w-full py-2.5 px-space-md rounded-lg bg-primary hover:bg-primary-container text-on-primary text-center font-title-md text-title-md transition-colors shadow-sm" href="/sell/">
            {t("home.list_my_boat")}
          </Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between">
<div>
<div className="inline-block px-2.5 py-1 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant mb-space-md uppercase">
              {t("home.assisted")}
            </div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-sm">{t("home.sell_with_broker")}</h3>
<ul className="flex flex-col gap-space-sm mb-space-xl">
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>{t("home.for_pro_support")}</span>
</li>
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>{t("home.broker_manages")}</span>
</li>
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>{t("home.commercial_proposal")}</span>
</li>
</ul>
</div>
<Link className="w-full py-2.5 px-space-md rounded-lg bg-primary hover:bg-primary-container text-on-primary text-center font-title-md text-title-md transition-colors shadow-sm" href="/brokers/">
            {t("home.find_broker")}
          </Link>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-sm">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-1">{t("home.guides_eyebrow")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">{t("home.guides_title")}</h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          {t("home.guides_intro")}
        </p>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg mb-space-xl">

<article className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
<div className="relative w-full aspect-[16/10] overflow-hidden">
<img alt="" className="w-full h-full object-cover" src="/design/ce28c27afe.jpg"/>
</div>
<div className="p-space-lg flex flex-col flex-1 justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block mb-2">{t("home.guide_legal_tag")}</span>
<h3 className="font-title-lg text-title-lg text-primary mb-2 leading-snug">{t("home.guide_legal_title")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                {t("home.guide_legal_text")}
              </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/guides/">
              {t("home.read_guide")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
<div className="relative w-full aspect-[16/10] overflow-hidden">
<img alt="" className="w-full h-full object-cover" src="/design/68be5c8e30.jpg"/>
</div>
<div className="p-space-lg flex flex-col flex-1 justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block mb-2">{t("home.guide_maint_tag")}</span>
<h3 className="font-title-lg text-title-lg text-primary mb-2 leading-snug">{t("home.guide_maint_title")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                {t("home.guide_maint_text")}
              </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/guides/">
              {t("home.read_guide")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
<div className="relative w-full aspect-[16/10] overflow-hidden">
<img alt="" className="w-full h-full object-cover" src="/design/83d5b58468.jpg"/>
</div>
<div className="p-space-lg flex flex-col flex-1 justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block mb-2">{t("home.guide_buyer_tag")}</span>
<h3 className="font-title-lg text-title-lg text-primary mb-2 leading-snug">{t("home.guide_buyer_title")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                {t("home.guide_buyer_text")}
              </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/guides/">
              {t("home.read_guide")} <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>
</article>
</div>
<div className="flex justify-center">
<Link className="inline-flex items-center gap-space-xs bg-primary hover:bg-primary-container text-on-primary py-space-sm px-space-xl rounded-lg font-title-md text-title-md transition-colors shadow-sm" href="/guides/">
          {t("home.view_all_guides")}
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
</Link>
</div>
</div>
</section>


</div>
    </main>
  );
}
