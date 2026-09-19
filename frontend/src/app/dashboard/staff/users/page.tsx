import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";

// DESIGN PLACEHOLDER: figures and names below come from the supplied design and are not live data yet.
export default function StaffUsers() {
  return (
    <main className="w-full bg-surface">
      <RequirePermission permission="approve_listings_and_revisions">
<div className="flex flex-col w-full">

<div className="w-full bg-primary text-on-primary">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-2.5 flex flex-wrap items-center justify-between gap-space-sm text-body-sm">
<div className="flex items-center gap-space-sm font-label-md tracking-wider">
<span className="inline-block w-2 h-2 rounded-full bg-secondary-fixed"></span>
<span className="uppercase text-secondary-fixed">Staff Admin</span>
<span className="text-outline">/</span>
<span className="text-on-primary font-medium tracking-normal">Maritime Compliance &amp; Identity Desk</span>
<span className="bg-primary-container text-primary-fixed text-label-sm px-2 py-0.5 rounded ml-2">Screen 41 of 51</span>
</div>
<div className="flex items-center gap-space-md font-label-md">
<button className="text-primary-fixed hover:text-white transition-colors flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">swap_horiz</span> Switch Demo Role
        </button>
<span className="text-outline">|</span>
<button className="text-on-primary-container hover:text-white transition-colors flex items-center gap-1" type="button">
<span className="material-symbols-outlined text-[16px]">logout</span> Log Out
        </button>
</div>
</div>
</div>

<div className="w-full bg-surface-container-lowest shadow-sm overflow-x-auto">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop flex items-center gap-space-md whitespace-nowrap min-w-max">
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">dashboard</span> Overview
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-secondary border-b-2 border-secondary font-semibold flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">badge</span> Users
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">sailing</span> Boats
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">handshake</span> Brokers
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">build</span> Service Providers
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">assignment</span> Requests
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">trending_up</span> Leads
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">card_membership</span> Subscriptions
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">campaign</span> Ads &amp; Banners
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">menu_book</span> Guides &amp; Blog
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">analytics</span> Analytics
      </Link>
<Link href="#" className="py-3.5 px-2 font-title-md text-body-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5" >
<span className="material-symbols-outlined text-[18px]">settings</span> Settings
      </Link>
</div>
</div>

<div className="w-full max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-xl flex flex-col gap-space-xl">

<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
<div className="flex flex-col gap-space-xs max-w-3xl">
<div className="flex items-center gap-2">
<span className="font-label-sm uppercase tracking-widest text-secondary font-semibold bg-surface-container px-2.5 py-1 rounded">Regulated Registry</span>
<span className="text-outline font-label-sm">•</span>
<span className="font-label-sm text-on-surface-variant">AML Directive 6 &amp; DGMM Certified</span>
</div>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">User Management &amp; KYC Desk</h1>
<p className="font-body-lg text-body-lg text-on-surface-variant">
          Audit, verify identity credentials (DNI, NIE, Passports, Capitanía Marítima titles), and orchestrate permissions across private vessel vendors, yacht buyers, registered MYBA brokers, and shipyard technicians.
        </p>
</div>
<div className="flex items-center gap-space-sm shrink-0 flex-wrap">
<button className="inline-flex items-center gap-2 bg-surface-container text-primary hover:bg-surface-container-high px-space-md py-space-sm rounded font-title-md text-body-md transition-colors shadow-sm" type="button">
<span className="material-symbols-outlined text-[20px]">file_download</span>
          Export Audit Log (CSV)
        </button>
<button className="inline-flex items-center gap-2 bg-primary text-on-primary hover:bg-primary-container px-space-md py-space-sm rounded font-title-md text-body-md transition-colors shadow-sm" type="button">
<span className="material-symbols-outlined text-[20px]">person_add</span>
          Provision Admin User
        </button>
</div>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">

<div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between mb-2">
<span className="font-label-md uppercase text-on-surface-variant">Total Registered Users</span>
<div className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[18px]">group</span>
</div>
</div>
<div className="flex items-baseline gap-2">
<span className="font-headline-md text-headline-md text-primary font-semibold">4,829</span>
<span className="font-label-sm text-secondary font-medium">+14.2% MoM</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">Spain (2,410) · Italy (1,840) · Others (579)</span>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between relative overflow-hidden">
<div className="absolute -right-3 -top-3 w-16 h-16 bg-amber-50 rounded-full opacity-60 pointer-events-none"></div>
<div className="flex items-center justify-between mb-2">
<span className="font-label-md uppercase text-on-surface-variant">KYC Pending Verification</span>
<div className="w-8 h-8 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
<span className="material-symbols-outlined text-[18px]">pending_actions</span>
</div>
</div>
<div className="flex items-baseline gap-2">
<span className="font-headline-md text-headline-md text-tertiary-container font-semibold">38</span>
<span className="font-label-sm bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-medium">9 Urgent &gt; 24h</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">Requires title &amp; passport cross-check</span>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between mb-2">
<span className="font-label-md uppercase text-on-surface-variant">Active Escrow Participants</span>
<div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
<span className="material-symbols-outlined text-[18px]">account_balance</span>
</div>
</div>
<div className="flex items-baseline gap-2">
<span className="font-headline-md text-headline-md text-secondary font-semibold">312</span>
<span className="font-label-sm text-on-surface-variant">€41.8M in notary holding</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">Subject to Real Decreto 1027/1989 checks</span>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between mb-2">
<span className="font-label-md uppercase text-on-surface-variant">Suspended Accounts</span>
<div className="w-8 h-8 rounded-full bg-error-container flex items-center justify-center text-error">
<span className="material-symbols-outlined text-[18px]">gavel</span>
</div>
</div>
<div className="flex items-baseline gap-2">
<span className="font-headline-md text-headline-md text-error font-semibold">4</span>
<span className="font-label-sm text-error font-medium">Sanction / Fraud alert</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant mt-1">Frozen vessel asset listings</span>
</div>
</div>

<div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">

<div className="xl:col-span-8 flex flex-col gap-space-md">

<div className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col gap-space-md">

<div className="relative w-full">
<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
<input className="w-full pl-10 pr-4 py-2.5 bg-surface rounded text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-low" placeholder="Search by full name, email, tax ID / NIE / CIF, boat matricola, or passport..." type="text" value="Gianluca Moretti"/>
<button className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary text-body-sm flex items-center gap-1 font-label-md" type="button">
<span className="material-symbols-outlined text-[16px]">tune</span> Advanced
            </button>
</div>

<div className="flex flex-wrap items-center gap-space-xs text-body-sm pt-1">
<span className="font-label-sm uppercase text-on-surface-variant mr-2">Role:</span>
<button className="px-3 py-1 rounded bg-primary text-on-primary font-label-md" type="button">All Roles (4,829)</button>
<button className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md" type="button">Private Sellers (2,104)</button>
<button className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md" type="button">Yacht Brokers (418)</button>
<button className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md" type="button">Service Providers (890)</button>
<button className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md" type="button">Admin / Staff (12)</button>
<div className="w-px h-4 bg-outline-variant mx-1 hidden sm:block"></div>
<span className="font-label-sm uppercase text-on-surface-variant mr-2">Status:</span>
<button className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md" type="button">All Statuses</button>
<button className="px-3 py-1 rounded bg-amber-100 text-amber-900 font-semibold font-label-md flex items-center gap-1" type="button">
<span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span> Pending Review (38)
            </button>
<button className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md" type="button">Verified</button>
<button className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md" type="button">Suspended</button>
</div>
</div>

<div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden flex flex-col">
<div className="overflow-x-auto">
<table className="w-full text-left text-body-sm">
<thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
<tr>
<th className="py-3 px-4">User &amp; Accreditation</th>
<th className="py-3 px-4">Role &amp; Jurisdiction</th>
<th className="py-3 px-4">Identity / KYC</th>
<th className="py-3 px-4">Escrow / Volume</th>
<th className="py-3 px-4">Registered</th>
<th className="py-3 px-4 text-right">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-surface-container">

<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-3.5 px-4">
<div className="flex items-center gap-3">
<div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-title-md text-body-sm shrink-0">
                        CM
                      </div>
<div className="flex flex-col min-w-0">
<span className="font-title-md text-primary font-semibold truncate">Carlos Méndez de Vigo</span>
<span className="text-body-sm text-on-surface-variant truncate">carlos.mendez@palmayachts.es</span>
<span className="font-label-sm text-outline">Capitanía Palma · PER #PER-8421</span>
</div>
</div>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<div className="flex flex-col">
<span className="font-medium text-primary">Private Seller</span>
<span className="text-body-sm text-on-surface-variant flex items-center gap-1">
<span className="material-symbols-outlined text-[14px]">location_on</span> ES — Balearics
                      </span>
</div>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm bg-emerald-50 text-emerald-800 font-medium">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Verified DNI Level 2
                    </span>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<div className="flex flex-col">
<span className="font-spec-num font-semibold text-primary">€1,020,000</span>
<span className="text-label-sm text-on-surface-variant">2 Active Listings</span>
</div>
</td>
<td className="py-3.5 px-4 text-on-surface-variant whitespace-nowrap font-spec-num">
                    14 Jan 2024
                  </td>
<td className="py-3.5 px-4 text-right whitespace-nowrap">
<button className="text-secondary hover:text-primary font-title-md text-body-sm px-2 py-1" type="button">View Dossier</button>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-3.5 px-4">
<div className="flex items-center gap-3">
<div className="w-9 h-9 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-title-md text-body-sm shrink-0">
                        AV
                      </div>
<div className="flex flex-col min-w-0">
<span className="font-title-md text-primary font-semibold truncate">Lord Alistair Vance</span>
<span className="text-body-sm text-on-surface-variant truncate">alistair.vance@vancetrust.mc</span>
<span className="font-label-sm text-outline">Sanlorenzo SL88 Offer Desk</span>
</div>
</div>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<div className="flex flex-col">
<span className="font-medium text-primary">HNW Buyer / Private</span>
<span className="text-body-sm text-on-surface-variant flex items-center gap-1">
<span className="material-symbols-outlined text-[14px]">public</span> Monaco / London
                      </span>
</div>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm bg-emerald-50 text-emerald-800 font-medium">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Level 2 Passport Appr.
                    </span>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<div className="flex flex-col">
<span className="font-spec-num font-semibold text-secondary">€4,650,000</span>
<span className="text-label-sm text-secondary font-medium">1 Escrow Active</span>
</div>
</td>
<td className="py-3.5 px-4 text-on-surface-variant whitespace-nowrap font-spec-num">
                    28 Sep 2024
                  </td>
<td className="py-3.5 px-4 text-right whitespace-nowrap">
<button className="text-secondary hover:text-primary font-title-md text-body-sm px-2 py-1" type="button">View Dossier</button>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-3.5 px-4">
<div className="flex items-center gap-3">
<div className="w-9 h-9 rounded-full bg-surface-container text-primary flex items-center justify-center font-title-md text-body-sm shrink-0">
                        LF
                      </div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-1.5">
<span className="font-title-md text-primary font-semibold truncate">Luc Fournier</span>
<span className="material-symbols-outlined text-[16px] text-secondary" title="MYBA Certified">verified</span>
</div>
<span className="text-body-sm text-on-surface-variant truncate">luc.fournier@marinabalear.es</span>
<span className="font-label-sm text-secondary">MYBA #419 · ANEN Spain</span>
</div>
</div>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<div className="flex flex-col">
<span className="font-medium text-primary">Yacht Broker</span>
<span className="text-body-sm text-on-surface-variant">Marina Balear S.L.</span>
</div>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm bg-blue-50 text-blue-900 font-medium">
<span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Broker Verified
                    </span>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<div className="flex flex-col">
<span className="font-spec-num font-semibold text-primary">€24,500,000</span>
<span className="text-label-sm text-on-surface-variant">14 Escrow Closings</span>
</div>
</td>
<td className="py-3.5 px-4 text-on-surface-variant whitespace-nowrap font-spec-num">
                    12 Feb 2023
                  </td>
<td className="py-3.5 px-4 text-right whitespace-nowrap">
<button className="text-secondary hover:text-primary font-title-md text-body-sm px-2 py-1" type="button">View Dossier</button>
</td>
</tr>

<tr className="hover:bg-surface-container-low/50 transition-colors">
<td className="py-3.5 px-4">
<div className="flex items-center gap-3">
<div className="w-9 h-9 rounded-full bg-surface-container-low text-primary flex items-center justify-center font-title-md text-body-sm shrink-0">
                        MR
                      </div>
<div className="flex flex-col min-w-0">
<span className="font-title-md text-primary font-semibold truncate">Ing. Mateo Rosselló</span>
<span className="text-body-sm text-on-surface-variant truncate">m.rossello@talleresnavales.es</span>
<span className="font-label-sm text-outline">STP Palma Official Shipyard Rig</span>
</div>
</div>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<div className="flex flex-col">
<span className="font-medium text-primary">Service Provider</span>
<span className="text-body-sm text-on-surface-variant">Talleres Navales S.L.</span>
</div>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm bg-purple-50 text-purple-900 font-medium">
<span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span> KYB Corporate OK
                    </span>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<div className="flex flex-col">
<span className="font-spec-num font-semibold text-primary">4 Orders</span>
<span className="text-label-sm text-on-surface-variant">€48.2k Refit Vol</span>
</div>
</td>
<td className="py-3.5 px-4 text-on-surface-variant whitespace-nowrap font-spec-num">
                    05 Mar 2023
                  </td>
<td className="py-3.5 px-4 text-right whitespace-nowrap">
<button className="text-secondary hover:text-primary font-title-md text-body-sm px-2 py-1" type="button">View Dossier</button>
</td>
</tr>

<tr className="bg-amber-50/70 border-l-4 border-amber-500">
<td className="py-3.5 px-4">
<div className="flex items-center gap-3">
<div className="w-9 h-9 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-title-md text-body-sm shrink-0">
                        GM
                      </div>
<div className="flex flex-col min-w-0">
<div className="flex items-center gap-1.5">
<span className="font-title-md text-primary font-semibold truncate">Gianluca Moretti</span>
<span className="material-symbols-outlined text-[16px] text-amber-700" title="Flagged: Matricola Mismatch">warning</span>
</div>
<span className="text-body-sm text-on-surface-variant truncate">gianluca.m@motori.it</span>
<span className="font-label-sm text-amber-800 font-medium">Azimut 60 Flybridge Draft</span>
</div>
</div>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<div className="flex flex-col">
<span className="font-medium text-primary">Private Seller</span>
<span className="text-body-sm text-on-surface-variant flex items-center gap-1">
<span className="material-symbols-outlined text-[14px]">anchor</span> IT — Genoa (Liguria)
                      </span>
</div>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm bg-amber-200 text-amber-900 font-semibold">
<span className="w-1.5 h-1.5 rounded-full bg-amber-700"></span> Discrepancy Flag
                    </span>
</td>
<td className="py-3.5 px-4 whitespace-nowrap">
<div className="flex flex-col">
<span className="font-spec-num font-semibold text-primary">Pending</span>
<span className="text-label-sm text-on-surface-variant">Listing Not Live</span>
</div>
</td>
<td className="py-3.5 px-4 text-on-surface-variant whitespace-nowrap font-spec-num">
                    Yesterday (19:42)
                  </td>
<td className="py-3.5 px-4 text-right whitespace-nowrap">
<span className="inline-flex items-center gap-1 bg-amber-600 text-white font-title-md text-body-sm px-2.5 py-1 rounded">
                      Auditing Now
                    </span>
</td>
</tr>
</tbody>
</table>
</div>

<div className="px-space-md py-space-sm bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm text-body-sm text-on-surface-variant">
<span>Showing 1–5 of 38 pending items (Total 4,829 accounts)</span>
<div className="flex items-center gap-2">
<button className="px-2.5 py-1 rounded bg-surface text-on-surface hover:bg-surface-container-highest disabled:opacity-50" disabled type="button">Previous</button>
<button className="w-7 h-7 rounded bg-primary text-on-primary font-semibold flex items-center justify-center" type="button">1</button>
<button className="w-7 h-7 rounded hover:bg-surface text-on-surface flex items-center justify-center" type="button">2</button>
<button className="w-7 h-7 rounded hover:bg-surface text-on-surface flex items-center justify-center" type="button">3</button>
<span className="px-1">...</span>
<button className="w-7 h-7 rounded hover:bg-surface text-on-surface flex items-center justify-center" type="button">19</button>
<button className="px-2.5 py-1 rounded bg-surface text-on-surface hover:bg-surface-container-highest" type="button">Next</button>
</div>
</div>
</div>
</div>

<div className="xl:col-span-4 bg-surface-container-lowest rounded shadow-md p-space-lg flex flex-col gap-space-lg">

<div className="flex items-start justify-between pb-space-sm bg-surface-container-low -mx-space-lg -mt-space-lg p-space-md">
<div className="flex flex-col">
<span className="font-label-sm uppercase tracking-wider text-amber-800 font-semibold flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">verified_user</span> KYC Compliance Audit
            </span>
<h2 className="font-headline-sm text-headline-sm text-primary">Gianluca Moretti</h2>
<span className="font-body-sm text-on-surface-variant">UID: NAUTA-IT-2025-9104</span>
</div>
<div className="flex items-center gap-1">
<button className="w-8 h-8 rounded-full hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant" title="Close Preview" type="button">
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
</div>

<div className="bg-error-container text-on-error-container p-space-md rounded flex gap-space-sm items-start">
<span className="material-symbols-outlined text-error text-[22px] shrink-0 mt-0.5">report_problem</span>
<div className="flex flex-col gap-1 text-body-sm">
<span className="font-title-md font-semibold text-error">Matricola / Ownership Discrepancy</span>
<p className="leading-relaxed">
              Name on Italian vessel registry document (Capitaneria di Porto di Genova, <strong>GE-4892-D</strong>) lists <em>&quot;Moretti Costruzioni Nautiche S.r.l.&quot;</em>, but user account is submitted as an Individual. A formal corporate representation deed or notarized power of attorney (Procura Speciale) is required before listing approval.
            </p>
</div>
</div>

<div className="flex flex-col gap-space-md">
<span className="font-label-md uppercase tracking-wider text-on-surface-variant">Submitted Documentation</span>

<div className="bg-surface-container-low p-space-sm rounded flex items-center justify-between">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
<span className="material-symbols-outlined text-[22px]">badge</span>
</div>
<div className="flex flex-col min-w-0">
<span className="font-title-md text-body-sm text-primary font-semibold truncate">Carta d&apos;Identità Elettronica</span>
<span className="text-label-sm text-on-surface-variant">CA49201ZZ · Exp: 2031</span>
</div>
</div>
<div className="flex items-center gap-2 shrink-0">
<span className="material-symbols-outlined text-[18px] text-emerald-700">check_circle</span>
<button className="text-body-sm text-secondary hover:underline font-label-md" type="button">Inspect</button>
</div>
</div>

<div className="bg-surface-container-low p-space-sm rounded flex items-center justify-between">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
<span className="material-symbols-outlined text-[22px]">description</span>
</div>
<div className="flex flex-col min-w-0">
<span className="font-title-md text-body-sm text-primary font-semibold truncate">Estratto R.I.D. (Azimut 60)</span>
<span className="text-label-sm text-amber-800">Mismatch Flagged</span>
</div>
</div>
<div className="flex items-center gap-2 shrink-0">
<span className="material-symbols-outlined text-[18px] text-amber-700">warning</span>
<button className="text-body-sm text-secondary hover:underline font-label-md" type="button">Inspect</button>
</div>
</div>

<div className="bg-surface-container-low p-space-sm rounded flex items-center justify-between">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
<span className="material-symbols-outlined text-[22px]">receipt_long</span>
</div>
<div className="flex flex-col min-w-0">
<span className="font-title-md text-body-sm text-primary font-semibold truncate">Marina Berth Contract (Genoa)</span>
<span className="text-label-sm text-on-surface-variant">Porto Antico Mooring #B-14</span>
</div>
</div>
<div className="flex items-center gap-2 shrink-0">
<span className="material-symbols-outlined text-[18px] text-emerald-700">check_circle</span>
<button className="text-body-sm text-secondary hover:underline font-label-md" type="button">Inspect</button>
</div>
</div>
</div>

<div className="flex flex-col gap-space-xs bg-surface p-space-md rounded">
<span className="font-label-md uppercase tracking-wider text-on-surface-variant mb-1">Maritime Desk Checklist</span>
<label className="flex items-center gap-2 text-body-sm text-on-surface cursor-pointer">
<input defaultChecked className="rounded accent-secondary w-4 h-4" type="checkbox"/>
<span>Identity Document Optical Character Recognition (OCR) OK</span>
</label>
<label className="flex items-center gap-2 text-body-sm text-on-surface cursor-pointer">
<input defaultChecked className="rounded accent-secondary w-4 h-4" type="checkbox"/>
<span>Interpol Stolen Vessel Database cleared</span>
</label>
<label className="flex items-center gap-2 text-body-sm text-on-surface cursor-pointer">
<input className="rounded accent-secondary w-4 h-4" type="checkbox"/>
<span className="text-primary font-medium">Corporate Resolution / S.r.l. Ownership Verified</span>
</label>
<label className="flex items-center gap-2 text-body-sm text-on-surface cursor-pointer">
<input className="rounded accent-secondary w-4 h-4" type="checkbox"/>
<span>VAT / IVA Marittima clearance certificate</span>
</label>
</div>

<div className="flex flex-col gap-1.5">
<label className="font-label-md uppercase text-on-surface-variant">Staff Audit Note (Logged to Audit Trail)</label>
<textarea className="w-full p-2.5 bg-surface text-on-surface text-body-sm rounded focus:outline-none focus:ring-1 focus:ring-secondary resize-none" placeholder="Document rationale for review actions taken..." rows={2}>Requesting updated Visura Camerale from Camera di Commercio di Genova to confirm sole administrative signatory status for Gianluca Moretti.</textarea>
</div>

<div className="flex flex-col gap-space-xs pt-space-xs">
<div className="grid grid-cols-2 gap-space-sm">
<button className="w-full bg-surface-container hover:bg-surface-container-high text-primary font-title-md text-body-sm py-2.5 rounded transition-colors flex items-center justify-center gap-1" type="button">
<span className="material-symbols-outlined text-[18px]">forward_to_inbox</span> Request Docs
            </button>
<button className="w-full bg-error-container text-error hover:bg-error hover:text-white font-title-md text-body-sm py-2.5 rounded transition-colors flex items-center justify-center gap-1" type="button">
<span className="material-symbols-outlined text-[18px]">flag</span> Flag / Freeze
            </button>
</div>
<button className="w-full bg-primary text-on-primary hover:bg-primary-container font-title-md text-body-md py-3 rounded transition-colors flex items-center justify-center gap-2 shadow-sm" type="button">
<span className="material-symbols-outlined text-[20px]">verified</span> Approve KYC with Conditions
          </button>
</div>
</div>
</div>

<div className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md">
<div className="flex items-center gap-space-md">
<div className="w-12 h-12 rounded-full bg-surface-container-low text-secondary flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[28px]">policy</span>
</div>
<div className="flex flex-col">
<h3 className="font-title-lg text-primary">Cross-Border Mediterranean Maritime Notary Gateway</h3>
<p className="font-body-md text-on-surface-variant">All vessel transactions exceeding €50,000 are subject to bilingual escrow agreements under Spanish civil maritime law and Italian Codice della Navigazione.</p>
</div>
</div>
<div className="flex items-center gap-3 shrink-0">
<button className="text-body-md text-secondary hover:underline font-title-md" type="button">Download Compliance Guidelines (PDF)</button>
<button className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded text-primary font-title-md text-body-sm" type="button">Audit Rules Config</button>
</div>
</div>
</div>
</div>
      </RequirePermission>
    </main>
  );
}
