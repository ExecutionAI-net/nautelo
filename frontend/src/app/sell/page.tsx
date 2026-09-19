import Link from "next/link";

export default function SellLanding() {
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="w-full bg-surface pt-space-xl pb-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-end">
<div className="lg:col-span-8 flex flex-col gap-space-sm">
<div className="inline-flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Maritime Brokerage &amp; Direct Listing</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Sell your boat with Nauta</h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mt-space-xs">
            Choose the right path to market your vessel across Spain, Italy, and the wider Mediterranean basin.
          </p>
</div>
<div className="lg:col-span-4 flex lg:justify-end items-center gap-space-md pt-space-sm lg:pt-0">
<div className="bg-surface-container-low px-space-md py-space-sm rounded-lg flex items-center gap-space-sm">
<span className="material-symbols-outlined text-secondary">anchor</span>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Active Basins</span>
<span className="font-title-md text-title-md text-primary font-medium">Baleares · Liguria · Tyrrhenian</span>
</div>
</div>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mt-space-xl">
<div className="relative h-48 md:h-56 rounded-xl overflow-hidden shadow-sm">
<img alt="" fetchPriority="high" className="w-full h-full object-cover" src="/design/2ea59788a7.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex items-end p-space-md">
<span className="font-label-md text-label-md text-on-primary tracking-wide">Direct Vessel Management</span>
</div>
</div>
<div className="relative h-48 md:h-56 rounded-xl overflow-hidden shadow-sm">
<img alt="" className="w-full h-full object-cover" src="/design/6105378ad2.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex items-end p-space-md">
<span className="font-label-md text-label-md text-on-primary tracking-wide">Certified Yacht Brokers</span>
</div>
</div>
<div className="relative h-48 md:h-56 rounded-xl overflow-hidden shadow-sm">
<img alt="" className="w-full h-full object-cover" src="/design/4380ad7d78.jpg"/>
<div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex items-end p-space-md">
<span className="font-label-md text-label-md text-on-primary tracking-wide">Cross-Border Pan-European Reach</span>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-xl mx-auto text-center mb-space-xl">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Structured Options</span>
<h2 className="font-headline-md text-headline-md text-primary mt-space-xs">Select your representation mode</h2>
</div>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">

<div className="bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
<div className="flex flex-col">
<div className="flex items-center justify-between pb-space-md">
<div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[28px]">tune</span>
</div>
<span className="inline-flex items-center px-space-sm py-0.5 rounded-full bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider">
                Direct Seller
              </span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mt-space-sm">List it myself</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
              For private boat owners seeking direct control over the sales process
            </p>

<div className="flex flex-col gap-space-md my-space-lg">
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">Create and manage the listing with full control</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">Upload high-resolution photos, videos, and specifications</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">Receive enquiries directly from qualified private buyers</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">Manage listing visibility and status from your seller dashboard</span>
</div>
</div>
</div>
<div className="pt-space-md flex flex-col gap-space-xs">
<Link href="/sell/create/" className="w-full inline-flex items-center justify-center bg-primary text-on-primary hover:bg-primary-container font-title-md text-title-md py-space-sm px-space-md rounded-lg transition-colors shadow-sm" >
              Create my listing
            </Link>
<span className="font-label-sm text-label-sm text-center text-outline">Self-serve listing editor with direct messaging</span>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg md:p-space-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
<div className="flex flex-col">
<div className="flex items-center justify-between pb-space-md">
<div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-[28px]">handshake</span>
</div>
<span className="inline-flex items-center px-space-sm py-0.5 rounded-full bg-secondary/10 font-label-sm text-label-sm text-secondary font-semibold uppercase tracking-wider">
                Managed Brokerage
              </span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mt-space-sm">Sell with a broker</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
              For owners who prefer end-to-end representation from certified marine brokers
            </p>

<div className="flex flex-col gap-space-md my-space-lg">
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">Send basic boat information to verified Mediterranean brokerage firms</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">A licensed broker evaluates your vessel and manages buyer enquiries</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">Professional sea trials, surveys, and negotiations coordinated for you</span>
</div>
<div className="flex items-start gap-space-sm">
<div className="w-5 h-5 rounded-full bg-surface-container-low flex items-center justify-center text-secondary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">check</span>
</div>
<span className="font-body-md text-body-md text-on-surface">Service subject to a commercial proposal and brokerage mandate</span>
</div>
</div>
</div>
<div className="pt-space-md flex flex-col gap-space-xs">
<Link href="/brokers/" className="w-full inline-flex items-center justify-center bg-transparent text-primary hover:bg-surface-container-low font-title-md text-title-md py-space-sm px-space-md rounded-lg shadow-sm transition-colors" >
              Request contact from a broker
            </Link>
<span className="font-label-sm text-label-sm text-center text-outline">Connect with certified Spanish and Italian marine brokers</span>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="bg-surface-container-low rounded-xl p-space-md md:p-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-md">
<div className="flex flex-col gap-space-xs">
<span className="font-label-sm text-label-sm uppercase text-outline font-semibold tracking-wider">Advertisement</span>
<span className="font-headline-sm text-headline-sm text-primary">Baleares Yacht Transport</span>
<p className="font-body-sm text-body-sm text-on-surface-variant max-w-xl">
            Insured logistical transport and skippered delivery across Palma, Barcelona, Genoa, and Naples.
          </p>
</div>
<Link href="/services/professionals/transport-delivery/" className="inline-flex items-center gap-space-xs font-title-md text-title-md text-secondary hover:text-primary transition-colors shrink-0" >
<span>Inquire logistics</span>
<span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
</div>
</div>
</section>

<section className="w-full bg-surface pb-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-3xl mx-auto">
<div className="flex flex-col items-center text-center mb-space-xl">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Clarity &amp; Compliance</span>
<h2 className="font-headline-md text-headline-md text-primary mt-space-xs">Frequently Asked Questions</h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">Key information on Mediterranean registration, broker mandates, and buyer communications.</p>
</div>
<div className="flex flex-col gap-space-md" id="faq-accordion">

<div className="faq-item bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="faq-toggle w-full px-space-lg py-space-md flex items-center justify-between text-left gap-space-md focus:outline-none" type="button">
<span className="font-title-lg text-title-lg text-primary">What documentation is required to list a vessel for sale?</span>
<span className="material-symbols-outlined text-outline transition-transform duration-200 faq-icon shrink-0">expand_more</span>
</button>
<div className="faq-content px-space-lg pb-space-md text-on-surface-variant font-body-md text-body-md">
              Owners should have their vessel registration (e.g. Spanish Registro de Buques or Italian Registro Naviglio), proof of VAT payment or exemption (EU VAT status), builder&apos;s certificate / CE declaration of conformity, and recent maintenance logs.
            </div>
</div>

<div className="faq-item bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="faq-toggle w-full px-space-lg py-space-md flex items-center justify-between text-left gap-space-md focus:outline-none" type="button">
<span className="font-title-lg text-title-lg text-primary">How do enquiries reach me if I choose to list the boat myself?</span>
<span className="material-symbols-outlined text-outline transition-transform duration-200 faq-icon shrink-0">expand_more</span>
</button>
<div className="faq-content px-space-lg pb-space-md text-on-surface-variant font-body-md text-body-md">
              Enquiries submitted through your public listing are dispatched directly to your private seller dashboard and notified via email, allowing direct communication with prospective buyers without intermediaries.
            </div>
</div>

<div className="faq-item bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="faq-toggle w-full px-space-lg py-space-md flex items-center justify-between text-left gap-space-md focus:outline-none" type="button">
<span className="font-title-lg text-title-lg text-primary">What are the fees associated with selling via a professional broker?</span>
<span className="material-symbols-outlined text-outline transition-transform duration-200 faq-icon shrink-0">expand_more</span>
</button>
<div className="faq-content px-space-lg pb-space-md text-on-surface-variant font-body-md text-body-md">
              Brokerage commission typically ranges between 5% and 10% depending on vessel value, location, and mandate exclusivity, and is agreed directly via a formal brokerage agreement with the chosen firm.
            </div>
</div>

<div className="faq-item bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="faq-toggle w-full px-space-lg py-space-md flex items-center justify-between text-left gap-space-md focus:outline-none" type="button">
<span className="font-title-lg text-title-lg text-primary">Can I switch from a private listing to broker representation later?</span>
<span className="material-symbols-outlined text-outline transition-transform duration-200 faq-icon shrink-0">expand_more</span>
</button>
<div className="faq-content px-space-lg pb-space-md text-on-surface-variant font-body-md text-body-md">
              Yes. You can pause or unpublish your private listing at any time from your dashboard and engage a certified broker to represent your vessel.
            </div>
</div>

<div className="faq-item bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
<button className="faq-toggle w-full px-space-lg py-space-md flex items-center justify-between text-left gap-space-md focus:outline-none" type="button">
<span className="font-title-lg text-title-lg text-primary">In which countries will my vessel be marketed?</span>
<span className="material-symbols-outlined text-outline transition-transform duration-200 faq-icon shrink-0">expand_more</span>
</button>
<div className="faq-content px-space-lg pb-space-md text-on-surface-variant font-body-md text-body-md">
              Nauta actively connects buyers across Spain, Italy, the Balearics, Côte d&apos;Azur, and the wider European maritime community, with listings available in English, Italian, and Spanish.
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
