import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function BrokerTeam() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission>
<div className="flex flex-col w-full">

<div className="w-full bg-primary-container text-on-primary py-2.5 px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 text-body-sm">
<div className="flex items-center gap-2">
<span className="inline-flex items-center px-1.5 py-0.5 rounded bg-secondary text-on-secondary font-label-sm text-label-sm tracking-widest uppercase font-bold">Prototype</span>
<span className="font-medium tracking-tight">YACHT BROKER SELLER — <span className="text-secondary-fixed">Marina Balear Yachting</span> <span className="opacity-70">(STP Palma Office &amp; Ibiza Satellite)</span></span>
</div>
<div className="flex items-center gap-4 font-label-md text-label-md">
<button className="inline-flex items-center gap-1 text-surface-bright hover:text-secondary-fixed transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">swap_horiz</span>
          Switch Demo Role
        </button>
<span className="text-on-primary-container opacity-50">•</span>
<button className="inline-flex items-center gap-1 text-surface-bright/80 hover:text-surface-bright transition-colors" type="button">
<span className="material-symbols-outlined text-[16px]">logout</span>
          Log Out
        </button>
</div>
</div>
</div>

<section className="w-full bg-surface-container-lowest shadow-sm">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex items-center justify-between overflow-x-auto no-scrollbar">
<div className="flex items-center gap-6 py-2">
<Link href="#" className="py-3 font-title-md text-body-md text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1.5" >
            Overview
          </Link>
<Link href="#" className="py-3 font-title-md text-body-md text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1.5" >
            Fleet
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">18</span>
</Link>
<Link href="#" className="py-3 font-title-md text-body-md text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1.5" >
            Leads
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">22</span>
</Link>
<Link href="#" className="py-3 font-title-md text-body-md text-primary font-semibold inline-flex items-center gap-1.5 shadow-[inset_0_-2px_0_0_#001520]" >
            Team
            <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm">6</span>
</Link>
<Link href="/services/" className="py-3 font-title-md text-body-md text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1.5" >
            Services
          </Link>
<Link href="#" className="py-3 font-title-md text-body-md text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1.5" >
            Company Profile
          </Link>
<Link href="#" className="py-3 font-title-md text-body-md text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1.5" >
            Subscription
          </Link>
</div>
<div className="hidden md:flex items-center gap-3">
<div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
            MYBA Verified Firm: MB-0941
          </div>
</div>
</div>
</div>
</section>

<section className="w-full py-space-xl bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex flex-col md:flex-row md:items-end justify-between gap-space-lg">
<div className="flex flex-col gap-space-xs max-w-3xl">
<div className="flex items-center gap-2 font-label-sm text-label-sm text-secondary uppercase tracking-widest font-semibold">
<span className="material-symbols-outlined text-[16px]">anchor</span>
          Brokerage Team &amp; Agents / Port de Palma &amp; Ibiza Mandates
        </div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Team &amp; Agent Access Management</h1>
<p className="font-body-lg text-body-lg text-on-surface-variant">
          Manage licensed maritime brokers, central agency authorization levels, commission splits, and client confidentiality protocols under ANEN and MYBA rules.
        </p>
</div>
<div className="flex items-center gap-space-sm shrink-0">
<button className="px-4 py-2.5 rounded bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container-high transition-colors font-title-md text-body-md inline-flex items-center gap-2" type="button">
<span className="material-symbols-outlined text-[18px]">download</span>
          Export Team Audit
        </button>
<button className="px-4 py-2.5 rounded bg-primary text-on-primary hover:bg-primary-container transition-colors font-title-md text-body-md shadow-md inline-flex items-center gap-2" id="invite-btn" type="button">
<span className="material-symbols-outlined text-[18px]">person_add</span>
          + Invite Broker Agent
        </button>
</div>
</div>
</section>

<section className="w-full pb-space-xl bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
<div className="flex items-start justify-between">
<span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Active Brokers</span>
<span className="p-2 rounded bg-surface-container-low text-secondary">
<span className="material-symbols-outlined text-[20px]">badge</span>
</span>
</div>
<div className="mt-4 flex flex-col gap-1">
<span className="font-headline-md text-headline-md text-primary tracking-tight">6 Licensed</span>
<span className="font-body-sm text-body-sm text-secondary font-medium inline-flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              MYBA / ANEN Certified Desk
            </span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
<div className="flex items-start justify-between">
<span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">YTD Gross Volume</span>
<span className="p-2 rounded bg-surface-container-low text-secondary">
<span className="material-symbols-outlined text-[20px]">payments</span>
</span>
</div>
<div className="mt-4 flex flex-col gap-1">
<span className="font-headline-md text-headline-md text-primary tracking-tight">€38.4M</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Across 14 closed transactions</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
<div className="flex items-start justify-between">
<span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Avg Commission Split</span>
<span className="p-2 rounded bg-surface-container-low text-secondary">
<span className="material-symbols-outlined text-[20px]">pie_chart</span>
</span>
</div>
<div className="mt-4 flex flex-col gap-1">
<span className="font-headline-md text-headline-md text-primary tracking-tight">65% / 35%</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Contractual Agent / House Base</span>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
<div className="flex items-start justify-between">
<span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Open Buyer Escrows</span>
<span className="p-2 rounded bg-surface-container-low text-secondary">
<span className="material-symbols-outlined text-[20px]">assured_workload</span>
</span>
</div>
<div className="mt-4 flex flex-col gap-1">
<span className="font-headline-md text-headline-md text-primary tracking-tight">5 Mandates</span>
<span className="font-body-sm text-body-sm text-secondary font-medium inline-flex items-center gap-1">
<span className="material-symbols-outlined text-[14px]">lock</span>
              €11.2M pending surveyor sign-off
            </span>
</div>
</div>
</div>
</div>
</section>

<section className="w-full pb-space-2xl bg-surface">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">

<div className="xl:col-span-8 flex flex-col gap-space-md">

<div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
<div className="flex items-center gap-2 w-full sm:w-auto">
<div className="relative w-full sm:w-72">
<span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">search</span>
<input className="w-full pl-9 pr-3 py-1.5 rounded bg-surface-container-low text-body-sm text-primary placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest" placeholder="Search broker, license, or port..." type="text"/>
</div>
</div>
<div className="flex items-center gap-2 font-label-sm text-label-sm">
<button className="px-3 py-1.5 rounded bg-surface-container-high text-primary font-medium" type="button">All Roles (6)</button>
<button className="px-3 py-1.5 rounded hover:bg-surface-container-low text-on-surface-variant transition-colors" type="button">Sales Brokers (4)</button>
<button className="px-3 py-1.5 rounded hover:bg-surface-container-low text-on-surface-variant transition-colors" type="button">Legal &amp; Ops (2)</button>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">

<div className="hidden md:grid grid-cols-12 px-space-lg py-3 bg-surface-container-low text-on-surface-variant font-label-md text-label-md uppercase tracking-wider">
<div className="col-span-4">Agent Profile &amp; Location</div>
<div className="col-span-2">Role &amp; Status</div>
<div className="col-span-3">Active Pipeline &amp; Mandates</div>
<div className="col-span-2">Commission Split</div>
<div className="col-span-1 text-right">Actions</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-12 p-space-md md:p-space-lg items-center gap-4 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors cursor-pointer agent-row" data-agent="luc">
<div className="col-span-4 flex items-center gap-3">
<div className="w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/18ba38ef13.jpg"/>
<span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-secondary shadow-sm"></span>
</div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-1.5">
<span className="font-title-md text-title-md text-primary truncate">Luc Fournier</span>
<span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">MYBA #419</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Senior Partner • Palma / Antibes</span>
</div>
</div>
<div className="col-span-2 flex flex-col">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm w-fit font-medium">
                Admin Access
              </span>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">Full Central Agency</span>
</div>
<div className="col-span-3 flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-semibold">€24.5M Pipeline</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">8 Active Vessels (Sanlorenzo, Benetti)</span>
</div>
<div className="col-span-2 flex flex-col">
<span className="font-spec-num text-spec-num text-primary">70% / 30%</span>
<span className="font-body-sm text-body-sm text-secondary font-medium">Senior Tier</span>
</div>
<div className="col-span-1 flex justify-end">
<span className="material-symbols-outlined text-secondary">chevron_right</span>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-12 p-space-md md:p-space-lg items-center gap-4 hover:bg-surface-container-low/60 transition-colors cursor-pointer agent-row" data-agent="elena">
<div className="col-span-4 flex items-center gap-3">
<div className="w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/c241a79cf5.jpg"/>
<span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-secondary shadow-sm"></span>
</div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-1.5">
<span className="font-title-md text-title-md text-primary truncate">Elena Soler</span>
<span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">ANEN #882</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Charter &amp; Sales Director • STP Palma</span>
</div>
</div>
<div className="col-span-2 flex flex-col">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm w-fit font-medium">
                Senior Broker
              </span>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">Listing &amp; Contract</span>
</div>
<div className="col-span-3 flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-semibold">€14.8M Pipeline</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">5 Active Vessels (Sunseeker, Riva)</span>
</div>
<div className="col-span-2 flex flex-col">
<span className="font-spec-num text-spec-num text-primary">65% / 35%</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Standard Direct</span>
</div>
<div className="col-span-1 flex justify-end">
<span className="material-symbols-outlined text-outline">chevron_right</span>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-12 p-space-md md:p-space-lg items-center gap-4 hover:bg-surface-container-low/60 transition-colors cursor-pointer agent-row" data-agent="marco">
<div className="col-span-4 flex items-center gap-3">
<div className="w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/d2c8c3a233.jpg"/>
<span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-secondary shadow-sm"></span>
</div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-1.5">
<span className="font-title-md text-title-md text-primary truncate">Marco Bellini</span>
<span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">CONSORZIO #12</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Megayacht Liaison • Genoa / Palma</span>
</div>
</div>
<div className="col-span-2 flex flex-col">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm w-fit font-medium">
                Broker
              </span>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">IT Registry Specialist</span>
</div>
<div className="col-span-3 flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-semibold">€6.2M Pipeline</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">3 Active Vessels (Custom Line)</span>
</div>
<div className="col-span-2 flex flex-col">
<span className="font-spec-num text-spec-num text-primary">60% / 40%</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Cross-Border</span>
</div>
<div className="col-span-1 flex justify-end">
<span className="material-symbols-outlined text-outline">chevron_right</span>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-12 p-space-md md:p-space-lg items-center gap-4 hover:bg-surface-container-low/60 transition-colors cursor-pointer agent-row" data-agent="sophie">
<div className="col-span-4 flex items-center gap-3">
<div className="w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/c88b0308c8.jpg"/>
<span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-secondary shadow-sm"></span>
</div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-1.5">
<span className="font-title-md text-title-md text-primary truncate">Sophie Van der Meer</span>
<span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">HISWA #304</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Northern European Desk • Mallorca</span>
</div>
</div>
<div className="col-span-2 flex flex-col">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm w-fit font-medium">
                Junior Broker
              </span>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">Listing Associate</span>
</div>
<div className="col-span-3 flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-semibold">€3.1M Pipeline</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">2 Active Vessels (Wally, Axopar)</span>
</div>
<div className="col-span-2 flex flex-col">
<span className="font-spec-num text-spec-num text-primary">50% / 50%</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Associate Base</span>
</div>
<div className="col-span-1 flex justify-end">
<span className="material-symbols-outlined text-outline">chevron_right</span>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-12 p-space-md md:p-space-lg items-center gap-4 hover:bg-surface-container-low/60 transition-colors cursor-pointer agent-row" data-agent="carlos">
<div className="col-span-4 flex items-center gap-3">
<div className="w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/c8c46049eb.jpg"/>
<span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-secondary shadow-sm"></span>
</div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-1.5">
<span className="font-title-md text-title-md text-primary truncate">Carlos Mendez</span>
<span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">NOTARY REG #55</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Escrow &amp; Notary • Palma Headquarters</span>
</div>
</div>
<div className="col-span-2 flex flex-col">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm w-fit font-medium">
                Compliance Officer
              </span>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">Escrow Audit Only</span>
</div>
<div className="col-span-3 flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-semibold">Non-Sales Legal</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">5 Escrows under review</span>
</div>
<div className="col-span-2 flex flex-col">
<span className="font-spec-num text-spec-num text-primary">Salary + Bonus</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Corporate Retainer</span>
</div>
<div className="col-span-1 flex justify-end">
<span className="material-symbols-outlined text-outline">chevron_right</span>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-12 p-space-md md:p-space-lg items-center gap-4 hover:bg-surface-container-low/60 transition-colors cursor-pointer agent-row" data-agent="mateo">
<div className="col-span-4 flex items-center gap-3">
<div className="w-12 h-12 rounded-full overflow-hidden shrink-0 shadow-sm relative">
<img alt="" className="w-full h-full object-cover" src="/design/9c557d0e32.jpg"/>
<span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-outline shadow-sm"></span>
</div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-1.5">
<span className="font-title-md text-title-md text-primary truncate">Mateo Cardoso</span>
<span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">APPRENTICE</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">Logistics Assistant • Palma Shipyard</span>
</div>
</div>
<div className="col-span-2 flex flex-col">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm w-fit font-medium">
                Assistant
              </span>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">Read Only Access</span>
</div>
<div className="col-span-3 flex flex-col">
<span className="font-spec-num text-spec-num text-primary font-semibold">Support Desk</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Survey coordination</span>
</div>
<div className="col-span-2 flex flex-col">
<span className="font-spec-num text-spec-num text-primary">Hourly Trainee</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Operations Base</span>
</div>
<div className="col-span-1 flex justify-end">
<span className="material-symbols-outlined text-outline">chevron_right</span>
</div>
</div>
</div>

<div className="w-full p-space-lg rounded-xl bg-surface-container-low/70 flex flex-col md:flex-row items-center justify-between gap-space-md shadow-sm">
<div className="flex flex-col gap-1">
<span className="font-label-sm text-label-sm text-on-surface-variant tracking-widest uppercase font-semibold">Advertisement • Maritime Legal Partner</span>
<span className="font-headline-sm text-headline-sm text-primary">Tirreno Maritime Chronometers &amp; Escrow Guarantee</span>
<p className="font-body-sm text-body-sm text-on-surface-variant">Dedicated notary verification service for multi-jurisdictional vessel closings between Balearics, Liguria, and Côte d&apos;Azur.</p>
</div>
<button className="px-4 py-2 rounded bg-surface-container-lowest text-primary font-title-md text-body-sm shadow-sm hover:bg-surface-container transition-colors shrink-0" type="button">
            View Escrow Rates
          </button>
</div>
</div>

<div className="xl:col-span-4 flex flex-col gap-space-md sticky top-24">
<div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-md flex flex-col gap-space-md">

<div className="flex items-start justify-between">
<div className="flex items-center gap-3">
<div className="w-14 h-14 rounded-full overflow-hidden shrink-0 shadow-md">
<img alt="" className="w-full h-full object-cover" id="drawer-avatar" src="/design/c909a69895.jpg"/>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-2">
<span className="font-headline-sm text-headline-sm text-primary" id="drawer-name">Luc Fournier</span>
</div>
<span className="font-body-sm text-body-sm text-secondary font-medium" id="drawer-role">Senior Partner • Central Agency</span>
<span className="font-body-sm text-body-sm text-on-surface-variant" id="drawer-location">Palma (STP) &amp; Antibes Office</span>
</div>
</div>
<span className="p-1.5 rounded-full bg-surface-container-low text-primary hover:bg-surface-container transition-colors cursor-pointer">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</span>
</div>

<div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-2">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Active Client Language Coverage</span>
<div className="flex items-center gap-1.5 flex-wrap">
<span className="px-2 py-0.5 rounded bg-primary text-on-primary font-label-sm text-label-sm font-semibold">FR (Native)</span>
<span className="px-2 py-0.5 rounded bg-primary-container text-on-primary font-label-sm text-label-sm font-medium">EN (Fluent)</span>
<span className="px-2 py-0.5 rounded bg-surface-container-high text-primary font-label-sm text-label-sm">ES (Conversational)</span>
<span className="px-2 py-0.5 rounded bg-surface-container-high text-primary font-label-sm text-label-sm">IT (Technical Yachting)</span>
</div>
</div>

<div className="grid grid-cols-2 gap-3 p-space-sm rounded-lg bg-surface-container-lowest shadow-sm">
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Commission Model</span>
<span className="font-spec-num text-spec-num text-primary font-bold mt-1">70% Agent / 30% House</span>
<span className="font-body-sm text-body-sm text-secondary">Signed via ANEN Annex B</span>
</div>
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Portfolio Valuation</span>
<span className="font-spec-num text-spec-num text-primary font-bold mt-1">€24.5M</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">8 CA vessels listed</span>
</div>
</div>

<div className="flex flex-col gap-3 pt-2">
<div className="flex items-center justify-between">
<span className="font-title-md text-title-md text-primary">Broker Permissions &amp; Limits</span>
<span className="font-label-sm text-label-sm text-secondary font-medium">Role: Admin</span>
</div>

<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low/50">
<div className="flex items-start gap-2.5">
<span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">add_business</span>
<div className="flex flex-col">
<span className="font-body-md text-body-md text-primary font-medium">Direct Vessel Publishing</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Can publish CA fleet without director approval</span>
</div>
</div>
<input defaultChecked className="w-4 h-4 text-secondary rounded focus:ring-0 cursor-pointer accent-secondary" type="checkbox"/>
</div>

<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low/50">
<div className="flex items-start gap-2.5">
<span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">draw</span>
<div className="flex flex-col">
<span className="font-body-md text-body-md text-primary font-medium">Escrow Signing Authority</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Authorized up to €15,000,000 deposit release</span>
</div>
</div>
<input defaultChecked className="w-4 h-4 text-secondary rounded focus:ring-0 cursor-pointer accent-secondary" type="checkbox"/>
</div>

<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low/50">
<div className="flex items-start gap-2.5">
<span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">cloud_download</span>
<div className="flex flex-col">
<span className="font-body-md text-body-md text-primary font-medium">CRM Client Export &amp; KYC</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Can export confidential UBO documents</span>
</div>
</div>
<input defaultChecked className="w-4 h-4 text-secondary rounded focus:ring-0 cursor-pointer accent-secondary" type="checkbox"/>
</div>

<div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low/50">
<div className="flex items-start gap-2.5">
<span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">forum</span>
<div className="flex flex-col">
<span className="font-body-md text-body-md text-primary font-medium">Direct Buyer Messaging</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Unmonitored multi-party chat with prospects</span>
</div>
</div>
<input defaultChecked className="w-4 h-4 text-secondary rounded focus:ring-0 cursor-pointer accent-secondary" type="checkbox"/>
</div>
</div>

<div className="p-space-sm rounded-lg bg-surface-container flex flex-col gap-2">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider">AI Translation Preference</span>
<span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-secondary">
<span className="w-2 h-2 rounded-full bg-secondary"></span>
                Active AI Assisting
              </span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">
              Agent drafts descriptions in French; automatic maritime legal localization configured for Spanish (ES) and English (EN) portal syndication.
            </p>
</div>

<div className="flex items-center gap-2 pt-2">
<button className="flex-1 py-2 px-3 rounded bg-primary text-on-primary font-title-md text-body-sm hover:bg-primary-container transition-colors text-center" type="button">
              Save Permissions
            </button>
<button className="py-2 px-3 rounded bg-surface-container-high text-on-surface-variant hover:text-error hover:bg-error-container transition-colors" type="button">
<span className="material-symbols-outlined text-[18px]">lock_reset</span>
</button>
</div>
</div>

<div className="p-space-md rounded-xl bg-surface-container-lowest text-on-surface-variant shadow-sm flex items-start gap-3 text-body-sm">
<span className="material-symbols-outlined text-secondary shrink-0 text-[20px]">verified_user</span>
<div className="flex flex-col gap-1">
<span className="font-title-md text-body-sm text-primary">ANEN / MYBA Compliance Protocol</span>
<span>All updates to signing authorities trigger an automated encrypted notification to Marina Balear Legal Desk (Palma STP Office).</span>
</div>
</div>
</div>
</div>
</section>

<div className="fixed inset-0 z-50 bg-primary/40 backdrop-blur-sm hidden items-center justify-center p-4" id="invite-modal">
<div className="w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-2xl p-space-xl flex flex-col gap-space-lg">
<div className="flex items-start justify-between">
<div className="flex flex-col">
<span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-semibold">Marina Balear Yachting • STP Palma</span>
<h3 className="font-headline-sm text-headline-sm text-primary">Invite Maritime Broker Agent</h3>
</div>
<button className="p-1 rounded text-on-surface-variant hover:text-primary" id="close-modal" type="button">
<span className="material-symbols-outlined">close</span>
</button>
</div>
<form className="flex flex-col gap-4">
<div className="flex flex-col gap-1.5">
<label className="font-label-md text-label-md text-on-surface-variant">Full Legal Name</label>
<input className="w-full px-3 py-2 rounded bg-surface-container-low text-body-md text-primary focus:outline-none focus:bg-surface-container-lowest shadow-sm" placeholder="e.g. Captain Andrea Rossi" type="text"/>
</div>
<div className="flex flex-col gap-1.5">
<label className="font-label-md text-label-md text-on-surface-variant">Professional Maritime Email</label>
<input className="w-full px-3 py-2 rounded bg-surface-container-low text-body-md text-primary focus:outline-none focus:bg-surface-container-lowest shadow-sm" placeholder="a.rossi@marinabalear.com" type="email"/>
</div>
<div className="grid grid-cols-2 gap-3">
<div className="flex flex-col gap-1.5">
<label className="font-label-md text-label-md text-on-surface-variant">Assigned Role</label>
<select className="w-full px-3 py-2 rounded bg-surface-container-low text-body-md text-primary focus:outline-none focus:bg-surface-container-lowest shadow-sm">
<option>Senior Broker</option>
<option>Broker</option>
<option>Junior Broker</option>
<option>Compliance Officer</option>
<option>Logistics Assistant</option>
</select>
</div>
<div className="flex flex-col gap-1.5">
<label className="font-label-md text-label-md text-on-surface-variant">Contract Split</label>
<input className="w-full px-3 py-2 rounded bg-surface-container-low text-body-md text-primary focus:outline-none focus:bg-surface-container-lowest shadow-sm" type="text" value="65% Agent / 35% House"/>
</div>
</div>
<div className="flex flex-col gap-1.5">
<label className="font-label-md text-label-md text-on-surface-variant">Certification &amp; Port Assignment</label>
<input className="w-full px-3 py-2 rounded bg-surface-container-low text-body-md text-primary focus:outline-none focus:bg-surface-container-lowest shadow-sm" placeholder="MYBA Member ID / Palma, Port Adriano, or Ibiza" type="text"/>
</div>
<div className="flex items-center justify-end gap-3 pt-4">
<button className="px-4 py-2 rounded bg-surface-container text-on-surface-variant hover:text-primary font-title-md text-body-md transition-colors" id="cancel-modal" type="button">
            Cancel
          </button>
<button className="px-5 py-2 rounded bg-primary text-on-primary hover:bg-primary-container font-title-md text-body-md transition-colors shadow-md" type="button">
            Send Encrypted Invite
          </button>
</div>
</form>
</div>
</div>

</div>
      </RequirePermission>
    </main>
  );
}
