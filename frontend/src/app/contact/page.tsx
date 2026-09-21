import ContactRequestForm from "@/components/contact/ContactRequestForm";
import type { Metadata } from "next";
import Link from "@/components/layout/LocaleLink";

export const metadata: Metadata = {
  title: "Contact",
  description: "Ask NAUTA a question about buying, selling, listing or services.",
};

export default function ContactPage() {
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<div className="relative w-full overflow-hidden">
<div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1100px] h-72 bg-gradient-to-b from-secondary-fixed/30 via-surface-container-low/50 to-transparent blur-3xl pointer-events-none -z-10"></div>
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop pt-space-md pb-space-2xl">

<nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant mb-space-lg">
<Link href="/" className="hover:text-primary transition-colors flex items-center gap-1" >
<span className="material-symbols-outlined text-[16px] text-outline">sailing</span>
<span>Home</span>
</Link>
<span className="text-outline-variant">/</span>
<span className="text-primary font-medium">Contact</span>
</nav>

<div className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg pb-space-xl border-b-0">
<div className="max-w-3xl">
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm tracking-wider uppercase mb-space-sm shadow-sm">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            Maritime Advisory &amp; Platform Desk
          </div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-display-hero">
            Contact Nauta
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-space-xs leading-relaxed max-w-2xl">
            Reach our maritime transaction coordinators, certified broker support desks, and technical listing advisors across Spain, the Balearics, and Italy.
          </p>
</div>

<div className="flex flex-col sm:flex-row items-start sm:items-center gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-transparent">
<div className="flex items-center gap-3">
<div className="relative flex h-3 w-3">
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
<span className="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
</div>
<div>
<div className="font-title-md text-title-md text-primary leading-tight">Desks in three ports</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">Palma · Genoa · Barcelona</div>
</div>
</div>
<div className="h-8 w-px bg-surface-container-highest hidden sm:block"></div>
<div className="text-right">
<div className="font-label-sm text-label-sm uppercase text-outline">Reply time</div>
<div className="font-spec-num text-spec-num text-primary">Usually one working day</div>
</div>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl mt-space-xl items-start">

<div className="lg:col-span-7 flex flex-col gap-space-lg">
<div className="bg-surface-container-lowest rounded-xl p-space-lg lg:p-space-xl shadow-md relative">
<div className="flex items-center justify-between pb-space-md">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Direct Maritime Dossier</span>
<h2 className="font-headline-sm text-headline-sm text-primary mt-1">Submit an Official Inquiry</h2>
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
<span className="font-label-sm text-label-sm uppercase tracking-widest text-outline">Direct Desks</span>
<h3 className="font-headline-sm text-headline-sm text-primary">Nautical Comms Channels</h3>
</div>
<div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
<span className="material-symbols-outlined text-[18px]">headset_mic</span>
</div>
</div>

<div className="space-y-space-md">
<div>
<div className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-2">Telephone Hotlines</div>
<div className="space-y-2.5">
<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2.5">
<span className="w-6 h-4 inline-flex items-center justify-center font-label-sm text-primary font-bold bg-surface-container-highest rounded-sm">ES</span>
<div>
<div className="font-title-md text-body-md text-primary">Spanish Maritime Operations</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">Palma de Mallorca &amp; Barcelona Hubs</div>
</div>
</div>
<Link href="/contact/" className="font-spec-num text-spec-num text-secondary hover:text-primary font-semibold flex items-center gap-1" >
                      +34 971 000 840
                    </Link>
</div>
<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2.5">
<span className="w-6 h-4 inline-flex items-center justify-center font-label-sm text-primary font-bold bg-surface-container-highest rounded-sm">IT</span>
<div>
<div className="font-title-md text-body-md text-primary">Italian Maritime Operations</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">Genoa Liguria &amp; Naples Hubs</div>
</div>
</div>
<Link href="/contact/" className="font-spec-num text-spec-num text-secondary hover:text-primary font-semibold flex items-center gap-1" >
                      +39 010 890 3300
                    </Link>
</div>
<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2.5">
<span className="w-6 h-4 inline-flex items-center justify-center font-label-sm text-primary font-bold bg-surface-container-highest rounded-sm">EU</span>
<div>
<div className="font-title-md text-body-md text-primary">International Broker Relations</div>
<div className="font-body-sm text-body-sm text-on-surface-variant">Cross-Border Flag Transfers</div>
</div>
</div>
<Link href="/contact/" className="font-spec-num text-spec-num text-secondary hover:text-primary font-semibold flex items-center gap-1" >
                      +34 930 112 400
                    </Link>
</div>
</div>
</div>

<div className="pt-2">
<div className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-2">Dedicated Department Emails</div>
<div className="grid grid-cols-1 gap-2">
<Link href="/contact/" className="flex items-center justify-between p-2 rounded hover:bg-surface-container-low transition-colors group" >
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary transition-colors">mail</span>
<span className="font-body-md text-body-md text-primary">General Support &amp; Listings</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-primary transition-colors">contact@nauta-maritime.example.com</span>
</Link>
<Link href="/contact/" className="flex items-center justify-between p-2 rounded hover:bg-surface-container-low transition-colors group" >
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary transition-colors">domain</span>
<span className="font-body-md text-body-md text-primary">Broker &amp; Yard Verification</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-primary transition-colors">brokers@nauta-maritime.example.com</span>
</Link>
<Link href="/contact/" className="flex items-center justify-between p-2 rounded hover:bg-surface-container-low transition-colors group" >
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary transition-colors">gavel</span>
<span className="font-body-md text-body-md text-primary">Legal &amp; Tax Desk</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-primary transition-colors">legal@nauta-maritime.example.com</span>
</Link>
</div>
</div>

<div className="p-space-md rounded bg-surface-container-low flex flex-col gap-2">
<div className="flex items-center justify-between font-label-md text-label-md text-primary">
<span className="flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">pace</span>
                    Central European Maritime Hours (CET)
                  </span>
<span className="text-secondary font-semibold">UTC+1</span>
</div>
<div className="space-y-1 font-body-sm text-body-sm text-on-surface-variant">
<div className="flex justify-between">
<span>Monday – Friday:</span>
<span className="font-medium text-primary">08:30 – 19:00 CET</span>
</div>
<div className="flex justify-between">
<span>Saturday:</span>
<span className="font-medium text-primary">09:00 – 13:00 CET</span>
</div>
<div className="flex justify-between text-outline">
<span>Sunday:</span>
<span>Closed</span>
</div>
</div>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-outline">Maritime Footprint</span>
<h3 className="font-headline-sm text-headline-sm text-primary">Regional Operations Hubs</h3>
</div>

<div className="relative w-full h-48 rounded-lg overflow-hidden group">
<div className="w-full h-full bg-cover bg-center" style={{"backgroundImage": "url('https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg')"}}></div>

<div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] p-3 flex flex-col justify-between pointer-events-none">
<div className="flex justify-between items-start">
<span className="px-2 py-1 rounded bg-primary text-on-primary font-label-sm text-label-sm uppercase">Nauta Western Med Operational Basin</span>
<span className="px-2 py-1 rounded bg-surface-container-lowest/90 text-primary font-label-sm text-label-sm shadow-sm">3 Port Desks</span>
</div>

<div className="flex justify-around items-center px-4">
<div className="flex flex-col items-center">
<span className="w-3 h-3 rounded-full bg-secondary ring-4 ring-white shadow-md animate-pulse"></span>
<span className="mt-1 px-1.5 py-0.5 rounded bg-primary/90 text-on-primary font-label-sm text-[10px]">Barcelona</span>
</div>
<div className="flex flex-col items-center -translate-y-2">
<span className="w-3 h-3 rounded-full bg-secondary ring-4 ring-white shadow-md animate-pulse"></span>
<span className="mt-1 px-1.5 py-0.5 rounded bg-primary/90 text-on-primary font-label-sm text-[10px]">Palma</span>
</div>
<div className="flex flex-col items-center translate-x-4">
<span className="w-3 h-3 rounded-full bg-secondary ring-4 ring-white shadow-md animate-pulse"></span>
<span className="mt-1 px-1.5 py-0.5 rounded bg-primary/90 text-on-primary font-label-sm text-[10px]">Genoa</span>
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
<div className="font-title-md text-title-md text-primary">Palma de Mallorca Desk</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Moll Vell &amp; Muelle de Levante, Edificio Antiguo Varadero, 07012 Palma de Mallorca, Balearic Islands
                  </p>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">Flag Registry &amp; Balearic Sea Trials</span>
</div>
</div>

<div className="pt-3 flex items-start gap-3">
<div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">sailing</span>
</div>
<div>
<div className="font-title-md text-title-md text-primary">Genoa Maritime Desk</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Marina Porto Antico, Calata Molo Vecchio 15, 16128 Genova (GE), Italy
                  </p>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">Tirreno Brokerage &amp; RINA Survey Liaison</span>
</div>
</div>

<div className="pt-3 flex items-start gap-3">
<div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5">
<span className="material-symbols-outlined text-[16px]">architecture</span>
</div>
<div>
<div className="font-title-md text-title-md text-primary">Barcelona Refit &amp; Legal Desk</div>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    Marina Port Vell, Moll del Dipòsit, Nau 4, 08039 Barcelona, Spain
                  </p>
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">Technical Support &amp; Superyacht Transit</span>
</div>
</div>
</div>
</div>

<div className="p-space-md rounded bg-surface-container-low border border-dashed border-outline-variant flex items-center justify-between gap-space-md">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-widest text-outline block mb-1">Advertisement</span>
<div className="font-headline-sm text-headline-sm text-primary font-serif">Tirreno Marine Chronometers</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">Official timepieces calibrated for Mediterranean offshore navigation.</p>
</div>
<Link href="/contact/" className="shrink-0 px-3 py-2 rounded bg-surface-container-lowest text-primary hover:bg-surface-container-high font-label-md text-label-md transition-colors shadow-sm" >
              Explore Collection
            </Link>
</div>
</div>
</div>

<div className="mt-space-2xl pt-space-xl">
<div className="max-w-2xl mb-space-lg">
<div className="inline-flex items-center gap-2 font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
<span>Maritime Transaction Support</span>
</div>
<h2 className="font-headline-lg text-headline-lg text-primary mt-1">Frequently Addressed Queries</h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Immediate guidance on brokerage licensing, flag compliance, and vessel listing standards.
          </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
<div>
<div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[20px]">verified_user</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary mb-space-xs">
                How do I check that a broker or surveyor is properly registered?
              </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                NAUTA reviews every broker and professional profile before it is published, but NAUTA is not a licensing body. Ask the professional for their registration number and check it with the Spanish or Italian register. Questions about a profile: <code className="font-spec-num text-xs bg-surface-container px-1 py-0.5 rounded">brokers@nauta-maritime.example.com</code>.
              </p>
</div>
<div className="mt-space-md pt-space-sm border-t border-surface-container">
<Link href="/contact/" className="font-label-md text-label-md text-secondary hover:underline flex items-center gap-1" >
<span>View Certified Broker Registry</span>
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
                Can Nauta assist with foreign-to-EU flag transfers directly?
              </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Yes. Our maritime legal desks in Palma and Genoa coordinate with Port Authorities to process Spanish (Pabellón Español) and Italian (Bandiera Italiana) flag registrations, VAT status certifications, and CE compliance audits.
              </p>
</div>
<div className="mt-space-md pt-space-sm border-t border-surface-container">
<Link href="/contact/" className="font-label-md text-label-md text-secondary hover:underline flex items-center gap-1" >
<span>Flag Registration Guidelines</span>
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
                What is the fee structure for listing a private yacht?
              </h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Direct private vessel listings up to 12m LOA are hosted on a transparent flat-fee model with AI multilingual translation included. Commercial yacht brokerage packages are custom scoped.
              </p>
</div>
<div className="mt-space-md pt-space-sm border-t border-surface-container">
<Link href="/contact/" className="font-label-md text-label-md text-secondary hover:underline flex items-center gap-1" >
<span>Brokerage Commission Structure</span>
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
<div className="font-title-lg text-title-lg text-primary">A marketplace, not a payment desk</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">
              Nauta is a marketplace: we connect buyers, sellers, brokers and service providers, and we do not hold or transfer your money.
            </p>
</div>
</div>
<div className="flex items-center gap-space-lg shrink-0 text-on-surface-variant font-label-md text-label-md">
<span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary"></span>ISO 27001 Secure</span>

<span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary"></span>ANEN / UCINA Aligned</span>
</div>
</div>
</div>
</div>
</div>
    </main>
  );
}
