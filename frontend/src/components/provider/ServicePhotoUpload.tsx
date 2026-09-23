"use client";

import { useState } from "react";

import { ApiError, apiFetch } from "@/lib/api/client";

const JSON_HEADERS = { "Content-Type": "application/json" };
const TYPES = ["image/jpeg", "image/png", "image/webp"];

const REASONS: Record<string, string> = {
  unsupported_image_type: "Use a JPEG, PNG or WebP image.",
  image_too_large: "The image is larger than 5 MB.",
  image_too_small: "The image is too small. Use at least 300x200.",
  unreadable_image: "The image could not be read. Try another file.",
  upload_missing: "The upload did not arrive. Please try again.",
};

/** One photo per service card, uploaded the same way as a profile logo/cover (presigned PUT, then confirmed). */
export default function ServicePhotoUpload({
  serviceId,
  currentUrl,
  onUploaded,
}: {
  serviceId: string;
  currentUrl: string | null | undefined;
  onUploaded?: (photoUrl: string | null) => void;
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
      const intent = await apiFetch<{ key: string; url: string; method: string; headers: Record<string, string> }>(
        `/api/v1/provider/services/${serviceId}/images/intent/`,
        { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ kind: "photo", mime_type: file.type, size: file.size }) },
      );
      const put = await fetch(intent.url, { method: intent.method, headers: intent.headers, body: file });
      if (!put.ok) throw new Error("upload failed");
      const done = await apiFetch<{ photo_url: string | null }>(`/api/v1/provider/services/${serviceId}/images/complete/`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ kind: "photo", key: intent.key, mime_type: file.type }),
      });
      setUrl(done.photo_url);
      onUploaded?.(done.photo_url);
      setMessage("Photo saved.");
    } catch (caught) {
      const code = caught instanceof ApiError ? Object.values(caught.fields)[0]?.[0]?.message : undefined;
      setMessage((code && REASONS[code]) || "The photo could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, not optimisable
        <img alt="" src={url} className="h-12 w-16 rounded object-cover" />
      ) : (
        <span className="font-body-sm text-on-surface-variant">No photo</span>
      )}
      <input
        type="file"
        accept={TYPES.join(",")}
        disabled={busy}
        aria-label="Upload service photo"
        className="max-w-[160px] font-body-sm"
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
