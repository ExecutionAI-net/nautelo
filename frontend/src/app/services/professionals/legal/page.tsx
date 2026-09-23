import { getT } from "@/i18n/server";
import Link from "@/components/layout/LocaleLink";

export default async function LegalServices() {
  const t = await getT();
  return (
    <main className="w-full bg-surface">
<div className="flex flex-col w-full">

<section className="w-full bg-surface-container-lowest">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop py-space-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
<nav className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
<Link href="/services/professionals/" className="hover:text-primary transition-colors" >{t("svc_legal.services")}</Link>
<span className="material-symbols-outlined text-[14px] text-outline-variant">chevron_right</span>
<span className="text-primary font-medium">{t("svc_legal.nautical_legal_services")}</span>
</nav>

<div className="flex items-center gap-space-xs self-start sm:self-auto">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t("svc_legal.page_language")}</span>
<div className="inline-flex items-center p-0.5 rounded-full bg-surface-container font-label-md text-label-md">
<button className="px-2.5 py-1 rounded-full bg-primary text-on-primary font-semibold" type="button">EN</button>
<span className="text-outline-variant font-label-sm px-0.5">·</span>
<button className="px-2.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition-colors" type="button">IT</button>
<span className="text-outline-variant font-label-sm px-0.5">·</span>
<button className="px-2.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition-colors" type="button">ES</button>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-xl lg:py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">
<div className="lg:col-span-7 flex flex-col gap-space-md">
<div className="inline-flex items-center gap-space-xs self-start px-3 py-1 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm uppercase tracking-wider">
<span className="material-symbols-outlined text-[14px]">gavel</span>
            {t("svc_legal.maritime_legal_practice_spain_italy")}
          </div>
<h1 className="font-display-hero text-display-hero-mobile md:text-display-hero text-primary tracking-tight">
            {t("svc_legal.nautical_lawyer_and_legal_services_for")}
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
            {t("svc_legal.specialised_maritime_legal_counsel_for_cross")}
          </p>

<div className="flex flex-wrap gap-space-sm pt-space-xs">
<div className="inline-flex items-center gap-2 px-3 py-2 rounded bg-surface-container-lowest text-primary shadow-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
<span className="font-label-md text-label-md">{t("svc_legal.bilateral_maritime_bar_certified")}</span>
</div>
<div className="inline-flex items-center gap-2 px-3 py-2 rounded bg-surface-container-lowest text-primary shadow-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">account_balance</span>
<span className="font-label-md text-label-md">{t("svc_legal.spanish_italian_jurisdictions")}</span>
</div>
<div className="inline-flex items-center gap-2 px-3 py-2 rounded bg-surface-container-lowest text-primary shadow-sm">
<span className="material-symbols-outlined text-secondary text-[18px]">shield</span>
<span className="font-label-md text-label-md">{t("svc_legal.clean_title_guarantee")}</span>
</div>
</div>
<div className="pt-space-sm flex flex-wrap items-center gap-space-md">
<Link href="/services/professionals/" className="inline-flex items-center justify-center px-space-lg py-3 rounded bg-primary-container text-on-primary font-title-md text-title-md hover:bg-primary transition-colors shadow-sm" >
              {t("svc_legal.request_legal_review")}
            </Link>
<Link href="/services/professionals/" className="inline-flex items-center gap-2 text-primary font-body-md text-body-md hover:text-secondary transition-colors" >
              {t("svc_legal.explore_coverage_scopes")}
              <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
</Link>
</div>
</div>
<div className="lg:col-span-5">
<div className="relative rounded-xl overflow-hidden shadow-xl bg-surface-container-high">
<img alt="" className="w-full h-[460px] object-cover" src="/design/018863299d.webp"/>
<div className="absolute bottom-0 inset-x-0 p-space-md bg-gradient-to-t from-primary/90 via-primary/50 to-transparent text-on-primary">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary-fixed">{t("svc_legal.naval_registry_bureau")}</span>
<p className="font-title-md text-title-md mt-0.5">{t("svc_legal.mallorca_genoa_admiralty_counsel")}</p>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-lowest py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
<div className="lg:col-span-4 flex flex-col gap-space-xs">
<span className="font-label-md text-label-md uppercase tracking-wider text-secondary">{t("svc_legal.jurisdictional_precision")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">{t("svc_legal.navigating_mediterranean_naval_law_without_title")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant">
            {t("svc_legal.cross_border_yacht_transactions_between_spain")}
          </p>
</div>
<div className="lg:col-span-8 flex flex-col gap-space-lg text-on-surface">
<div className="p-space-lg rounded-lg bg-surface-container-low">
<h3 className="font-headline-sm text-headline-sm text-primary mb-2">{t("svc_legal.pre_contractual_lien_verification_and_encumbrances")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-4">
              {t("svc_legal.vessels_in_mediterranean_basins_can_be")}<em className="text-primary font-medium">{t("svc_legal.hipotecas_navales")}</em> {t("svc_legal.in_spain_and")} <em className="text-primary font-medium">{t("svc_legal.privilegi_marittimi")}</em> {t("svc_legal.in_italy_that_attach_to_the")}
            </p>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md pt-2">
<div className="p-space-md rounded bg-surface-container-lowest shadow-sm">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{t("svc_legal.spanish_registry_protocol")}</span>
<p className="font-title-md text-title-md text-primary mt-1">{t("svc_legal.registro_de_bienes_muebles")}</p>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{t("svc_legal.exhaustive_searches_across_regional_property_records")}</p>
</div>
<div className="p-space-md rounded bg-surface-container-lowest shadow-sm">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{t("svc_legal.italian_registry_protocol")}</span>
<p className="font-title-md text-title-md text-primary mt-1">{t("svc_legal.rid_atcn_records")}</p>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{t("svc_legal.full_audit_through_the_archivio_telematico")}</p>
</div>
</div>
</div>
<div className="p-space-lg rounded-lg bg-surface-container-low">
<h3 className="font-headline-sm text-headline-sm text-primary mb-2">{t("svc_legal.spanish_matriculation_iedmt_vs_italian_registration")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {t("svc_legal.vessel_owners_operating_in_spanish_territorial")} <em className="text-primary font-medium">{t("svc_legal.impuesto_especial_sobre_determinados_medios_de")}</em> {t("svc_legal.matriculacion_which_triggers_strictly_upon_tax")}
            </p>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl" id="what-included">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="text-center max-w-2xl mx-auto mb-space-xl">
<span className="font-label-md text-label-md uppercase tracking-wider text-secondary">{t("svc_legal.scope_of_practice")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mt-1">{t("svc_legal.what_the_legal_service_includes")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
          {t("svc_legal.rigorous_title_verification_contract_protection_and")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">assignment</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_legal.ownership_documentation")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
              {t("svc_legal.comprehensive_verification_of_national_naval_registries")}
            </p>
</div>
<div className="pt-space-md mt-space-md bg-surface-container-low p-2 rounded font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
            {t("svc_legal.registry_folio_validation")}
          </div>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">policy</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_legal.existing_charges")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
              {t("svc_legal.exhaustive_official_searches_in_the_spanish")}
            </p>
</div>
<div className="pt-space-md mt-space-md bg-surface-container-low p-2 rounded font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
            {t("svc_legal.hipotecas_privilegi_cleared")}
          </div>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">draw</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_legal.purchase_and_sale_contracts")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
              {t("svc_legal.drafting_tailored_bilateral_memorandums_of_agreement")}
            </p>
</div>
<div className="pt-space-md mt-space-md bg-surface-container-low p-2 rounded font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
            {t("svc_legal.myba_moa_compliance")}
          </div>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">flag</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_legal.flag_documentation")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
              {t("svc_legal.procuring_closed_flag_deletion_certificates_from")}
            </p>
</div>
<div className="pt-space-md mt-space-md bg-surface-container-low p-2 rounded font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
            {t("svc_legal.flag_deletion_reflagging")}
          </div>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">receipt_long</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_legal.tax_document_review")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
              {t("svc_legal.verification_of_eu_vat_paid_status")}
            </p>
</div>
<div className="pt-space-md mt-space-md bg-surface-container-low p-2 rounded font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
            {t("svc_legal.fiscal_status_vat_certificate")}
          </div>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
<div>
<div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-secondary mb-space-md">
<span className="material-symbols-outlined text-[24px]">verified_user</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary">{t("svc_legal.change_of_ownership_documentation")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
              {t("svc_legal.execution_of_notarised_and_apostilled_bills")}
            </p>
</div>
<div className="pt-space-md mt-space-md bg-surface-container-low p-2 rounded font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
            {t("svc_legal.notarised_bill_of_sale_mmsi")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-low py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">
<div className="lg:col-span-5 flex flex-col gap-space-sm">
<span className="font-label-md text-label-md uppercase tracking-wider text-secondary">{t("svc_legal.target_profiles")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">{t("svc_legal.who_this_maritime_counsel_serves")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant">
            {t("svc_legal.cross_border_legal_protection_configured_for")}
          </p>
<div className="mt-space-md p-space-md bg-surface-container-lowest rounded-lg shadow-sm">
<div className="flex items-center gap-3 text-primary">
<span className="material-symbols-outlined text-secondary text-[24px]">verified</span>
<div>
<p className="font-title-md text-title-md">{t("svc_legal.100_bilateral_compliance")}</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_legal.attorneys_registered_with_ilustre_colegio_de")}</p>
</div>
</div>
</div>
</div>
<div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-space-md">
<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{t("svc_legal.buyers")}</span>
<h3 className="font-title-lg text-title-lg text-primary mt-1">{t("svc_legal.cross_border_acquisitions")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                {t("svc_legal.individuals_and_holding_companies_purchasing_vessels")}
              </p>
</div>
<span className="text-primary font-label-md text-label-md mt-space-md inline-flex items-center gap-1">{t("svc_legal.pre_purchase_audits")} <span className="material-symbols-outlined text-[14px]">chevron_right</span></span>
</div>
<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{t("svc_legal.sellers")}</span>
<h3 className="font-title-lg text-title-lg text-primary mt-1">{t("svc_legal.clear_title_transfer")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                {t("svc_legal.owners_selling_registered_vessels_across_european")}
              </p>
</div>
<span className="text-primary font-label-md text-label-md mt-space-md inline-flex items-center gap-1">{t("svc_legal.closing_protocols")} <span className="material-symbols-outlined text-[14px]">chevron_right</span></span>
</div>
<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{t("svc_legal.yacht_owners")}</span>
<h3 className="font-title-lg text-title-lg text-primary mt-1">{t("svc_legal.territorial_relocation")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                {t("svc_legal.captains_and_yacht_owners_navigating_long")}
              </p>
</div>
<span className="text-primary font-label-md text-label-md mt-space-md inline-flex items-center gap-1">{t("svc_legal.fiscal_residency_checks")} <span className="material-symbols-outlined text-[14px]">chevron_right</span></span>
</div>
<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">{t("svc_legal.flag_re_registrations")}</span>
<h3 className="font-title-lg text-title-lg text-primary mt-1">{t("svc_legal.registry_transitions")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                {t("svc_legal.principals_switching_flags_between_spain_lista")}
              </p>
</div>
<span className="text-primary font-label-md text-label-md mt-space-md inline-flex items-center gap-1">{t("svc_legal.telematics_filing")} <span className="material-symbols-outlined text-[14px]">chevron_right</span></span>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-md">
<div>
<span className="font-label-md text-label-md uppercase tracking-wider text-secondary">{t("svc_legal.methodology")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mt-1">{t("svc_legal.how_the_service_works")}</h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          {t("svc_legal.a_four_stage_protocol_engineered_to")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg relative">

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between relative">
<div>
<div className="flex items-center justify-between mb-space-md">
<span className="font-display-hero text-headline-lg text-surface-tint opacity-30">01</span>
<span className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-semibold text-body-sm">I</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary">{t("svc_legal.document_ingestion_title_audit")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
              {t("svc_legal.receipt_and_legal_examination_of_hull")}
            </p>
</div>
<div className="pt-space-md font-label-sm text-label-sm text-secondary uppercase tracking-wider">
            {t("svc_legal.turnaround_4872_hrs")}
          </div>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between relative">
<div>
<div className="flex items-center justify-between mb-space-md">
<span className="font-display-hero text-headline-lg text-surface-tint opacity-30">02</span>
<span className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-semibold text-body-sm">II</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary">{t("svc_legal.contract_drafting_legal_review")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
              {t("svc_legal.formulation_of_bilateral_sales_agreements_inspection")}
            </p>
</div>
<div className="pt-space-md font-label-sm text-label-sm text-secondary uppercase tracking-wider">
            {t("svc_legal.tailored_bilateral_moa")}
          </div>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between relative">
<div>
<div className="flex items-center justify-between mb-space-md">
<span className="font-display-hero text-headline-lg text-surface-tint opacity-30">03</span>
<span className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-semibold text-body-sm">III</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary">{t("svc_legal.closing_protocol")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
              {t("svc_legal.supervision_of_surveyor_findings_settlement_of")}
            </p>
</div>
<div className="pt-space-md font-label-sm text-label-sm text-secondary uppercase tracking-wider">
            {t("svc_legal.secure_client_account")}
          </div>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between relative">
<div>
<div className="flex items-center justify-between mb-space-md">
<span className="font-display-hero text-headline-lg text-surface-tint opacity-30">04</span>
<span className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary font-semibold text-body-sm">IV</span>
</div>
<h3 className="font-title-lg text-title-lg text-primary">{t("svc_legal.official_registration_dispatch")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
              {t("svc_legal.submission_of_transfer_files_to_capitaneria")}
            </p>
</div>
<div className="pt-space-md font-label-sm text-label-sm text-secondary uppercase tracking-wider">
            {t("svc_legal.definitive_title_delivery")}
          </div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-md">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<aside className="w-full p-space-lg rounded-lg bg-[#F2F6F6] border border-dashed border-outline-variant/60 flex flex-col md:flex-row items-center justify-between gap-space-md">
<div className="flex flex-col gap-1 text-center md:text-left">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant font-semibold">{t("svc_legal.advertisement")}</span>
<p className="font-headline-sm text-headline-sm text-primary">{t("svc_legal.tirreno_marine_notary_services_genoa_palma")}</p>
<p className="font-body-sm text-body-sm text-on-surface-variant">{t("svc_legal.certified_nautical_notarisation_services_across_the")}</p>
</div>
<div className="shrink-0">
<Link href="/services/professionals/" className="inline-flex items-center gap-2 px-space-md py-2.5 rounded bg-surface-container-lowest text-primary hover:bg-surface text-body-sm font-semibold transition-colors shadow-sm" >
            {t("svc_legal.visit_partner_registry")}
            <span className="material-symbols-outlined text-[16px]">north_east</span>
</Link>
</div>
</aside>
</div>
</section>

<section className="w-full bg-surface-container-lowest py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
<div className="lg:col-span-4 flex flex-col gap-space-sm">
<span className="font-label-md text-label-md uppercase tracking-wider text-secondary">{t("svc_legal.document_preparation")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary">{t("svc_legal.information_required_from_the_customer")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant">
            {t("svc_legal.to_initiate_an_expedited_legal_review")}
          </p>
<div className="mt-space-md p-space-md bg-surface-container-low rounded">
<p className="font-body-sm text-body-sm text-on-surface-variant">
<strong className="text-primary">{t("svc_legal.note")}</strong> {t("svc_legal.digital_copies_are_accepted_for_preliminary")}
            </p>
</div>
</div>
<div className="lg:col-span-8">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">

<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-md">
<span className="material-symbols-outlined text-secondary text-[28px] shrink-0">fact_check</span>
<div>
<h3 className="font-title-md text-title-md text-primary">{t("svc_legal.current_flag_registration_certificate")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {t("svc_legal.copy_of_the_current_navigation_license")}<em className="text-primary">{t("svc_legal.patente_de_navegacion")}</em> or <em className="text-primary">{t("svc_legal.licenza_di_navigazione")}</em>{t("svc_legal.demonstrating_valid_registration_status")}
                </p>
</div>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-md">
<span className="material-symbols-outlined text-secondary text-[28px] shrink-0">qr_code_2</span>
<div>
<h3 className="font-title-md text-title-md text-primary">{t("svc_legal.hull_identification_number_hin_cin")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {t("svc_legal.builders_plate_photograph_and_ce_declaration")}
                </p>
</div>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-md">
<span className="material-symbols-outlined text-secondary text-[28px] shrink-0">payments</span>
<div>
<h3 className="font-title-md text-title-md text-primary">{t("svc_legal.proof_of_vat_payment")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {t("svc_legal.original_commercial_vat_invoice_sad_single")}
                </p>
</div>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-md">
<span className="material-symbols-outlined text-secondary text-[28px] shrink-0">handshake</span>
<div>
<h3 className="font-title-md text-title-md text-primary">{t("svc_legal.draft_moa_or_broker_sales_agreement")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {t("svc_legal.any_existing_signed_offer_myba_agreement")}
                </p>
</div>
</div>

<div className="p-space-md rounded-lg bg-surface-container-low flex items-start gap-space-md sm:col-span-2">
<span className="material-symbols-outlined text-secondary text-[28px] shrink-0">badge</span>
<div>
<h3 className="font-title-md text-title-md text-primary">{t("svc_legal.id_passport_of_contracting_parties")}</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {t("svc_legal.valid_passports_national_tax_identification_numbers")}
                </p>
</div>
</div>
</div>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-md">
<div>
<span className="font-label-md text-label-md uppercase tracking-wider text-secondary">{t("svc_legal.jurisdictional_footprint")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mt-1">{t("svc_legal.service_coverage_locations")}</h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          {t("svc_legal.accredited_nautical_legal_representations_located_directly")}
        </p>
</div>
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-space-md">

<div className="p-space-md rounded-lg bg-surface-container-lowest shadow-sm flex flex-col items-center text-center">
<span className="material-symbols-outlined text-secondary text-[28px] mb-2">anchor</span>
<span className="font-title-md text-title-md text-primary">{t("svc_legal.palma")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Mallorca, ES</span>
<span className="mt-2 font-label-sm text-label-sm text-secondary bg-surface-container px-2 py-0.5 rounded">{t("svc_legal.balearic_bar")}</span>
</div>

<div className="p-space-md rounded-lg bg-surface-container-lowest shadow-sm flex flex-col items-center text-center">
<span className="material-symbols-outlined text-secondary text-[28px] mb-2">sailing</span>
<span className="font-title-md text-title-md text-primary">{t("svc_legal.barcelona")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Catalonia, ES</span>
<span className="mt-2 font-label-sm text-label-sm text-secondary bg-surface-container px-2 py-0.5 rounded">{t("svc_legal.port_vell_desk")}</span>
</div>

<div className="p-space-md rounded-lg bg-surface-container-lowest shadow-sm flex flex-col items-center text-center">
<span className="material-symbols-outlined text-secondary text-[28px] mb-2">navigation</span>
<span className="font-title-md text-title-md text-primary">{t("svc_legal.valencia")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Levante, ES</span>
<span className="mt-2 font-label-sm text-label-sm text-secondary bg-surface-container px-2 py-0.5 rounded">{t("svc_legal.marina_sur")}</span>
</div>

<div className="p-space-md rounded-lg bg-surface-container-lowest shadow-sm flex flex-col items-center text-center">
<span className="material-symbols-outlined text-secondary text-[28px] mb-2">account_balance</span>
<span className="font-title-md text-title-md text-primary">{t("svc_legal.madrid")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Central, ES</span>
<span className="mt-2 font-label-sm text-label-sm text-secondary bg-surface-container px-2 py-0.5 rounded">{t("svc_legal.dgmm_liaison")}</span>
</div>

<div className="p-space-md rounded-lg bg-surface-container-lowest shadow-sm flex flex-col items-center text-center">
<span className="material-symbols-outlined text-secondary text-[28px] mb-2">domain</span>
<span className="font-title-md text-title-md text-primary">{t("svc_legal.genoa")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Liguria, IT</span>
<span className="mt-2 font-label-sm text-label-sm text-secondary bg-surface-container px-2 py-0.5 rounded">{t("svc_legal.naval_admiralty")}</span>
</div>

<div className="p-space-md rounded-lg bg-surface-container-lowest shadow-sm flex flex-col items-center text-center">
<span className="material-symbols-outlined text-secondary text-[28px] mb-2">assured_workload</span>
<span className="font-title-md text-title-md text-primary">{t("svc_legal.rome")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Lazio, IT</span>
<span className="mt-2 font-label-sm text-label-sm text-secondary bg-surface-container px-2 py-0.5 rounded">{t("svc_legal.atcn_central")}</span>
</div>

<div className="p-space-md rounded-lg bg-surface-container-lowest shadow-sm flex flex-col items-center text-center col-span-2 sm:col-span-1">
<span className="material-symbols-outlined text-secondary text-[28px] mb-2">water</span>
<span className="font-title-md text-title-md text-primary">{t("svc_legal.naples")}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Campania, IT</span>
<span className="mt-2 font-label-sm text-label-sm text-secondary bg-surface-container px-2 py-0.5 rounded">{t("svc_legal.tyrrhenian_desk")}</span>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-lowest py-space-2xl" id="request-review">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
<div className="lg:col-span-5 flex flex-col justify-between">
<div>
<span className="font-label-md text-label-md uppercase tracking-wider text-secondary">{t("svc_legal.initiate_case_assessment")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mt-1">{t("svc_legal.request_legal_review")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-3 leading-relaxed">
              {t("svc_legal.submit_vessel_parameters_and_transaction_details")}
            </p>
<div className="mt-space-lg flex flex-col gap-space-sm">
<div className="flex items-start gap-3">
<span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">lock</span>
<p className="font-body-sm text-body-sm text-on-surface-variant"><strong className="text-primary">{t("svc_legal.strict_confidentiality")}</strong> {t("svc_legal.attorney_client_privilege_applies_under_spanish")}</p>
</div>
<div className="flex items-start gap-3">
<span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">timer</span>
<p className="font-body-sm text-body-sm text-on-surface-variant"><strong className="text-primary">{t("svc_legal.response_timeline")}</strong> {t("svc_legal.official_acknowledgment_and_preliminary_conflict_checks")}</p>
</div>
</div>
</div>
<div className="mt-space-xl p-space-md rounded bg-surface-container-low">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">{t("svc_legal.direct_counsel_hotlines")}</span>
<p className="font-title-md text-title-md text-primary mt-1">{t("svc_legal.palma_34_971_00_24_10")}</p>
</div>
</div>
<div className="lg:col-span-7">
<form className="p-space-lg rounded-xl bg-surface shadow-md flex flex-col gap-space-md">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary font-semibold">{t("svc_legal.full_name")}</label>
<input className="px-3 py-2.5 rounded bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none focus:ring-1 focus:ring-secondary" placeholder="e.g. Mateo Rossi / Carlos Alvarez" required type="text"/>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary font-semibold">{t("svc_legal.email_address")}</label>
<input className="px-3 py-2.5 rounded bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none focus:ring-1 focus:ring-secondary" placeholder="name@domain.com" required type="email"/>
</div>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary font-semibold">{t("svc_legal.phone_number")}</label>
<input className="px-3 py-2.5 rounded bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none focus:ring-1 focus:ring-secondary" placeholder="+34 600 000 000 / +39 300 000 000" required type="tel"/>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary font-semibold">{t("svc_legal.boat_current_location")}</label>
<input className="px-3 py-2.5 rounded bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none focus:ring-1 focus:ring-secondary" placeholder="e.g. Marina Port Vell, Barcelona or Genoa" required type="text"/>
</div>
</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary font-semibold">{t("svc_legal.boat_type")}</label>
<select className="px-3 py-2.5 rounded bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none focus:ring-1 focus:ring-secondary" required>
<option value="">{t("svc_legal.select_vessel_category")}</option>
<option value="motor-yacht">{t("svc_legal.motor_yacht")}</option>
<option value="sailing-yacht">{t("svc_legal.sailing_yacht_ketch")}</option>
<option value="catamaran">{t("svc_legal.catamaran")}</option>
<option value="classic">{t("svc_legal.classic_traditional_wooden_hull")}</option>
<option value="commercial">{t("svc_legal.commercial_charter_vessel")}</option>
</select>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary font-semibold">{t("svc_legal.length_loa")}</label>
<div className="flex">
<input className="w-full px-3 py-2.5 rounded-l bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none focus:ring-1 focus:ring-secondary" placeholder="e.g. 18.5" required step={0.1} type="number"/>
<select className="px-3 py-2.5 rounded-r bg-surface-container text-primary font-label-md text-label-md outline-none">
<option value="m">{t("svc_legal.meters_m")}</option>
<option value="ft">{t("svc_legal.feet_ft")}</option>
</select>
</div>
</div>
</div>
<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary font-semibold">{t("svc_legal.transaction_brief_questions")}</label>
<textarea className="px-3 py-2.5 rounded bg-surface-container-lowest text-on-surface font-body-md text-body-md outline-none focus:ring-1 focus:ring-secondary" placeholder="Provide brief context: planned transaction date, seller nationality, existing flag, and whether contracts are currently drafted..." required rows={4}></textarea>
</div>

<div className="flex flex-col gap-1">
<label className="font-label-md text-label-md text-primary font-semibold">{t("svc_legal.accompanying_documents_optional")}</label>
<div className="flex items-center gap-space-sm">
<label className="cursor-pointer inline-flex items-center gap-2 px-space-md py-2.5 rounded bg-surface-container hover:bg-surface-container-high text-primary font-body-sm text-body-sm transition-colors">
<span className="material-symbols-outlined text-[18px]">upload_file</span>
<span>{t("svc_legal.upload_registry_or_draft_contract")}</span>
<input className="hidden" multiple type="file"/>
</label>
<span className="font-body-sm text-body-sm text-on-surface-variant" id="upload-notice">{t("svc_legal.pdf_docx_jpg_up_to_25mb")}</span>
</div>
</div>

<div className="pt-space-xs flex flex-col gap-space-xs">
<button className="w-full py-3.5 rounded bg-primary-container text-on-primary font-title-md text-title-md hover:bg-primary transition-colors shadow-sm" type="submit">
                {t("svc_legal.request_legal_review")}
              </button>
<p className="font-body-sm text-body-sm text-on-surface-variant text-center mt-1">
                {t("svc_legal.direct_dispatch_to_accredited_maritime_attorneys")}
              </p>
</div>

<div className="hidden p-space-md rounded bg-secondary/10 text-secondary font-body-sm text-body-sm flex items-center gap-2" id="form-feedback">
<span className="material-symbols-outlined text-[20px]">check_circle</span>
<span>{t("svc_legal.enquiry_registered_a_maritime_legal_partner")}</span>
</div>
</form>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="text-center max-w-2xl mx-auto mb-space-xl">
<span className="font-label-md text-label-md uppercase tracking-wider text-secondary">{t("svc_legal.admiralty_guidance")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mt-1">{t("svc_legal.frequently_asked_questions")}</h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
          {t("svc_legal.essential_legal_distinctions_regarding_mediterranean_yacht")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div>
<h3 className="font-title-lg text-title-lg text-primary">{t("svc_legal.what_is_the_difference_between_spanish")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-3 leading-relaxed">
              {t("svc_legal.standard_vat_21_in_spain_22")}<em className="text-primary font-medium">{t("svc_legal.impuesto_especial_sobre_determinados_medios_de_2")}</em>{t("svc_legal.is_a_national_excise_tax_of")}
            </p>
</div>
<span className="mt-space-md pt-space-xs font-label-sm text-label-sm text-secondary uppercase tracking-wider flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">info</span>
            {t("svc_legal.article_65_ley_38_1992")}
          </span>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div>
<h3 className="font-title-lg text-title-lg text-primary">{t("svc_legal.how_long_does_it_take_to")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-3 leading-relaxed">
              {t("svc_legal.in_italy_obtaining_a_flag_deletion")}<em className="text-primary font-medium">{t("svc_legal.estratto_di_cancellazione_dal_registro")}</em>{t("svc_legal.through_the_capitaneria_di_porto_or")}
            </p>
</div>
<span className="mt-space-md pt-space-xs font-label-sm text-label-sm text-secondary uppercase tracking-wider flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">info</span>
            {t("svc_legal.capitanerie_di_porto_rid_clearance")}
          </span>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div>
<h3 className="font-title-lg text-title-lg text-primary">{t("svc_legal.why_is_a_bilateral_purchase_and")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-3 leading-relaxed">
              Informal sale deeds or single-jurisdiction templates fail to bridge conflicting legal doctrines between civil law jurisdictions like Spain and Italy and foreign flags. A bilateral Memorandum of Agreement (MoA) explicitly establishes jurisdiction, sea-trial acceptance terms, surveyor defect resolution remedies, force majeure, and guarantees indemnification against latent liens originating in foreign ports.
            </p>
</div>
<span className="mt-space-md pt-space-xs font-label-sm text-label-sm text-secondary uppercase tracking-wider flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">info</span>
            {t("svc_legal.myba_bilateral_moa_frameworks")}
          </span>
</div>

<div className="p-space-lg rounded-lg bg-surface-container-lowest shadow-sm flex flex-col justify-between">
<div>
<h3 className="font-title-lg text-title-lg text-primary">{t("svc_legal.does_nauta_or_a_lawyer_on")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-3 leading-relaxed">
              {t("svc_legal.no_nauta_never_holds_or_transfers")}</p>
</div>
<span className="mt-space-md pt-space-xs font-label-sm text-label-sm text-secondary uppercase tracking-wider flex items-center gap-1">
<span className="material-symbols-outlined text-[16px]">info</span>
            {t("svc_legal.segregated_trust_accounts")}
          </span>
</div>
</div>
</div>
</section>

<section className="w-full bg-surface-container-lowest py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl gap-space-md">
<div>
<span className="font-label-md text-label-md uppercase tracking-wider text-secondary">{t("svc_legal.nauta_advisory_ecosystem")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mt-1">{t("svc_legal.related_nautical_services")}</h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          {t("svc_legal.complementary_maritime_disciplines_ensuring_vessel_readiness")}
        </p>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">

<Link href="/services/professionals/" className="p-space-lg rounded-lg bg-surface hover:bg-surface-container-low transition-colors shadow-sm flex flex-col justify-between group" >
<div>
<div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[24px]">directions_boat</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">{t("svc_legal.full_brokerage")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
              {t("svc_legal.end_to_end_yacht_representation_across")}
            </p>
</div>
<div className="pt-space-md flex items-center gap-1 font-title-md text-title-md text-primary mt-space-md">
<span>{t("svc_legal.explore_brokerage")}</span>
<span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
</div>
</Link>

<Link href="/services/professionals/" className="p-space-lg rounded-lg bg-surface hover:bg-surface-container-low transition-colors shadow-sm flex flex-col justify-between group" >
<div>
<div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[24px]">security</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">{t("svc_legal.yacht_insurance")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
              {t("svc_legal.comprehensive_hull_machinery_h_m_p")}
            </p>
</div>
<div className="pt-space-md flex items-center gap-1 font-title-md text-title-md text-primary mt-space-md">
<span>{t("svc_legal.explore_insurance")}</span>
<span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
</div>
</Link>

<Link href="/services/professionals/" className="p-space-lg rounded-lg bg-surface hover:bg-surface-container-low transition-colors shadow-sm flex flex-col justify-between group" >
<div>
<div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-primary mb-space-md">
<span className="material-symbols-outlined text-[24px]">build</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary group-hover:text-secondary transition-colors">{t("svc_legal.engines_and_maintenance")}</h3>
<p className="font-body-md text-body-md text-on-surface-variant mt-2">
              {t("svc_legal.certified_mechanical_surveys_propulsion_overhauls_shipyard")}
            </p>
</div>
<div className="pt-space-md flex items-center gap-1 font-title-md text-title-md text-primary mt-space-md">
<span>{t("svc_legal.explore_maintenance")}</span>
<span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
</div>
</Link>
</div>
</div>
</section>

<section className="w-full bg-primary-container text-on-primary py-space-2xl">
<div className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin lg:px-margin-desktop">
<div className="flex flex-col lg:flex-row items-center justify-between gap-space-xl">
<div className="flex flex-col gap-space-xs text-center lg:text-left max-w-2xl">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary-fixed">{t("svc_legal.admiralty_counsel_bilateral_security")}</span>
<h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-primary">
            {t("svc_legal.secure_your_mediterranean_boat_transaction_today")}
          </h2>
<p className="font-body-lg text-body-lg text-on-primary-container mt-1">
            {t("svc_legal.connect_directly_with_verified_nautical_attorneys")}
          </p>
</div>
<div className="flex flex-col sm:flex-row items-center gap-space-md shrink-0">
<Link href="/services/professionals/" className="px-space-xl py-3.5 rounded bg-surface text-primary font-title-md text-title-md hover:bg-surface-container transition-colors shadow-lg" >
            {t("svc_legal.request_legal_review")}
          </Link>
<Link href="/services/professionals/" className="px-space-lg py-3.5 rounded text-on-primary hover:text-secondary-fixed font-title-md text-title-md transition-colors flex items-center gap-2" >
<span>{t("svc_legal.all_nautical_services")}</span>
<span className="material-symbols-outlined text-[18px]">arrow_forward</span>
</Link>
</div>
</div>
</div>
</section>
</div>
    </main>
  );
}
