"use client";

import { useEffect, useState } from "react";

import SearchSelect from "@/components/forms/SearchSelect";
import MediaUpgradePanel from "@/components/listings/MediaUpgradePanel";
import type { Locale } from "@/lib/i18n/directory";
import { tSell } from "@/lib/i18n/sell";
import { ApiError } from "@/lib/api/client";
import { fetchEligibility, fetchFormOptions, type Eligibility, type FormOptions } from "@/lib/api/listingForm";
import { fetchTranslationEnabled, translateListingText } from "@/lib/api/translation";
import {
  createDraft,
  listMedia,
  listModels,
  removeMedia,
  searchBrands,
  startListingRightCheckout,
  submitListing,
  updateDraft,
  uploadMedia,
  type MediaRow,
  type TaxonomyItem,
  type WorkflowListing,
} from "@/lib/api/sellerListings";

const FIELD =
  "mt-space-xs w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary";
const CARD = "rounded-xl bg-surface-container-lowest p-space-lg shadow-sm";
const LABEL = "block font-label-sm uppercase tracking-wider text-on-surface-variant";

const LANGS = [
  { code: "en", label: "English (Original)" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
] as const;
type Lang = (typeof LANGS)[number]["code"];

const SPEC_KEYS = [
  "condition",
  "boat_type",
  "loa_m",
  "beam_m",
  "draft_m",
  "hull_material",
  "engine_type",
  "engine_model",
  "power_hp",
  "engine_hours",
  "fuel_type",
  "cabins",
  "bathrooms",
  "berth",
] as const;

function describe(error: unknown, locale: Locale): string {
  if (error instanceof ApiError) {
    const first = Object.values(error.fields)[0]?.[0]?.message;
    return first || error.message || tSell(locale, "sell.request_failed");
  }
  return tSell(locale, "sell.request_failed");
}

function text(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return value === null || value === undefined ? "" : String(value);
}

function StepHeading({ n, id, children }: { n: number; id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-space-md flex items-center gap-space-sm font-headline-sm text-headline-sm text-primary">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-label-md text-on-primary">{n}</span>
      {children}
    </h2>
  );
}

export default function SellListingForm({
  brokerId,
  initial,
  locale = "en",
}: {
  brokerId?: string;
  locale?: Locale;
  /** An existing listing (from GET listings/<id>/workflow/) to keep editing. */
  initial?: WorkflowListing;
}) {
  const seed = initial?.revision?.payload ?? {};
  const seedSpecs = (typeof seed.specifications === "object" && seed.specifications !== null
    ? seed.specifications
    : {}) as Record<string, unknown>;
  const t = (key: string, vars?: Record<string, string | number>) => tSell(locale, key, vars);
  const [brands, setBrands] = useState<TaxonomyItem[]>([]);
  const [models, setModels] = useState<TaxonomyItem[]>([]);
  const [other, setOther] = useState<{ id: string; label: string } | null>(null);
  const [brandQuery, setBrandQuery] = useState("");
  const [brandId, setBrandId] = useState(text(seed, "brand_id"));
  const [modelId, setModelId] = useState(text(seed, "model_id"));
  const [customModel, setCustomModel] = useState(text(seed, "custom_model_name"));
  const [year, setYear] = useState(text(seed, "manufacture_year"));
  const [lang, setLang] = useState<Lang>("en");
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);
  const [translatedLangs, setTranslatedLangs] = useState<Lang[]>([]);
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const [titles, setTitles] = useState<Record<Lang, string>>({
    en: text(seed, "title_en"),
    it: text(seed, "title_it"),
    es: text(seed, "title_es"),
  });
  const [descriptions, setDescriptions] = useState<Record<Lang, string>>({
    en: text(seed, "description_en"),
    it: text(seed, "description_it"),
    es: text(seed, "description_es"),
  });
  const [specs, setSpecs] = useState<Record<string, string>>(
    Object.fromEntries(SPEC_KEYS.map((key) => [key, seedSpecs[key] == null ? "" : String(seedSpecs[key])])),
  );
  const [country, setCountry] = useState(text(seed, "location_country"));
  const [region, setRegion] = useState(text(seed, "location_region"));
  const [city, setCity] = useState(text(seed, "location_city"));
  const [price, setPrice] = useState(text(seed, "price"));
  const [showFinance, setShowFinance] = useState(seed.show_finance_estimate === true);
  const [downOverride, setDownOverride] = useState(text(seed, "finance_down_payment_override_percent"));
  const [rateOverride, setRateOverride] = useState(text(seed, "finance_rate_override_percent"));
  const [termOverride, setTermOverride] = useState(text(seed, "finance_term_override_months"));

  const [listing, setListing] = useState<WorkflowListing | null>(initial ?? null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    searchBrands(brandQuery)
      .then((rows) => {
        if (!cancelled) setBrands(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brandQuery]);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    listModels(brandId, modelQuery)
      .then((choices) => {
        if (!cancelled) {
          setModels(choices.models);
          setOther(choices.other);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brandId, modelQuery]);

  const isOther = other !== null && modelId === other.id;
  const initialId = initial?.id;
  useEffect(() => {
    if (!initialId) return;
    let cancelled = false;
    listMedia(initialId)
      .then((rows) => {
        if (!cancelled) setMedia(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialId]);

  useEffect(() => {
    let active = true;
    void fetchFormOptions()
      .then((loaded) => {
        if (active) setOptions(loaded);
      })
      .catch(() => {});
    if (!initialId && !brokerId) {
      void fetchEligibility()
        .then((loaded) => {
          if (active) setEligibility(loaded);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [initialId, brokerId]);

  useEffect(() => {
    let active = true;
    void fetchTranslationEnabled().then((enabled) => {
      if (active) setTranslateEnabled(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  async function runTranslate() {
    setTranslating(true);
    setTranslateError(false);
    setTranslatedLangs([]);
    try {
      const targets = LANGS.map((item) => item.code as Lang).filter((code) => code !== lang);
      const result = await translateListingText({ title: titles[lang], description: descriptions[lang], source: lang, targets });
      setTitles((current) => ({ ...current, ...Object.fromEntries(targets.map((code) => [code, result[code]?.title ?? current[code]])) }));
      setDescriptions((current) => ({ ...current, ...Object.fromEntries(targets.map((code) => [code, result[code]?.description ?? current[code]])) }));
      const done = targets.filter((code) => result[code]);
      setTranslatedLangs(done);
      if (done.length === 0) setTranslateError(true);
    } catch {
      setTranslateError(true);
    } finally {
      setTranslating(false);
    }
  }

  const locked = (listing?.policy.immutable_fields.length ?? 0) > 0;
  const setSpec = (key: string, value: string) => setSpecs((current) => ({ ...current, [key]: value }));

  function payload(): Record<string, unknown> {
    // Specification entries are flat lowercase keys; blanks are dropped, and
    // keys this form does not own are carried over untouched.
    const merged: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(seedSpecs)) {
      if (!(SPEC_KEYS as readonly string[]).includes(key)) merged[key] = value as string | number | boolean | null;
    }
    for (const key of SPEC_KEYS) {
      if (specs[key].trim()) merged[key] = specs[key].trim();
    }
    const body: Record<string, unknown> = {
      title_en: titles.en,
      title_it: titles.it,
      title_es: titles.es,
      description_en: descriptions.en,
      description_it: descriptions.it,
      description_es: descriptions.es,
      specifications: merged,
      location_country: country.toUpperCase(),
      location_region: region,
      location_city: city,
      price,
      currency: "EUR",
    };
    if (brokerId) {
      body.show_finance_estimate = showFinance;
      if (showFinance) {
        if (downOverride.trim()) body.finance_down_payment_override_percent = downOverride.trim();
        if (rateOverride.trim()) body.finance_rate_override_percent = rateOverride.trim();
        if (termOverride.trim()) body.finance_term_override_months = Number(termOverride);
      }
    }
    if (!locked) {
      body.brand_id = brandId;
      body.manufacture_year = Number(year);
      body.model_id = modelId;
      if (isOther) {
        body.custom_model_name = customModel;
      }
    }
    return body;
  }

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = listing
        ? await updateDraft(listing.id, listing.revision?.version ?? listing.version, payload())
        : await createDraft(payload(), brokerId);
      setListing(saved);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 3000);
    } catch (caught) {
      setError(describe(caught, locale));
    } finally {
      setBusy(false);
    }
  }

  async function buyRight() {
    try {
      const { checkout_url } = await startListingRightCheckout(window.location.href);
      window.location.assign(checkout_url);
    } catch (caught) {
      setError(describe(caught, locale));
    }
  }

  async function addFiles(files: FileList | null) {
    if (!listing || !files) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadMedia(listing.id, file);
      }
      setMedia(await listMedia(listing.id));
    } catch (caught) {
      setError(describe(caught, locale));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: MediaRow) {
    if (!listing) return;
    try {
      await removeMedia(listing.id, row.id);
      setMedia(await listMedia(listing.id));
    } catch (caught) {
      setError(describe(caught, locale));
    }
  }

  async function submit() {
    if (!listing) return;
    setBusy(true);
    setError(null);
    try {
      // Attach every ready image/video to the revision, then submit it.
      const ready = media.filter((row) => row.status === "READY").map((row) => row.id);
      const withMedia = await updateDraft(
        listing.id,
        listing.revision?.version ?? listing.version,
        { media_ids: ready },
      );
      setListing(withMedia);
      await submitListing(listing.id, withMedia.revision?.version ?? withMedia.version);
      setSubmitted(true);
    } catch (caught) {
      setError(describe(caught, locale));
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <p role="status" className="font-body-md">
        {t("sell.submitted")}
      </p>
    );
  }

  const toOptions = (values: string[] | undefined) => (values ?? []).map((value) => ({ value, label: value }));
  const countryNames = (() => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      return null;
    }
  })();
  const countryOptions = (options?.countries ?? []).map((code) => ({ value: code, label: countryNames?.of(code) ?? code }));
  countryOptions.sort((a, b) => a.label.localeCompare(b.label, locale));
  const yearOptions = (options?.years ?? []).map((year) => ({ value: String(year), label: String(year) }));
  const pick = (label: string, key: string, values: string[] | undefined) => (
    <SearchSelect
      label={label}
      labelClassName={LABEL}
      value={specs[key]}
      options={toOptions(values)}
      onChange={(value) => setSpec(key, value)}
      placeholder={t("sell.select")}
      searchPlaceholder={t("sell.search")}
      emptyText={t("sell.no_results")}
    />
  );
  const blocked = eligibility !== null && !eligibility.can_start_listing && !listing;

  const steps = [
    ["basic", t("sell.step.basic")],
    ["specs", t("sell.step.specs")],
    ["engine", t("sell.step.engine")],
    ["price", t("sell.step.price")],
    ["media", t("sell.step.media")],
    ["contact", t("sell.step.contact")],
  ];
  const brandName = brands.find((b) => b.id === brandId)?.name ?? "";
  const modelLabel = isOther ? customModel : (models.find((m) => m.id === modelId)?.name ?? "");
  const previewTitle = titles.en || [year, brandName, modelLabel].filter(Boolean).join(" ") || t("sell.title");
  const previewImage = media.find((row) => row.status === "READY" && row.media_type === "IMAGE");

  if (blocked) {
    const next = eligibility?.free.next_available_at;
    const date = next ? new Date(next).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
    return (
      <div className="flex flex-col gap-space-lg">
        <header>
          <span className="font-label-sm uppercase tracking-widest text-secondary">{t("sell.eyebrow")}</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{t("sell.title")}</h1>
        </header>
        <section role="alert" className={`${CARD} border-l-4 border-secondary`}>
          <h2 className="font-headline-sm text-headline-sm text-primary">{t("sell.allowance_title")}</h2>
          {date ? <p className="mt-space-xs font-body-md text-on-surface-variant">{t("sell.allowance_next", { date })}</p> : null}
          <button
            type="button"
            onClick={() => void buyRight()}
            className="mt-space-md rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container"
          >
            {t("sell.allowance_buy")}
          </button>
          {error ? <p role="alert" className="mt-space-sm text-error">{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <span className="font-label-sm uppercase tracking-widest text-secondary">{t("sell.eyebrow")}</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{t("sell.title")}</h1>
        <p className="mt-space-xs max-w-2xl font-body-md text-on-surface-variant">{t("sell.lead")}</p>
      </header>

      <ol className="flex flex-wrap gap-space-xs rounded-xl bg-surface-container-lowest p-space-sm shadow-sm" aria-label="Steps">
        {steps.map(([anchor, label], index) => (
          <li key={anchor}>
            <a href={`#step-${anchor}`} className="flex items-center gap-space-xs rounded-lg px-space-sm py-space-xs font-label-md text-on-surface-variant hover:text-primary">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container font-label-sm">{index + 1}</span>
              {label}
            </a>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-space-lg lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-space-lg">
          <form onSubmit={saveDetails} className="flex flex-col gap-space-lg">
            <section className={CARD} aria-labelledby="step-basic">
              <StepHeading n={1} id="step-basic">{t("sell.step.basic")}</StepHeading>

              <div className="rounded-lg bg-surface-container-low p-space-md">
                <p className="font-label-md text-primary">{t("sell.original_language")}</p>
                <p className="font-body-sm text-on-surface-variant">{t("sell.original_language_help")}</p>
                <div role="tablist" aria-label={t("sell.original_language")} className="mt-space-sm inline-flex rounded-lg bg-surface-container p-1">
                  {LANGS.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      role="tab"
                      aria-selected={lang === item.code}
                      onClick={() => setLang(item.code)}
                      className={`rounded-md px-space-md py-space-xs font-label-md ${lang === item.code ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
                    >
                      {item.label}
                      {translatedLangs.includes(item.code) ? <span className="ml-1 rounded bg-secondary-container px-1 text-[10px] uppercase text-on-secondary-container">{t("sell.translated_badge")}</span> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-space-md">
                <span className={LABEL}>{t("sell.condition")}</span>
                <div className="mt-space-xs inline-flex rounded-lg bg-surface-container p-1">
                  {[
                    ["new", t("sell.condition.new")],
                    ["used", t("sell.condition.used")],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={specs.condition === value}
                      onClick={() => setSpec("condition", value)}
                      className={`rounded-md px-space-md py-space-xs font-label-md ${specs.condition === value ? "bg-primary text-on-primary" : "text-on-surface-variant"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-space-md grid gap-space-md sm:grid-cols-2">
                {pick(t("sell.boat_type"), "boat_type", options?.boat_types)}
                <SearchSelect
                  label={t("sell.brand")}
                  labelClassName={LABEL}
                  value={brandId}
                  options={brands.map((b) => ({ value: b.id, label: b.name }))}
                  onChange={(value) => {
                    setBrandId(value);
                    setModelId("");
                    setModelQuery("");
                  }}
                  onSearch={setBrandQuery}
                  selectedLabel={t("sell.current_brand")}
                  placeholder={t("sell.select")}
                  searchPlaceholder={t("sell.search")}
                  emptyText={t("sell.no_results")}
                  disabled={locked}
                  required
                />
                <SearchSelect
                  label={t("sell.model")}
                  labelClassName={LABEL}
                  value={modelId}
                  options={[...models.map((m) => ({ value: m.id, label: m.name })), ...(other ? [{ value: other.id, label: other.label }] : [])]}
                  onChange={setModelId}
                  onSearch={setModelQuery}
                  selectedLabel={t("sell.current_brand")}
                  placeholder={t("sell.select")}
                  searchPlaceholder={t("sell.search")}
                  emptyText={t("sell.no_results")}
                  disabled={locked || !brandId}
                  required
                />
                {isOther ? (
                  <label className={LABEL}>
                    {t("sell.model_name")}
                    <input className={FIELD} value={customModel} onChange={(e) => setCustomModel(e.target.value)} minLength={2} required />
                  </label>
                ) : null}
                <SearchSelect
                  label={t("sell.year")}
                  labelClassName={LABEL}
                  value={year}
                  options={yearOptions}
                  onChange={setYear}
                  placeholder={t("sell.select")}
                  searchPlaceholder={t("sell.search")}
                  emptyText={t("sell.no_results")}
                  disabled={locked}
                  required
                />
              </div>

              {translateEnabled ? (
                <div className="mt-space-md">
                  <button
                    type="button"
                    onClick={runTranslate}
                    disabled={translating || locked || !(titles[lang] || descriptions[lang])}
                    className="rounded-lg bg-secondary-container px-space-md py-space-xs font-label-md text-on-secondary-container disabled:opacity-50"
                  >
                    {translating ? t("sell.translate_ai_busy") : t("sell.translate_ai")}
                  </button>
                  <p className="mt-space-xs font-body-sm text-on-surface-variant">{t("sell.translate_ai_help")}</p>
                  {translatedLangs.length > 0 ? (
                    <p role="status" className="mt-space-xs rounded-lg bg-secondary-container px-space-sm py-space-xs font-body-sm text-on-secondary-container">
                      {t("sell.translate_done", { langs: translatedLangs.map((code) => code.toUpperCase()).join(", ") })}
                    </p>
                  ) : null}
                  {translateError ? <p role="alert" className="mt-space-xs font-body-sm text-error">{t("sell.translate_ai_failed")}</p> : null}
                </div>
              ) : null}
              <label className={`${LABEL} mt-space-md`}>
                {lang === "en" ? t("sell.listing_title") : `${t("sell.listing_title")} (${lang.toUpperCase()})`}
                <input
                  className={FIELD}
                  value={titles[lang]}
                  onChange={(e) => setTitles((current) => ({ ...current, [lang]: e.target.value }))}
                  maxLength={200}
                  required={lang === "en"}
                />
              </label>
              <label className={`${LABEL} mt-space-md`}>
                {lang === "en" ? t("sell.description") : `${t("sell.description")} (${lang.toUpperCase()})`}
                <textarea
                  className={FIELD}
                  rows={6}
                  value={descriptions[lang]}
                  onChange={(e) => setDescriptions((current) => ({ ...current, [lang]: e.target.value }))}
                  required={lang === "en"}
                />
              </label>
            </section>

            <section className={CARD} aria-labelledby="step-specs">
              <StepHeading n={2} id="step-specs">{t("sell.step.specs")}</StepHeading>
              <div className="grid gap-space-md sm:grid-cols-2">
                <label className={LABEL}>{t("sell.loa")}<input className={FIELD} inputMode="decimal" value={specs.loa_m} onChange={(e) => setSpec("loa_m", e.target.value)} /></label>
                <label className={LABEL}>{t("sell.beam")}<input className={FIELD} inputMode="decimal" value={specs.beam_m} onChange={(e) => setSpec("beam_m", e.target.value)} /></label>
                <label className={LABEL}>{t("sell.draft")}<input className={FIELD} inputMode="decimal" value={specs.draft_m} onChange={(e) => setSpec("draft_m", e.target.value)} /></label>
                {pick(t("sell.hull"), "hull_material", options?.hull_materials)}
              </div>
            </section>

            <section className={CARD} aria-labelledby="step-engine">
              <StepHeading n={3} id="step-engine">{t("sell.step.engine")}</StepHeading>
              <div className="grid gap-space-md sm:grid-cols-2">
                {pick(t("sell.engine_type"), "engine_type", options?.engine_types)}
                <label className={LABEL}>{t("sell.engine_model")}<input className={FIELD} value={specs.engine_model} onChange={(e) => setSpec("engine_model", e.target.value)} /></label>
                <label className={LABEL}>{t("sell.power")}<input className={FIELD} inputMode="numeric" value={specs.power_hp} onChange={(e) => setSpec("power_hp", e.target.value)} /></label>
                <label className={LABEL}>{t("sell.hours")}<input className={FIELD} inputMode="numeric" value={specs.engine_hours} onChange={(e) => setSpec("engine_hours", e.target.value)} /></label>
                {pick(t("sell.fuel"), "fuel_type", options?.fuel_types)}
                {pick(t("sell.cabins"), "cabins", options?.cabins)}
                {pick(t("sell.bathrooms"), "bathrooms", options?.bathrooms)}
              </div>
            </section>

            <section className={CARD} aria-labelledby="step-price">
              <StepHeading n={4} id="step-price">{t("sell.step.price")}</StepHeading>
              <div className="grid gap-space-md sm:grid-cols-2">
                <label className={LABEL}>
                  {t("sell.price")}
                  <input className={FIELD} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </label>
                <SearchSelect
                  label={t("sell.country")}
                  labelClassName={LABEL}
                  value={country.toUpperCase()}
                  options={countryOptions}
                  onChange={setCountry}
                  placeholder={t("sell.select")}
                  searchPlaceholder={t("sell.search")}
                  emptyText={t("sell.no_results")}
                  required
                />
                <label className={LABEL}>{t("sell.region")}<input className={FIELD} value={region} onChange={(e) => setRegion(e.target.value)} /></label>
                <label className={LABEL}>
                  {t("sell.city")}
                  <input className={FIELD} value={city} onChange={(e) => setCity(e.target.value)} required />
                </label>
                <label className={LABEL}>{t("sell.berth")}<input className={FIELD} value={specs.berth} onChange={(e) => setSpec("berth", e.target.value)} /></label>
              </div>
              {brokerId ? (
                <fieldset className="mt-space-md flex flex-col gap-space-sm rounded-lg bg-surface-container-low p-space-md">
                  <legend className="font-title-sm text-title-sm">{t("sell.finance_title")}</legend>
                  <label className="font-body-md">
                    <input type="checkbox" checked={showFinance} onChange={(e) => setShowFinance(e.target.checked)} />{" "}
                    {t("sell.finance_toggle")}
                  </label>
                  {showFinance ? (
                    <>
                      <p className="font-body-sm text-on-surface-variant">{t("sell.finance_help")}</p>
                      <label className="font-body-md">
                        {t("sell.down_override")}
                        <input className={FIELD} inputMode="decimal" value={downOverride} onChange={(e) => setDownOverride(e.target.value)} />
                      </label>
                      <label className="font-body-md">
                        {t("sell.rate_override")}
                        <input className={FIELD} inputMode="decimal" value={rateOverride} onChange={(e) => setRateOverride(e.target.value)} />
                      </label>
                      <label className="font-body-md">
                        {t("sell.term_override")}
                        <input className={FIELD} inputMode="numeric" value={termOverride} onChange={(e) => setTermOverride(e.target.value)} />
                      </label>
                    </>
                  ) : null}
                </fieldset>
              ) : null}
            </section>

            <div className="fixed inset-x-space-md bottom-space-md z-40 mx-auto flex max-w-xl items-center justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-xl ring-1 ring-outline-variant">
              <span className="font-label-sm uppercase tracking-wider text-on-surface-variant">
                {savedFlash ? t("sell.draft_saved_toast") : listing ? t("sell.draft_state") : t("sell.draft_unsaved")}
              </span>
              {savedFlash ? <span role="status" className="sr-only">{t("sell.draft_saved_toast")}</span> : null}
              <button type="submit" disabled={busy} className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container disabled:opacity-50">
                {listing ? t("sell.save_changes") : t("sell.save_draft")}
              </button>
            </div>
          </form>

          <section className={CARD} aria-labelledby="media-heading">
            <StepHeading n={5} id="media-heading">{t("sell.media")}</StepHeading>
            {listing ? (
              <>
                <p className="font-body-sm text-on-surface-variant">
                  {t("sell.media_limits", { images: listing.policy.image_limit, videos: listing.policy.video_limit })}
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4"
                  aria-label={t("sell.add_media")}
                  disabled={busy}
                  onChange={(e) => void addFiles(e.target.files)}
                  className="mt-space-sm block w-full rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low p-space-lg font-body-md"
                />
                <MediaUpgradePanel listingId={listing.id} onApplied={() => setError(null)} />
                <ul className="mt-space-sm flex flex-col gap-space-xs">
                  {media.map((row) => (
                    <li key={row.id} className="flex items-center gap-space-sm font-body-sm">
                      <span>{row.media_type} · {row.status}</span>
                      {row.rejection_reason ? <span role="note">{row.rejection_reason}</span> : null}
                      <button type="button" onClick={() => void remove(row)} className="text-primary underline">
                        {t("sell.remove")}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="font-body-sm text-on-surface-variant">{t("sell.save_draft")} →</p>
            )}
          </section>

          <section className={CARD} aria-labelledby="step-contact">
            <StepHeading n={6} id="step-contact">{t("sell.step.contact")}</StepHeading>
            <p className="font-body-md text-on-surface-variant">{t("sell.contact_note")}</p>
            {listing ? (
              <button
                type="button"
                disabled={busy || media.every((row) => row.status !== "READY")}
                onClick={() => void submit()}
                className="mt-space-md rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container disabled:opacity-50"
              >
                {t("sell.submit")}
              </button>
            ) : null}
          </section>

          {error ? (
            <p role="alert" className="text-error">
              {error}
            </p>
          ) : null}
        </div>

        <aside aria-label={t("sell.preview")} className="h-fit lg:sticky lg:top-space-lg">
          <div className={CARD}>
            <p className="font-label-sm uppercase tracking-widest text-on-surface-variant">{t("sell.preview")}</p>
            <div className="mt-space-sm overflow-hidden rounded-lg bg-surface-container-high">
              <div aria-hidden="true" className="aspect-[16/10] w-full bg-surface-container-high" data-testid="preview-image">
                {previewImage ? null : null}
              </div>
            </div>
            <p className="mt-space-sm font-title-lg text-title-lg text-primary">{previewTitle}</p>
            <p className="font-body-sm text-on-surface-variant">{[city, country.toUpperCase()].filter(Boolean).join(", ")}</p>
            <p className="mt-space-sm font-label-sm uppercase tracking-widest text-on-surface-variant">{t("sell.asking_price")}</p>
            <p className="font-spec-num text-headline-sm font-semibold text-primary">{price ? `€ ${price}` : "—"}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
