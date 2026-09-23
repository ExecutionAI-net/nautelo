"use client";

import Link from "@/components/layout/LocaleLink";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import {
  decideRevision,
  fetchRevisionDetail,
  type Decision,
  type RevisionDetail,
  type RevisionMedia,
} from "@/lib/api/staffModeration";

const NEEDS_NOTE: Decision[] = ["REQUEST_CHANGES", "REJECT"];

// What a moderator reads for each payload field (the API keys are the seller form's).
const FIELD_LABELS: Record<string, string> = {
  brand_id: "Brand",
  model_id: "Model",
  custom_model_name: "Custom model name",
  manufacture_year: "Year",
  title_en: "Title (EN)",
  title_it: "Title (IT)",
  title_es: "Title (ES)",
  description_en: "Description (EN)",
  description_it: "Description (IT)",
  description_es: "Description (ES)",
  location_country: "Country",
  location_region: "Region",
  location_city: "City",
  location_place_id: "Place",
  currency: "Currency",
  price: "Price",
  show_finance_estimate: "Show finance estimate",
  finance_down_payment_override_percent: "Finance: down payment %",
  finance_rate_override_percent: "Finance: rate %",
  finance_term_override_months: "Finance: term (months)",
};

const SPEC_LABELS: Record<string, string> = {
  boat_type: "Boat type",
  condition: "Condition",
  loa_m: "Length (m)",
  length_m: "Length (m)",
  beam_m: "Beam (m)",
  draft_m: "Draft (m)",
  cabins: "Cabins",
  berths: "Berths",
  heads: "Bathrooms",
  hull_material: "Hull",
  engines: "Engines",
  engine_power_hp: "Engine power (hp)",
  engine_hours: "Engine hours",
  fuel_type: "Fuel",
  max_speed_kn: "Top speed (kn)",
  fuel_capacity_l: "Fuel tank (L)",
  water_capacity_l: "Water tank (L)",
  vat_paid: "VAT paid",
};

function tidy(key: string): string {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function fieldLabel(field: string): string {
  if (field.startsWith("specifications.")) {
    const key = field.slice("specifications.".length);
    return `Spec: ${SPEC_LABELS[key] ?? tidy(key)}`;
  }
  return FIELD_LABELS[field] ?? tidy(field);
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (value === true) return "Yes";
  if (value === false) return "No";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

const CHANGE_LABEL: Record<string, string> = { added: "New", removed: "Removed", kept: "Kept" };

function MediaGallery({ items }: { items: RevisionMedia[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-space-sm grid grid-cols-2 gap-space-sm sm:grid-cols-3 lg:grid-cols-4" aria-label="Photos and videos">
      {items.map((item) => (
        <li key={item.id} className="overflow-hidden rounded-lg bg-surface-container-low">
          <div className="aspect-[4/3] w-full bg-surface-container-high">
            {item.url && item.media_type === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element -- CDN or signed URL
              <img src={item.url} alt="" className={item.change === "removed" ? "h-full w-full object-cover opacity-50" : "h-full w-full object-cover"} loading="lazy" />
            ) : item.url && item.media_type === "VIDEO" ? (
              <video src={item.url} controls preload="metadata" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center font-label-sm text-on-surface-variant">
                {item.media_type} · {item.status}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between p-space-xs font-label-sm">
            <span className={item.change === "removed" ? "text-error" : item.change === "added" ? "text-secondary" : "text-on-surface-variant"}>
              {CHANGE_LABEL[item.change ?? ""] ?? ""}
            </span>
            <span className="text-on-surface-variant">
              {item.status !== "READY" ? item.status : item.width && item.height ? `${item.width}×${item.height}` : ""}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function RevisionReview({ revisionId }: { revisionId: string }) {
  const [detail, setDetail] = useState<RevisionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRevisionDetail(revisionId)
      .then((body) => {
        if (!cancelled) setDetail(body);
      })
      .catch(() => {
        if (!cancelled) setError("This revision could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [revisionId]);

  async function decide(decision: Decision) {
    if (!detail) return;
    if (NEEDS_NOTE.includes(decision) && !note.trim()) {
      setError("A reason is required for this decision.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await decideRevision(revisionId, {
        decision,
        version: detail.version,
        note,
      });
      setDone(decision);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? "This revision changed or was already decided. Reload to see the latest state."
          : "The decision could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return error ? (
      <p role="alert">{error}</p>
    ) : (
      <p className="text-on-surface-variant">Loading…</p>
    );
  }
  if (done) {
    return (
      <p role="status" className="font-body-md">
        Decision recorded: {done.replace("_", " ").toLowerCase()}.{" "}
        <Link href="/dashboard/staff/" className="text-primary underline">
          Back to queue
        </Link>
      </p>
    );
  }

  const decidable = detail.state === "SUBMITTED";
  return (
    <section className="flex flex-col gap-space-md">
      <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">
        Staff Admin / Revision review
      </span>
      <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
        {detail.year} {detail.brand} {detail.model}
      </h1>
      <p className="font-body-sm text-on-surface-variant">
        {detail.seller} · {detail.submission_type} · state {detail.state}
      </p>

      {detail.warnings.length > 0 ? (
        <ul
          className="mt-space-md flex flex-col gap-space-xs"
          aria-label="Warnings"
        >
          {detail.warnings.map((warning) => (
            <li
              key={warning.code}
              className="rounded-lg bg-secondary-container text-on-secondary-container p-space-sm font-body-sm"
            >
              {warning.code === "other_model"
                ? `Uses the Other model: “${String(warning.custom_model_name ?? "")}”`
                : warning.code === "media_not_ready"
                  ? `${String(warning.count)} media item(s) are not ready`
                  : warning.code}
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className="mt-space-md font-title-md text-title-md text-primary">
        Changes
      </h2>
      {detail.diff.length === 0 ? (
        <p className="text-on-surface-variant">No field changes.</p>
      ) : (
        <table className="mt-space-sm w-full text-left font-body-sm bg-surface-container-lowest rounded-xl shadow-sm [&_th]:p-space-sm [&_td]:p-space-sm [&_tr]:border-b [&_tr]:border-outline-variant/40">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
            </tr>
          </thead>
          <tbody>
            {detail.diff.map((change) => (
              <tr key={change.field}>
                <th scope="row">{fieldLabel(change.field)}</th>
                <td>{show(change.before)}</td>
                <td>{show(change.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2 className="mt-space-md font-title-md text-title-md text-primary">Media</h2>
      <p className="mt-space-xs font-body-sm text-on-surface-variant">
        {detail.media_diff.added.length} new, {detail.media_diff.removed.length} removed, {detail.media_diff.kept} kept
      </p>
      <MediaGallery items={[...(detail.media_diff.proposed ?? detail.media_diff.added), ...detail.media_diff.removed]} />

      {decidable ? (
        <div className="mt-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <label className="block font-body-md" htmlFor="decision-note">
            Note (required to reject or request changes)
          </label>
          <textarea
            id="decision-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-space-xs w-full rounded-lg bg-surface-container-low p-space-sm"
            rows={3}
          />
          {error ? (
            <p role="alert" className="mt-space-xs text-error">
              {error}
            </p>
          ) : null}
          <div className="mt-space-sm flex flex-wrap gap-space-sm">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg px-space-md py-space-sm font-label-md font-semibold disabled:opacity-50 bg-primary text-on-primary"
              onClick={() => void decide("APPROVE")}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg px-space-md py-space-sm font-label-md font-semibold disabled:opacity-50 bg-secondary-container text-on-secondary-container"
              onClick={() => void decide("REQUEST_CHANGES")}
            >
              Request changes
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg px-space-md py-space-sm font-label-md font-semibold disabled:opacity-50 bg-error text-on-error"
              onClick={() => void decide("REJECT")}
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-space-lg text-on-surface-variant">
          This revision is not awaiting a decision.
        </p>
      )}
    </section>
  );
}
