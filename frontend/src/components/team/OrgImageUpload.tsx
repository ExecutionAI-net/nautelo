"use client";

import { useState } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";

const JSON_HEADERS = { "Content-Type": "application/json" };
const TYPES = ["image/jpeg", "image/png", "image/webp"];

const REASONS: Record<string, string> = {
  unsupported_image_type: "Use a JPEG, PNG or WebP image.",
  image_too_large: "The image is larger than 5 MB.",
  image_too_small: "The image is too small. Use at least 128x128 for a logo and 600x200 for a cover.",
  unreadable_image: "The image could not be read. Try another file.",
  upload_missing: "The upload did not arrive. Please try again.",
};

/** Upload a logo or cover straight to storage (presigned PUT), then confirm it with the API. */
export default function OrgImageUpload({
  intentUrl,
  completeUrl,
  kind,
  label,
  currentUrl,
  onUploaded,
}: {
  intentUrl: string;
  completeUrl: string;
  kind: "logo" | "cover";
  label: string;
  currentUrl: string | null | undefined;
  onUploaded?: (urls: { logo_url: string | null; cover_url: string | null }) => void;
}) {
  const [url, setUrl] = useState<string | null | undefined>(currentUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    if (!TYPES.includes(file.type)) {
      setMessage(REASONS.unsupported_image_type);
      return;
    }
    setBusy(true);
    try {
      const intent = await apiFetch<{ key: string; url: string; method: string; headers: Record<string, string> }>(intentUrl, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ kind, mime_type: file.type, size: file.size }),
      });
      const put = await fetch(intent.url, { method: intent.method, headers: intent.headers, body: file });
      if (!put.ok) throw new Error("upload failed");
      const done = await apiFetch<{ logo_url: string | null; cover_url: string | null }>(completeUrl, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ kind, key: intent.key, mime_type: file.type }),
      });
      setUrl(kind === "logo" ? done.logo_url : done.cover_url);
      onUploaded?.(done);
      setMessage("Image saved.");
    } catch (caught) {
      const code = caught instanceof ApiError ? Object.values(caught.fields)[0]?.[0]?.message : undefined;
      setMessage((code && REASONS[code]) || "The image could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-xs">
      <span className="font-label-sm uppercase text-on-surface-variant">{label}</span>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not optimisable
        <img alt={label} src={url} className={kind === "logo" ? "h-20 w-20 rounded-lg object-cover" : "h-24 w-full max-w-md rounded-lg object-cover"} />
      ) : (
        <p className="font-body-sm text-on-surface-variant">No image yet.</p>
      )}
      <input
        type="file"
        accept={TYPES.join(",")}
        disabled={busy}
        aria-label={`Upload ${label.toLowerCase()}`}
        onChange={(event) => void pick(event.target.files?.[0])}
      />
      {message ? (
        <p role="status" className="font-body-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
