import { getRequestLocale } from "@/lib/i18n/requestLocale";
import Link from "next/link";

import BoatCard from "@/components/listings/BoatCard";
import AdLink from "@/components/content/AdLink";
import { fetchAds } from "@/lib/api/contentServer";
import { fetchListingFacets, fetchPublishedListings, type PublicListing } from "@/lib/api/listings";
import { DEFAULT_LOCALE } from "@/lib/i18n/directory";

export const dynamic = "force-dynamic";

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
  const [boats, facets, [ad]] = await Promise.all([latest(), fetchListingFacets(), fetchAds("HOME")]);
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="relative w-full overflow-hidden bg-surface-container-low pb-space-2xl pt-space-xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">

<div className="lg:col-span-8 flex flex-col">
<div className="mb-space-md flex items-center gap-space-xs">
<span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">Mediterranean Vessel Exchange</span>
</div>
<h1 className="font-display-hero text-headline-lg-mobile md:text-display-hero text-primary tracking-tight mb-space-sm max-w-2xl">
            Find the right boat. With the services you need.
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mb-space-xl">
            Boats from private and professional sellers, together with specialised nautical services in Spain and Italy.
          </p>

<div className="bg-surface-container-lowest rounded-xl shadow-md p-space-md md:p-space-lg">


<form action="/boats/" method="get" className="grid grid-cols-1 md:grid-cols-3 gap-space-md" id="search-standard">
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Boat type</label>
<div className="relative bg-surface-container-low rounded-lg">
<select aria-label="Boat type" name="boat_type" className="w-full bg-transparent px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none appearance-none cursor-pointer">
<option value="">All boat types</option>
{(facets.boat_types ?? []).map((type) => (
<option key={type} value={type}>{type}</option>
))}
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-[20px]">expand_more</span>
</div>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Location</label>
<div className="relative bg-surface-container-low rounded-lg">
<select aria-label="Location" name="region" className="w-full bg-transparent px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none appearance-none cursor-pointer">
<option value="">Spain &amp; Italy (All coastal zones)</option>
{facets.regions.map((region) => (
<option key={region} value={region}>{region}</option>
))}
</select>
<span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-[20px]">expand_more</span>
</div>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Price range (€)</label>
<div className="grid grid-cols-2 gap-2">
<input className="w-full bg-surface-container-low rounded-lg px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none placeholder:text-outline" placeholder="Min price" name="price_min" min="0" type="number"/>
<input className="w-full bg-surface-container-low rounded-lg px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none placeholder:text-outline" placeholder="Max price" name="price_max" min="0" type="number"/>
</div>
</div>
<div className="flex flex-col gap-1 md:col-span-2">
<label className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">Year built</label>
<div className="grid grid-cols-2 gap-2">
<input className="w-full bg-surface-container-low rounded-lg px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none placeholder:text-outline" placeholder="From year" name="year_min" min="1900" type="number"/>
<input className="w-full bg-surface-container-low rounded-lg px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none placeholder:text-outline" placeholder="To year" name="year_max" min="1900" type="number"/>
</div>
</div>
<div className="flex items-end md:col-span-1">
<button className="w-full bg-primary hover:bg-primary-container text-on-primary py-2.5 px-space-md rounded-lg font-title-md text-title-md transition-all flex items-center justify-center gap-space-xs shadow-sm" type="submit">
<span className="material-symbols-outlined text-[18px]">search</span>
                  Search boats
                </button>
</div>
</form>

</div>
</div>

<div className="lg:col-span-4 w-full h-full flex flex-col justify-start">
{ad ? (
<div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col">
<div className="flex items-center justify-between pb-space-xs mb-space-sm">
<span className="font-label-sm text-label-sm text-outline tracking-widest uppercase">ADVERTISEMENT</span>
<span className="material-symbols-outlined text-outline text-[16px]">info</span>
</div>
<div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-space-md group bg-surface-container-high">
{ad.image_url ? (
// eslint-disable-next-line @next/next/no-img-element -- sponsor image, size unknown
<img alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src={ad.image_url}/>
) : null}
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex flex-col justify-end p-space-md">
<span className="font-label-sm text-label-sm text-tertiary-fixed tracking-wider uppercase">Verified Partner</span>
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
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-1">Handpicked Inventory</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">Featured boats</h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          Inspected Mediterranean vessels with confirmed titles, VAT certification, and comprehensive technical histories.
        </p>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg mb-space-xl">
{boats.length > 0 ? boats.map((listing) => (
<BoatCard key={listing.id} locale={locale} listing={listing} disclaimerId="finance-disclaimer" />
)) : <p className="font-body-md text-on-surface-variant md:col-span-2 lg:col-span-4">No boats are published yet.</p>}
</div>
<div className="flex justify-center">
<Link className="inline-flex items-center gap-space-xs bg-primary hover:bg-primary-container text-on-primary py-space-sm px-space-xl rounded-lg font-title-md text-title-md transition-colors shadow-sm" href="/boats/">
          View all boats
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
</Link>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-lg">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-lg">
<div className="flex flex-col">
<div className="flex items-center gap-2 mb-1">
<span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">ADVERTISEMENT</span>
<span className="text-outline-variant font-label-sm">·</span>
<span className="font-label-sm text-label-sm text-secondary">Costa Smeralda Marina Authority</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary font-serif">Porto Cervo Marina Services — Berths &amp; Full Shore Support</h3>
<p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
            Secured deep-water superyacht berths from 15m to 120m, round-the-clock bunkering, shore power connections, and VIP concierge assistance on the Sardinian coast.
          </p>
</div>
<div className="shrink-0">
<Link className="inline-flex items-center gap-space-xs px-space-lg py-2.5 rounded-lg bg-primary-container text-on-primary hover:bg-primary transition-all font-label-md text-label-md" href="/services/professionals/">
            Reserve Seasonal Berth
            <span className="material-symbols-outlined text-[18px]">dock</span>
</Link>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="mb-space-xl">
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-1">Fleet Categories</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">Find your type of boat</h2>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/6e536ead8f.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">Motor yachts</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              Explore fleet <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/65a3e00779.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">Sailing yachts</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              Explore fleet <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/4bbd1b22fd.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">Catamarans</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              Explore fleet <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/b8ac8c0656.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">Motorboats</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              Explore fleet <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/aedafbad9f.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">RIBs</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              Explore fleet <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</span>
</div>
</Link>

<Link className="group relative aspect-[16/10] rounded-xl overflow-hidden shadow-sm flex flex-col justify-end p-space-md bg-primary" href="/boats/">
<img alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" src="/design/b4697fc49d.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent"></div>
<div className="relative z-10">
<h3 className="font-headline-sm text-headline-sm text-on-primary mb-1">Fishing boats</h3>
<span className="font-body-sm text-body-sm text-primary-fixed flex items-center gap-1">
              Explore fleet <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
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
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-1">Operational Ecosystem</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">Everything your boat needs</h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          End-to-end maritime services managed by licensed practitioners across Spanish capitanias and Italian capitanerie di porto.
        </p>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg mb-space-xl">

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">handshake</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">Full brokerage</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              Complete negotiation, escrow protection, and sea trial management handled by certified nautical brokers.
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            View service <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">gavel</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">Nautical legal services</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              Spanish registration (matriculación), Italian RID flag transfers, and cross-border maritime taxation advisory.
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            View service <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">verified_user</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">Yacht insurance</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              Bespoke hull and machinery cover, third-party Mediterranean navigation liability, and skipper protection plans.
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            View service <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">build</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">Engines and maintenance</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              Authorised overhaul, winter dry-dock servicing, and official engine diagnostics across regional shipyards.
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            View service <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">local_shipping</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">Transport and delivery</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              Professional skipper delivery passages and overland yacht freight forwarding between Spain and Italy.
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            View service <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
<div>
<div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[26px]">photo_camera</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-2">Nautical marketing</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
              High-definition maritime video production, 3D interior scans, and multi-portal promotional syndication.
            </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/services/professionals/">
            View service <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>
</div>
<div className="flex justify-center">
<Link className="inline-flex items-center gap-space-xs bg-primary hover:bg-primary-container text-on-primary py-space-sm px-space-xl rounded-lg font-title-md text-title-md transition-colors shadow-sm" href="/services/professionals/">
          View all services
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
<span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">ADVERTISEMENT</span>
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
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-1">Tailored Listing Channels</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">Choose how you want to sell</h2>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-space-xl max-w-4xl mx-auto">

<div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between">
<div>
<div className="inline-block px-2.5 py-1 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant mb-space-md uppercase">
              Direct private sale
            </div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-sm">List it myself</h3>
<ul className="flex flex-col gap-space-sm mb-space-xl">
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>For private boat owners</span>
</li>
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>Create and manage the listing</span>
</li>
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>Receive enquiries directly</span>
</li>
</ul>
</div>
<Link className="w-full py-2.5 px-space-md rounded-lg bg-primary hover:bg-primary-container text-on-primary text-center font-title-md text-title-md transition-colors shadow-sm" href="/sell/">
            List my boat
          </Link>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col justify-between">
<div>
<div className="inline-block px-2.5 py-1 rounded bg-surface-container font-label-sm text-label-sm text-on-surface-variant mb-space-md uppercase">
              Assisted brokerage
            </div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-space-sm">Sell with a broker</h3>
<ul className="flex flex-col gap-space-sm mb-space-xl">
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>For owners who want professional support</span>
</li>
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>A broker manages enquiries and the sale</span>
</li>
<li className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
<span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">check</span>
<span>Service subject to a commercial proposal</span>
</li>
</ul>
</div>
<Link className="w-full py-2.5 px-space-md rounded-lg bg-primary hover:bg-primary-container text-on-primary text-center font-title-md text-title-md transition-colors shadow-sm" href="/brokers/">
            Find a broker
          </Link>
</div>
</div>
</div>
</section>

<section className="w-full py-space-2xl bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-sm">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block mb-1">Knowledge &amp; Advisory</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">Guides to buying, selling and maintaining your boat</h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          Actionable nautical insights, tax guidance, and maintenance best practices curated by maritime legal and engineering specialists.
        </p>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg mb-space-xl">

<article className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
<div className="relative w-full aspect-[16/10] overflow-hidden">
<img alt="" className="w-full h-full object-cover" src="/design/ce28c27afe.jpg"/>
</div>
<div className="p-space-lg flex flex-col flex-1 justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block mb-2">Legal &amp; Tax</span>
<h3 className="font-title-lg text-title-lg text-primary mb-2 leading-snug">Transferring Vessel Flags Between Spain and Italy: Step-by-Step</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                A definitive legal guide navigating deregistration from Italian RID to the Spanish Registro de Buques, including matriculation tax calculations.
              </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/guides/">
              Read guide <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
<div className="relative w-full aspect-[16/10] overflow-hidden">
<img alt="" className="w-full h-full object-cover" src="/design/68be5c8e30.jpg"/>
</div>
<div className="p-space-lg flex flex-col flex-1 justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block mb-2">Maintenance</span>
<h3 className="font-title-lg text-title-lg text-primary mb-2 leading-snug">Spring Commissioning: Pre-Season Engine and Hull Protocols</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                Protect your powertrain against galvanic corrosion and ensure fuel filtration efficiency before your first offshore summer voyage.
              </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/guides/">
              Read guide <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
<div className="relative w-full aspect-[16/10] overflow-hidden">
<img alt="" className="w-full h-full object-cover" src="/design/83d5b58468.jpg"/>
</div>
<div className="p-space-lg flex flex-col flex-1 justify-between">
<div>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block mb-2">Buyer&apos;s Guide</span>
<h3 className="font-title-lg text-title-lg text-primary mb-2 leading-snug">Sea Trial Checklist: What to Test Before Signing a Vessel Purchase</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                Critical checkpoints during high-speed RPM tests, steering pressure evaluation, and auxiliary systems verification in open water.
              </p>
</div>
<Link className="inline-flex items-center gap-1 text-secondary hover:text-primary font-label-md text-label-md group" href="/guides/">
              Read guide <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span>
</Link>
</div>
</article>
</div>
<div className="flex justify-center">
<Link className="inline-flex items-center gap-space-xs bg-primary hover:bg-primary-container text-on-primary py-space-sm px-space-xl rounded-lg font-title-md text-title-md transition-colors shadow-sm" href="/guides/">
          View all guides
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
</Link>
</div>
</div>
</section>


</div>
    </main>
  );
}
