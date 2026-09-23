"use client";

// Spec §29.7: share by WhatsApp, Facebook, LinkedIn or copy link. Only the
// canonical URL is ever shared — no title, price or contact text is
// appended; the listing's own photo comes from the page's own og:image
// metadata (see generateMetadata in app/boats/[slug]/page.tsx), not from
// anything passed here.
import { useState } from "react";

const COPY: Record<
  string,
  { share: string; whatsapp: string; facebook: string; linkedin: string; copy: string; copied: string }
> = {
  en: {
    share: "Share",
    whatsapp: "Share on WhatsApp",
    facebook: "Share on Facebook",
    linkedin: "Share on LinkedIn",
    copy: "Copy link",
    copied: "Link copied",
  },
  it: {
    share: "Condividi",
    whatsapp: "Condividi su WhatsApp",
    facebook: "Condividi su Facebook",
    linkedin: "Condividi su LinkedIn",
    copy: "Copia link",
    copied: "Link copiato",
  },
  es: {
    share: "Compartir",
    whatsapp: "Compartir en WhatsApp",
    facebook: "Compartir en Facebook",
    linkedin: "Compartir en LinkedIn",
    copy: "Copiar enlace",
    copied: "Enlace copiado",
  },
};

export default function ShareButtons({ url, locale }: { url: string; locale: string }) {
  const text = COPY[locale] ?? COPY.en;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-space-sm" aria-label={text.share} role="group">
      <a
        className="rounded-lg border border-outline-variant px-space-sm py-space-xs font-body-md text-primary"
        href={`https://wa.me/?text=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {text.whatsapp}
      </a>
      <a
        className="rounded-lg border border-outline-variant px-space-sm py-space-xs font-body-md text-primary"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {text.facebook}
      </a>
      <a
        className="rounded-lg border border-outline-variant px-space-sm py-space-xs font-body-md text-primary"
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {text.linkedin}
      </a>
      <button
        type="button"
        onClick={copy}
        className="rounded-lg border border-outline-variant px-space-sm py-space-xs font-body-md text-primary"
      >
        {text.copy}
      </button>
      <span role="status" aria-live="polite" className="font-body-sm text-on-surface-variant">
        {copied ? text.copied : ""}
      </span>
    </div>
  );
}
