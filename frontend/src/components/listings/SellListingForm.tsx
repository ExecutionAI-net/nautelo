"use client";

import { useEffect, useState } from "react";

import Link from "@/components/layout/LocaleLink";
import PromotionDialog from "@/components/promotion/PromotionDialog";
import PlacePicker from "@/components/places/PlacePicker";
import SearchSelect from "@/components/forms/SearchSelect";
import type { Locale } from "@/lib/i18n/directory";
import { useT } from "@/i18n/client";
import type { Translate } from "@/i18n";
import { ApiError } from "@/lib/api/client";
import { fetchEligibility, fetchFormOptions, type Eligibility, type FormOptions } from "@/lib/api/listingForm";
import PaidListingBuy from "@/components/listings/PaidListingBuy";
import { safeMoney } from "@/components/listings/money";
import { fetchTranslationEnabled, translateListingText } from "@/lib/api/translation";
import {
  createDraft,
  fetchWorkflowListing,
  listMedia,
  listModels,
  removeMedia,
  reorderMedia,
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

// Measurements take a decimal part (comma or dot, shown as typed); counts are whole numbers.
const NUMERIC_SPECS: Record<string, boolean> = {
  loa_m: true,
  beam_m: true,
  draft_m: true,
  power_hp: true,
  engine_hours: false,
  cabins: false,
  bathrooms: false,
  berth: false,
};

/** Keeps digits and, for decimals, a single comma or dot, so letters can never be typed in. */
export function numericOnly(value: string, decimal: boolean): string {
  if (!decimal) return value.replace(/\D/g, "");
  const cleaned = value.replace(/[^\d.,]/g, "");
  const at = cleaned.search(/[.,]/);
  return at === -1 ? cleaned : cleaned.slice(0, at + 1) + cleaned.slice(at + 1).replace(/[.,]/g, "");
}

function describe(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    const first = Object.values(error.fields)[0]?.[0]?.message;
    return first || error.message || t("sell.request_failed");
  }
  return t("sell.request_failed");
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
  const seed = initial?.revision?.payload ?? initial?.published_payload ?? {};
  const seedSpecs = (typeof seed.specifications === "object" && seed.specifications !== null
    ? seed.specifications
    : {}) as Record<string, unknown>;
  const t = useT();
  const [brands, setBrands] = useState<TaxonomyItem[]>([]);
  const [models, setModels] = useState<TaxonomyItem[]>([]);
  const [other, setOther] = useState<{ id: string; label: string } | null>(null);
  const [brandQuery, setBrandQuery] = useState("");
  const [brandId, setBrandId] = useState(text(seed, "brand_id"));
  const [modelId, setModelId] = useState(text(seed, "model_id"));
  // Names for chosen ids, so a locked or previously saved brand/model reads as
  // its name instead of a placeholder. Seeded from the listing, then from picks.
  const [names, setNames] = useState<Record<string, string>>(() => {
    const known: Record<string, string> = {};
    if (initial?.brand_name && text(seed, "brand_id")) known[text(seed, "brand_id")] = initial.brand_name;
    if (initial?.model_name && text(seed, "model_id")) known[text(seed, "model_id")] = initial.custom_model_name || initial.model_name;
    return known;
  });
  const [customModel, setCustomModel] = useState(text(seed, "custom_model_name"));
  const [year, setYear] = useState(text(seed, "manufacture_year"));
  const [lang, setLang] = useState<Lang>("en");
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);
  const [translatedLangs, setTranslatedLangs] = useState<Lang[]>([]);
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [wantedPackage, setWantedPackage] = useState("");
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
  const [placeId, setPlaceId] = useState<number | null>(typeof seed.location_place_id === "number" ? seed.location_place_id : null);
  const [price, setPrice] = useState(text(seed, "price"));
  const [showFinance, setShowFinance] = useState(seed.show_finance_estimate === true);
  const [downOverride, setDownOverride] = useState(text(seed, "finance_down_payment_override_percent"));
  const [rateOverride, setRateOverride] = useState(text(seed, "finance_rate_override_percent"));
  const [termOverride, setTermOverride] = useState(text(seed, "finance_term_override_months"));

  const [listing, setListing] = useState<WorkflowListing | null>(initial ?? null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [pending, setPending] = useState<{ file: File; url: string }[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [askPromo, setAskPromo] = useState(false);
  // The server decides whether a promotion is paid; the ?promotion=success
  // return flag only tells us to ask again, since the webhook may land a
  // moment after Stripe sends the seller back.
  const promoPaid = listing?.promotion?.paid === true;
  const returnedFromPromotion = initial?.id;
  useEffect(() => {
    if (!returnedFromPromotion || new URLSearchParams(window.location.search).get("promotion") !== "success") return;
    let cancelled = false;
    let attempts = 0;
    const check = () => {
      fetchWorkflowListing(returnedFromPromotion)
        .then((fresh) => {
          if (cancelled) return;
          if (fresh.promotion?.paid) setListing(fresh);
          else if (++attempts < 5) window.setTimeout(check, 2000);
        })
        .catch(() => {});
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [returnedFromPromotion]);

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
  // Before the first save nothing exists on the server, so the typed fields survive a refresh in this browser only.
  const DRAFT_KEY = "nauta_sell_draft";
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    if (initial) return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
        /* eslint-disable react-hooks/set-state-in-effect -- one-time restore on mount */
        if (typeof d.brandId === "string") setBrandId(d.brandId);
        if (typeof d.modelId === "string") setModelId(d.modelId);
        if (typeof d.customModel === "string") setCustomModel(d.customModel);
        if (typeof d.year === "string") setYear(d.year);
        if (d.titles) setTitles((c) => ({ ...c, ...d.titles }));
        if (d.descriptions) setDescriptions((c) => ({ ...c, ...d.descriptions }));
        if (d.specs) setSpecs((c) => ({ ...c, ...d.specs }));
        if (typeof d.country === "string") setCountry(d.country);
        if (typeof d.region === "string") setRegion(d.region);
        if (typeof d.city === "string") setCity(d.city);
        if (typeof d.price === "string") setPrice(d.price);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // storage unavailable or corrupt: start with an empty form
    }
     
    setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (initial || listing || !draftRestored) return;
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ brandId, modelId, customModel, year, titles, descriptions, specs, country, region, city, price }),
      );
    } catch {
      // storage full or blocked: nothing to do
    }
  }, [initial, listing, draftRestored, brandId, modelId, customModel, year, titles, descriptions, specs, country, region, city, price]);

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
    // The pricing page sends a seller here with ?package=<slug>: offer that package
    // up front even when a free listing or an unused paid one would do.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the address bar once
    setWantedPackage(new URLSearchParams(window.location.search).get("package") ?? "");
  }, []);

  useEffect(() => {
    let active = true;
    void fetchTranslationEnabled().then((enabled) => {
      if (active) setTranslateEnabled(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  async function runTranslate(only?: Lang | "missing") {
    setTranslating(true);
    setTranslateError(false);
    setTranslatedLangs([]);
    try {
      const others = LANGS.map((item) => item.code as Lang).filter((code) => code !== lang);
      const targets =
        only === "missing"
          ? others.filter((code) => !titles[code].trim() || !descriptions[code].trim())
          : only
            ? [only]
            : others;
      if (targets.length === 0) {
        setTranslating(false);
        return;
      }
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
  // The server names what it froze (private seller after submission adds condition and boat type).
  const frozenSpecs = listing?.policy.immutable_fields ?? [];
  const setSpec = (key: string, value: string) =>
    setSpecs((current) => ({ ...current, [key]: key in NUMERIC_SPECS ? numericOnly(value, NUMERIC_SPECS[key]) : value }));

  function payload(): Record<string, unknown> {
    // Specification entries are flat lowercase keys; blanks are dropped, and
    // keys this form does not own are carried over untouched.
    const merged: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(seedSpecs)) {
      if (!(SPEC_KEYS as readonly string[]).includes(key)) merged[key] = value as string | number | boolean | null;
    }
    for (const key of SPEC_KEYS) {
      if (specs[key].trim()) merged[key] = key in NUMERIC_SPECS ? specs[key].trim().replace(",", ".") : specs[key].trim();
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
      ...(placeId !== null ? { location_place_id: placeId } : {}),
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
      if (!listing) {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }
        // The draft now lives on the server: a refresh reopens it instead of a blank form.
        window.history.replaceState(null, "", brokerId ? `/dashboard/broker/fleet/${saved.id}/` : `/sell/${saved.id}/`);
      }
      // Files picked before the draft existed upload now; one that fails stays queued so the next save retries it.
      for (const item of pending) {
        const row = await uploadMedia(saved.id, item.file);
        if (row.status === "REJECTED") {
          setError(t("sell.media_rejected", { reason: row.rejection_reason || item.file.name }));
        }
        URL.revokeObjectURL(item.url);
        setPending((current) => current.filter((entry) => entry !== item));
      }
      if (pending.length > 0) setMedia(await listMedia(saved.id));
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 3000);
    } catch (caught) {
      setError(describe(caught, t));
    } finally {
      setBusy(false);
    }
  }

  // Limits shown before the draft exists follow who is selling and which right will be used.
  const mediaLimits = (() => {
    if (listing) return { images: listing.policy.image_limit, videos: listing.policy.video_limit };
    const l = options?.media_limits;
    if (!l) return { images: 1, videos: 0 };
    if (brokerId) return { images: l.broker_images, videos: l.broker_videos };
    return eligibility?.free.available === false
      ? { images: l.paid_images, videos: l.paid_videos }
      : { images: l.free_images, videos: l.free_videos };
  })();
  const isVideo = (file: File) => file.type.startsWith("video/");
  const imageCount = media.filter((row) => row.media_type === "IMAGE").length + pending.filter((item) => !isVideo(item.file)).length;
  const videoCount = media.filter((row) => row.media_type === "VIDEO").length + pending.filter((item) => isVideo(item.file)).length;

  async function uploadAll(listingId: string, files: File[]) {
    for (const file of files) {
      const row = await uploadMedia(listingId, file);
      if (row.status === "REJECTED") {
        setError(t("sell.media_rejected", { reason: row.rejection_reason || file.name }));
      }
    }
    setMedia(await listMedia(listingId));
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    let images = imageCount;
    let videos = videoCount;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (isVideo(file) ? videos >= mediaLimits.videos : images >= mediaLimits.images) {
        setError(t("sell.media_full", { limit: isVideo(file) ? mediaLimits.videos : mediaLimits.images }));
        continue;
      }
      if (isVideo(file)) videos += 1;
      else images += 1;
      accepted.push(file);
    }
    if (accepted.length === 0) return;
    if (!listing) {
      setPending((current) => [...current, ...accepted.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
      return;
    }
    setBusy(true);
    try {
      await uploadAll(listing.id, accepted);
    } catch (caught) {
      setError(describe(caught, t));
    } finally {
      setBusy(false);
    }
  }

  function dropPending(index: number) {
    setPending((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, i) => i !== index);
    });
  }

  async function reorderTo(row: MediaRow, toPosition: number) {
    if (!listing) return;
    const ids = media.filter((item) => item.media_type === row.media_type).map((item) => item.id);
    const from = ids.indexOf(row.id);
    if (from === -1 || toPosition < 0 || toPosition >= ids.length || toPosition === from) return;
    ids.splice(toPosition, 0, ids.splice(from, 1)[0]);
    try {
      setMedia(await reorderMedia(listing.id, row.media_type, ids));
    } catch (caught) {
      setError(describe(caught, t));
    }
  }

  async function move(row: MediaRow, delta: number) {
    const siblings = media.filter((item) => item.media_type === row.media_type);
    await reorderTo(row, siblings.indexOf(row) + delta);
  }

  function dropOnto(targetRow: MediaRow) {
    const draggedId = dragId;
    setDragId(null);
    if (!draggedId || draggedId === targetRow.id) return;
    const dragged = media.find((item) => item.id === draggedId);
    if (!dragged || dragged.media_type !== targetRow.media_type) return;
    const siblings = media.filter((item) => item.media_type === targetRow.media_type);
    void reorderTo(dragged, siblings.indexOf(targetRow));
  }

  async function remove(row: MediaRow) {
    if (!listing) return;
    try {
      await removeMedia(listing.id, row.id);
      setMedia(await listMedia(listing.id));
    } catch (caught) {
      setError(describe(caught, t));
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
      setError(describe(caught, t));
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div role="status" className="flex max-w-2xl flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <p className="font-title-md text-title-md text-primary">{t("sell.submitted")}</p>
        <p className="font-body-md text-on-surface-variant">{t("sell.submitted_next")}</p>
        <div className="flex flex-wrap gap-space-sm">
          <Link
            href={brokerId ? "/dashboard/broker/fleet/" : "/dashboard/private-seller/listings/"}
            className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container"
          >
            {brokerId ? t("nav.fleet") : t("nav.my_listings")}
          </Link>
          {listing ? (
            <Link
              href={`/dashboard/listings/${listing.id}/preview/`}
              className="rounded-lg border border-primary px-space-lg py-space-sm font-body-md text-primary hover:bg-surface-container-low"
            >
              {t("sell.preview_link")}
            </Link>
          ) : null}
        </div>
      </div>
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
      disabled={frozenSpecs.includes(key)}
      placeholder={t("sell.select")}
      searchPlaceholder={t("sell.search")}
      emptyText={t("sell.no_results")}
    />
  );
  // The card preview shows the price the way the marketplace will ("€189,000"), not the raw input.
  const previewPrice = price ? (safeMoney(locale, price.trim(), "EUR") ?? `€ ${price}`) : "—";
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
  const titleKey = brokerId ? (initial ? "sell.title_broker_edit" : "sell.title_broker") : "sell.title";
  const previewTitle = titles.en || [year, brandName, modelLabel].filter(Boolean).join(" ") || t(titleKey);
  const previewImage = media.find((row) => row.status === "READY" && row.media_type === "IMAGE");
  // The preview card shows the cover the seller sees in the media grid: a ready photo,
  // else any uploaded photo with a preview, else a photo picked but not saved yet.
  const previewUrl =
    previewImage?.preview_url ??
    media.find((row) => row.media_type === "IMAGE" && row.preview_url)?.preview_url ??
    pending.find((item) => !item.file.type.startsWith("video/"))?.url;

  if (blocked) {
    const next = eligibility?.free.next_available_at;
    const date = next ? new Date(next).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
    return (
      <div className="flex flex-col gap-space-lg">
        <header>
          <span className="font-label-sm uppercase tracking-widest text-secondary">{t(brokerId ? "sell.eyebrow_broker" : "sell.eyebrow")}</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{t(titleKey)}</h1>
        </header>
        <section role="alert" className={`${CARD} border-l-4 border-secondary`}>
          <h2 className="font-headline-sm text-headline-sm text-primary">{t("sell.allowance_title")}</h2>
          {date ? <p className="mt-space-xs font-body-md text-on-surface-variant">{t("sell.allowance_next", { date })}</p> : null}
          <div className="mt-space-md">
            <PaidListingBuy label={t("sell.allowance_buy")} />
          </div>
          {error ? <p role="alert" className="mt-space-sm text-error">{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <span className="font-label-sm uppercase tracking-widest text-secondary">{t(brokerId ? "sell.eyebrow_broker" : "sell.eyebrow")}</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">{t(titleKey)}</h1>
        <p className="mt-space-xs max-w-2xl font-body-md text-on-surface-variant">{t(brokerId ? "sell.lead_broker" : "sell.lead")}</p>
      </header>

      {wantedPackage && !listing && !brokerId && eligibility ? (
        <section className={`${CARD} border-l-4 border-secondary`} aria-label={t("sell.package_chosen_title")}>
          <h2 className="font-headline-sm text-headline-sm text-primary">{t("sell.package_chosen_title")}</h2>
          <p className="mt-space-xs font-body-md text-on-surface-variant">
            {eligibility.paid_listing_rights_available > 0
              ? t("sell.package_chosen_owned", { count: eligibility.paid_listing_rights_available })
              : t("sell.package_chosen_lead")}
          </p>
          <div className="mt-space-md">
            <PaidListingBuy label={t("sell.allowance_buy")} />
          </div>
        </section>
      ) : null}

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
                      disabled={frozenSpecs.includes("condition")}
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
                    const picked = brands.find((b) => b.id === value);
                    if (picked) setNames((known) => ({ ...known, [value]: picked.name }));
                  }}
                  onSearch={setBrandQuery}
                  selectedLabel={names[brandId] ?? t("sell.current_brand")}
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
                  onChange={(value) => {
                    setModelId(value);
                    const picked = models.find((m) => m.id === value)?.name ?? (other && other.id === value ? other.label : undefined);
                    if (picked) setNames((known) => ({ ...known, [value]: picked }));
                  }}
                  onSearch={setModelQuery}
                  selectedLabel={names[modelId] ?? t("sell.current_model")}
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
                  <div role="group" aria-label={t("sell.translate_ai")} className="flex flex-wrap items-center gap-space-xs">
                    <span className="font-label-md text-on-surface-variant">
                      {translating ? t("sell.translate_ai_busy") : t("sell.translate_ai")}
                    </span>
                    {LANGS.filter((item) => item.code !== lang).map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => void runTranslate(item.code)}
                        disabled={translating || locked || !(titles[lang] || descriptions[lang])}
                        className="rounded-lg bg-secondary-container px-space-md py-space-xs font-label-md text-on-secondary-container disabled:opacity-50"
                      >
                        {t("sell.translate_to", { lang: item.label.replace(" (Original)", "") })}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void runTranslate("missing")}
                      disabled={translating || locked || !(titles[lang] || descriptions[lang])}
                      className="rounded-lg bg-primary px-space-md py-space-xs font-label-md text-on-primary disabled:opacity-50"
                    >
                      {t("sell.translate_missing")}
                    </button>
                  </div>
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
                <PlacePicker
                  country={country}
                  locale={locale}
                  value={{ placeId, city, region }}
                  onChange={(next) => {
                    setPlaceId(next.placeId);
                    setCity(next.city);
                    setRegion(next.region);
                  }}
                  labels={{ region: t("sell.region"), city: t("sell.city"), hint: t("sell.city_hint") }}
                />
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
            <div className="flex flex-wrap items-center gap-space-md font-label-md text-on-surface-variant">
              <span>{t("sell.photos_counter", { count: imageCount, limit: mediaLimits.images })}</span>
              <span>{t("sell.videos_counter", { count: videoCount, limit: mediaLimits.videos })}</span>
            </div>
            <label className="mt-space-sm flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low p-space-lg text-center font-body-md text-on-surface-variant hover:bg-surface-container">
              <span className="material-symbols-outlined text-3xl text-secondary" aria-hidden="true">add_photo_alternate</span>
              <span>{t("sell.media_drop")}</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4"
                aria-label={t("sell.add_media")}
                disabled={busy}
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="sr-only"
              />
            </label>
            <p className="mt-space-xs font-body-sm text-on-surface-variant">{t("sell.media_hint")}</p>
            {!listing && pending.length > 0 ? <p className="font-body-sm text-on-surface-variant">{t("sell.media_pending")}</p> : null}
            {!brokerId && mediaLimits.images <= 1 ? (
              <div className="mt-space-sm rounded-lg bg-surface-container-low p-space-md">
                <p className="font-body-sm text-on-surface-variant">
                  {t("sell.media_free_note", { images: mediaLimits.images, paid_images: options?.media_limits.paid_images ?? 20, paid_videos: options?.media_limits.paid_videos ?? 1 })}
                </p>
                <p className="mt-space-xs font-body-sm text-on-surface-variant">{t("sell.media_free_continue")}</p>
                <Link href="/pricing/" className="mt-space-sm inline-block rounded-lg border border-primary px-space-md py-space-xs font-body-md text-primary hover:bg-surface-container">
                  {t("sell.media_see_paid")}
                </Link>
              </div>
            ) : null}
            <ul className="mt-space-sm grid grid-cols-2 gap-space-sm sm:grid-cols-3">
              {media.map((row) => {
                const siblings = media.filter((item) => item.media_type === row.media_type);
                const position = siblings.indexOf(row);
                return (
                  <li
                    key={row.id}
                    data-testid={`media-${row.id}`}
                    draggable
                    onDragStart={() => setDragId(row.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropOnto(row);
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={`overflow-hidden rounded-lg bg-surface-container-low cursor-grab active:cursor-grabbing ${dragId === row.id ? "opacity-50" : ""}`}
                  >
                    <div className="relative aspect-[4/3] bg-primary-container">
                      {row.preview_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" src={row.preview_url} className="h-full w-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center font-label-sm text-on-primary">{row.media_type} · {row.status}</span>
                      )}
                      {position === 0 && row.media_type === "IMAGE" ? (
                        <span className="absolute left-1 top-1 rounded bg-primary px-2 py-0.5 font-label-sm text-on-primary">{t("sell.cover")}</span>
                      ) : null}
                    </div>
                    {row.rejection_reason ? <p role="note" className="px-space-xs font-body-sm text-error">{row.rejection_reason}</p> : null}
                    <div className="flex items-center justify-between gap-1 p-space-xs font-label-md">
                      <span className="flex gap-1">
                        <button type="button" draggable={false} aria-label={t("sell.move_earlier")} disabled={position === 0} onClick={() => void move(row, -1)} className="rounded px-2 text-primary disabled:opacity-30">←</button>
                        <button type="button" draggable={false} aria-label={t("sell.move_later")} disabled={position === siblings.length - 1} onClick={() => void move(row, 1)} className="rounded px-2 text-primary disabled:opacity-30">→</button>
                      </span>
                      <button type="button" draggable={false} onClick={() => void remove(row)} className="text-primary underline">
                        {t("sell.remove")}
                      </button>
                    </div>
                  </li>
                );
              })}
              {pending.map((item, index) => (
                <li key={item.url} className="overflow-hidden rounded-lg bg-surface-container-low">
                  <div className="relative aspect-[4/3] bg-primary-container">
                    {!isVideo(item.file) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={item.url} className="h-full w-full object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center font-label-sm text-on-primary">VIDEO</span>
                    )}
                  </div>
                  <div className="flex justify-end p-space-xs font-label-md">
                    <button type="button" onClick={() => dropPending(index)} className="text-primary underline">
                      {t("sell.remove")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg bg-surface-container-low p-space-md" aria-labelledby="step-contact">
            <p id="step-contact" className="flex items-center gap-space-xs font-title-sm text-title-sm text-primary">
              <span className="material-symbols-outlined text-base text-secondary" aria-hidden="true">lock</span>
              {t("sell.step.contact")}
            </p>
            <p className="mt-1 font-body-sm text-on-surface-variant">{t("sell.contact_note")}</p>
          </section>

          {listing ? (
            <div className="flex items-center gap-space-md">
              <button
                type="button"
                disabled={busy || media.every((row) => row.status !== "READY")}
                onClick={() => (promoPaid ? void submit() : setAskPromo(true))}
                className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container disabled:opacity-50"
              >
                {t("sell.submit")}
              </button>
              <Link
                href={`/dashboard/listings/${listing.id}/preview/`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-primary px-space-lg py-space-sm font-body-md text-primary hover:bg-surface-container-low"
              >
                {t("sell.preview_link")}
              </Link>
            </div>
          ) : null}
          {listing && media.every((row) => row.status !== "READY") ? (
            <p className="font-body-sm text-on-surface-variant">
              {media.length === 0 && pending.length === 0 ? t("sell.submit_needs_photo") : t("sell.submit_wait_media")}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="text-error">
              {error}
            </p>
          ) : null}
          {promoPaid ? <p role="status" className="font-body-md text-secondary">{t("promo.paid")}</p> : null}
          {askPromo && listing ? (
            <PromotionDialog
              listingId={listing.id}
              title={titles.en || titles.it || titles.es}
              imageUrl={previewImage?.preview_url}
              locale={locale}
              returnPath={`/sell/${listing.id}/`}
              onSkip={() => {
                setAskPromo(false);
                void submit();
              }}
            />
          ) : null}
        </div>

        <aside aria-label={t("sell.preview")} className="h-fit lg:sticky lg:top-space-lg">
          <div className="overflow-hidden rounded-lg bg-surface-container-lowest shadow-sm">
            <div className="flex items-center justify-between bg-surface-container-low p-space-md">
              <span className="font-label-sm text-label-sm font-semibold uppercase text-primary">{t("sell.preview")}</span>
              <span className="rounded bg-surface-container-lowest px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">{t("sell.live_sync")}</span>
            </div>
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary-container" data-testid="preview-image">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-full w-full object-cover" src={previewUrl} />
              ) : null}
              {city || country ? (
                <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded bg-surface-container-lowest/90 px-2.5 py-1 font-label-sm text-label-sm text-primary shadow-sm backdrop-blur">
                  <span className="material-symbols-outlined text-xs text-secondary" aria-hidden="true">location_on</span>
                  <span>{[city, country.toUpperCase()].filter(Boolean).join(", ")}</span>
                </div>
              ) : null}
              {specs.condition ? (
                <div className="absolute left-3 top-3 rounded bg-primary/80 px-2.5 py-1 font-label-sm text-label-sm uppercase tracking-wider text-on-primary backdrop-blur">
                  {specs.condition === "new" ? t("sell.condition.new") : t("sell.condition.used")}
                  {year ? ` · ${year}` : ""}
                </div>
              ) : null}
            </div>
            <div className="p-space-lg">
              <p className="font-headline-sm text-headline-sm leading-snug text-primary">{previewTitle}</p>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                {[year, specs.loa_m ? `${specs.loa_m} m` : "", specs.engine_model].filter(Boolean).join(" · ") || " "}
              </p>
              <div className="mt-space-md pt-space-sm">
                <span className="block font-label-sm text-label-sm uppercase text-outline">{t("sell.asking_price")}</span>
                <span className="font-spec-num text-lg font-semibold text-primary">{previewPrice}</span>
              </div>
              <div className="mt-space-lg rounded-lg bg-surface-container p-space-sm">
                <span className="mb-1 block font-label-sm text-label-sm uppercase text-on-surface-variant">{t("sell.translation_health")}</span>
                <div className="flex flex-wrap items-center gap-space-sm text-body-sm">
                  {LANGS.map((item) => {
                    const filled = [titles[item.code], descriptions[item.code]].filter((value) => value.trim()).length;
                    const percent = Math.round((filled / 2) * 100);
                    return (
                      <span key={item.code} className={`flex items-center gap-1 ${percent === 100 ? "font-medium text-secondary" : "text-outline"}`}>
                        <span className={`h-2 w-2 rounded-full ${percent === 100 ? "bg-secondary" : "bg-surface-dim"}`} aria-hidden="true" />
                        {item.code.toUpperCase()} ({percent}%)
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-space-sm bg-surface-container-low p-space-md font-body-sm text-body-sm text-on-surface-variant">
              <span className="material-symbols-outlined mt-0.5 shrink-0 text-base text-secondary" aria-hidden="true">policy</span>
              <p>{t("sell.preview_note")}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
