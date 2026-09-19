"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import {
  decideRevision,
  fetchRevisionDetail,
  type Decision,
  type RevisionDetail,
} from "@/lib/api/staffModeration";

const NEEDS_NOTE: Decision[] = ["REQUEST_CHANGES", "REJECT"];

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
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
      await decideRevision(revisionId, { decision, version: detail.version, note });
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
    <section>
      <h1 className="font-headline-md text-headline-md text-primary">
        {detail.year} {detail.brand} {detail.model}
      </h1>
      <p className="font-body-sm text-on-surface-variant">
        {detail.seller} · {detail.submission_type} · state {detail.state}
      </p>

      {detail.warnings.length > 0 ? (
        <ul className="mt-space-md flex flex-col gap-space-xs" aria-label="Warnings">
          {detail.warnings.map((warning) => (
            <li key={warning.code} className="rounded-lg border border-outline-variant p-space-sm">
              {warning.code === "other_model"
                ? `Uses the Other model: “${String(warning.custom_model_name ?? "")}”`
                : warning.code === "media_not_ready"
                  ? `${String(warning.count)} media item(s) are not ready`
                  : warning.code}
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className="mt-space-lg font-title-md text-title-md">Changes</h2>
      {detail.diff.length === 0 ? (
        <p className="text-on-surface-variant">No field changes.</p>
      ) : (
        <table className="mt-space-sm w-full text-left font-body-sm">
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
                <th scope="row">{change.field}</th>
                <td>{show(change.before)}</td>
                <td>{show(change.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-space-sm font-body-sm text-on-surface-variant">
        Media: +{detail.media_diff.added.length} / −{detail.media_diff.removed.length}, kept{" "}
        {detail.media_diff.kept}
      </p>

      {decidable ? (
        <div className="mt-space-lg">
          <label className="block font-body-md" htmlFor="decision-note">
            Note (required to reject or request changes)
          </label>
          <textarea
            id="decision-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-space-xs w-full rounded-lg border border-outline-variant p-space-sm"
            rows={3}
          />
          {error ? (
            <p role="alert" className="mt-space-xs text-error">
              {error}
            </p>
          ) : null}
          <div className="mt-space-sm flex flex-wrap gap-space-sm">
            <button type="button" disabled={busy} onClick={() => void decide("APPROVE")}>
              Approve
            </button>
            <button type="button" disabled={busy} onClick={() => void decide("REQUEST_CHANGES")}>
              Request changes
            </button>
            <button type="button" disabled={busy} onClick={() => void decide("REJECT")}>
              Reject
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-space-lg text-on-surface-variant">This revision is not awaiting a decision.</p>
      )}
    </section>
  );
}
