"use client";

import { useEffect, useState } from "react";

import MediaUpgradePanel from "@/components/listings/MediaUpgradePanel";
import type { Locale } from "@/lib/i18n/directory";
import { tSell } from "@/lib/i18n/sell";
import { ApiError } from "@/lib/api/client";
import {
  createDraft,
  listMedia,
  listModels,
  removeMedia,
  searchBrands,
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

const BOAT_TYPES = ["Motor yacht", "Sailing yacht", "Catamaran", "Motorboat", "RIB", "Fishing boat"];
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
    listModels(brandId)
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
  }, [brandId]);

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
    } catch (caught) {
      setError(describe(caught, locale));
    } finally {
      setBusy(false);
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

      <div className="grid gap-space-lg lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                <label className={LABEL}>
                  {t("sell.boat_type")}
                  <select className={FIELD} value={specs.boat_type} onChange={(e) => setSpec("boat_type", e.target.value)}>
                    <option value="">{t("sell.select")}</option>
                    {BOAT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className={LABEL}>
                  {t("sell.brand_search")}
                  <input className={FIELD} value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} disabled={locked} />
                </label>
                <label className={LABEL}>
                  {t("sell.brand")}
                  <select className={FIELD} value={brandId} onChange={(e) => { setBrandId(e.target.value); setModelId(""); }} disabled={locked} required>
                    <option value="">{t("sell.select")}</option>
                    {brands.some((b) => b.id === brandId) || !brandId ? null : (
                      <option value={brandId}>{t("sell.current_brand")}</option>
                    )}
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
                <label className={LABEL}>
                  {t("sell.model")}
                  <select className={FIELD} value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={locked || !brandId} required>
                    <option value="">{t("sell.select")}</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                    {other ? <option value={other.id}>{other.label}</option> : null}
                  </select>
                </label>
                {isOther ? (
                  <label className={LABEL}>
                    {t("sell.model_name")}
                    <input className={FIELD} value={customModel} onChange={(e) => setCustomModel(e.target.value)} minLength={2} required />
                  </label>
                ) : null}
                <label className={LABEL}>
                  {t("sell.year")}
                  <input className={FIELD} type="number" value={year} onChange={(e) => setYear(e.target.value)} disabled={locked} required />
                </label>
              </div>

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
                <label className={LABEL}>{t("sell.hull")}<input className={FIELD} value={specs.hull_material} onChange={(e) => setSpec("hull_material", e.target.value)} /></label>
              </div>
            </section>

            <section className={CARD} aria-labelledby="step-engine">
              <StepHeading n={3} id="step-engine">{t("sell.step.engine")}</StepHeading>
              <div className="grid gap-space-md sm:grid-cols-2">
                <label className={LABEL}>{t("sell.engine_type")}<input className={FIELD} value={specs.engine_type} onChange={(e) => setSpec("engine_type", e.target.value)} /></label>
                <label className={LABEL}>{t("sell.engine_model")}<input className={FIELD} value={specs.engine_model} onChange={(e) => setSpec("engine_model", e.target.value)} /></label>
                <label className={LABEL}>{t("sell.power")}<input className={FIELD} inputMode="numeric" value={specs.power_hp} onChange={(e) => setSpec("power_hp", e.target.value)} /></label>
                <label className={LABEL}>{t("sell.hours")}<input className={FIELD} inputMode="numeric" value={specs.engine_hours} onChange={(e) => setSpec("engine_hours", e.target.value)} /></label>
                <label className={LABEL}>{t("sell.fuel")}<input className={FIELD} value={specs.fuel_type} onChange={(e) => setSpec("fuel_type", e.target.value)} /></label>
                <label className={LABEL}>{t("sell.cabins")}<input className={FIELD} inputMode="numeric" value={specs.cabins} onChange={(e) => setSpec("cabins", e.target.value)} /></label>
                <label className={LABEL}>{t("sell.bathrooms")}<input className={FIELD} inputMode="numeric" value={specs.bathrooms} onChange={(e) => setSpec("bathrooms", e.target.value)} /></label>
              </div>
            </section>

            <section className={CARD} aria-labelledby="step-price">
              <StepHeading n={4} id="step-price">{t("sell.step.price")}</StepHeading>
              <div className="grid gap-space-md sm:grid-cols-2">
                <label className={LABEL}>
                  {t("sell.price")}
                  <input className={FIELD} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </label>
                <label className={LABEL}>
                  {t("sell.country")}
                  <input className={FIELD} value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} required />
                </label>
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

            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-md">
              <span className="font-label-sm uppercase tracking-wider text-on-surface-variant">
                {listing ? t("sell.draft_state") : t("sell.draft_unsaved")}
              </span>
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
