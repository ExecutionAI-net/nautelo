"use client";

import { useEffect, useState } from "react";

import MediaUpgradePanel from "@/components/listings/MediaUpgradePanel";
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

function describe(error: unknown): string {
  if (error instanceof ApiError) {
    const first = Object.values(error.fields)[0]?.[0]?.message;
    return first || error.message || "The request failed.";
  }
  return "The request failed.";
}

export default function SellListingForm({ brokerId }: { brokerId?: string }) {
  const [brands, setBrands] = useState<TaxonomyItem[]>([]);
  const [models, setModels] = useState<TaxonomyItem[]>([]);
  const [other, setOther] = useState<{ id: string; label: string } | null>(null);
  const [brandQuery, setBrandQuery] = useState("");
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");

  const [listing, setListing] = useState<WorkflowListing | null>(null);
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
      setError(describe(caught));
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
      setError(describe(caught));
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
      setError(describe(caught));
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
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <p role="status" className="font-body-md">
        Your listing was submitted for review.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <form onSubmit={saveDetails} className="flex flex-col gap-space-md">
        <h1 className="font-headline-md text-headline-md text-primary">Sell your boat</h1>

        <label className="font-body-md">
          Search brand
          <input className={FIELD} value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} disabled={locked} />
        </label>
        <label className="font-body-md">
          Brand
          <select className={FIELD} value={brandId} onChange={(e) => { setBrandId(e.target.value); setModelId(""); }} disabled={locked} required>
            <option value="">Select…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className="font-body-md">
          Model
          <select className={FIELD} value={modelId} onChange={(e) => setModelId(e.target.value)} disabled={locked || !brandId} required>
            <option value="">Select…</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
            {other ? <option value={other.id}>{other.label}</option> : null}
          </select>
        </label>
        {isOther ? (
          <label className="font-body-md">
            Model name
            <input className={FIELD} value={customModel} onChange={(e) => setCustomModel(e.target.value)} minLength={2} required />
          </label>
        ) : null}
        <label className="font-body-md">
          Year
          <input className={FIELD} type="number" value={year} onChange={(e) => setYear(e.target.value)} disabled={locked} required />
        </label>
        <label className="font-body-md">
          Title
          <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </label>
        <label className="font-body-md">
          Description
          <textarea className={FIELD} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </label>
        <label className="font-body-md">
          Country (2-letter code)
          <input className={FIELD} value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} required />
        </label>
        <label className="font-body-md">
          City
          <input className={FIELD} value={city} onChange={(e) => setCity(e.target.value)} required />
        </label>
        <label className="font-body-md">
          Price (EUR)
          <input className={FIELD} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy} className="self-start rounded-lg bg-primary px-space-md py-space-sm text-on-primary">
          {listing ? "Save changes" : "Save draft"}
        </button>
      </form>

      {listing ? (
        <section aria-labelledby="media-heading">
          <h2 id="media-heading" className="font-title-md text-title-md">Photos and videos</h2>
          <p className="font-body-sm text-on-surface-variant">
            Up to {listing.policy.image_limit} images and {listing.policy.video_limit} videos.
          </p>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4"
            aria-label="Add media"
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
                  Remove
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
            Submit for review
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
