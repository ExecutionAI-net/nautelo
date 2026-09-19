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
  "mt-space-xs w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm font-body-md";

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
  const t = (key: string, vars?: Record<string, string | number>) => tSell(locale, key, vars);
  const [brands, setBrands] = useState<TaxonomyItem[]>([]);
  const [models, setModels] = useState<TaxonomyItem[]>([]);
  const [other, setOther] = useState<{ id: string; label: string } | null>(null);
  const [brandQuery, setBrandQuery] = useState("");
  const [brandId, setBrandId] = useState(text(seed, "brand_id"));
  const [modelId, setModelId] = useState(text(seed, "model_id"));
  const [customModel, setCustomModel] = useState(text(seed, "custom_model_name"));
  const [year, setYear] = useState(text(seed, "manufacture_year"));
  const [title, setTitle] = useState(text(seed, "title_en"));
  const [description, setDescription] = useState(text(seed, "description_en"));
  const [country, setCountry] = useState(text(seed, "location_country"));
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

  function payload(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      title_en: title,
      description_en: description,
      location_country: country.toUpperCase(),
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

  return (
    <div className="flex flex-col gap-space-lg">
      <form onSubmit={saveDetails} className="flex flex-col gap-space-md">
        <h1 className="font-headline-md text-headline-md text-primary">{t("sell.title")}</h1>

        <label className="font-body-md">
          {t("sell.brand_search")}
          <input className={FIELD} value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} disabled={locked} />
        </label>
        <label className="font-body-md">
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
        <label className="font-body-md">
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
          <label className="font-body-md">
            {t("sell.model_name")}
            <input className={FIELD} value={customModel} onChange={(e) => setCustomModel(e.target.value)} minLength={2} required />
          </label>
        ) : null}
        <label className="font-body-md">
          {t("sell.year")}
          <input className={FIELD} type="number" value={year} onChange={(e) => setYear(e.target.value)} disabled={locked} required />
        </label>
        <label className="font-body-md">
          {t("sell.listing_title")}
          <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </label>
        <label className="font-body-md">
          {t("sell.description")}
          <textarea className={FIELD} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>
        <label className="font-body-md">
          {t("sell.country")}
          <input className={FIELD} value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} required />
        </label>
        <label className="font-body-md">
          {t("sell.city")}
          <input className={FIELD} value={city} onChange={(e) => setCity(e.target.value)} required />
        </label>
        <label className="font-body-md">
          {t("sell.price")}
          <input className={FIELD} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </label>
        {brokerId ? (
          <fieldset className="flex flex-col gap-space-sm rounded-lg border border-outline-variant p-space-sm">
            <legend className="font-title-sm text-title-sm">{t("sell.finance_title")}</legend>
            <label className="font-body-md">
              <input type="checkbox" checked={showFinance} onChange={(e) => setShowFinance(e.target.checked)} />{" "}
              {t("sell.finance_toggle")}
            </label>
            {showFinance ? (
              <>
                <p className="font-body-sm text-on-surface-variant">
                  {t("sell.finance_help")}
                </p>
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
        <button type="submit" disabled={busy} className="self-start rounded-lg bg-primary px-space-md py-space-sm text-on-primary">
          {listing ? t("sell.save_changes") : t("sell.save_draft")}
        </button>
      </form>

      {listing ? (
        <section aria-labelledby="media-heading">
          <h2 id="media-heading" className="font-title-md text-title-md">{t("sell.media")}</h2>
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
            className="mt-space-sm"
          />
          <MediaUpgradePanel
            listingId={listing.id}
            onApplied={() => setError(null)}
          />
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
          <button
            type="button"
            disabled={busy || media.every((row) => row.status !== "READY")}
            onClick={() => void submit()}
            className="mt-space-md rounded-lg bg-primary px-space-md py-space-sm text-on-primary"
          >
            {t("sell.submit")}
          </button>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
