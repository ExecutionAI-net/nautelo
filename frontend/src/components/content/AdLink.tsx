import Link from "next/link";

import type { PublicAd } from "@/lib/api/content";

const CARD_CLASS =
  "inline-flex items-center justify-between gap-space-xs py-2 px-space-md rounded-lg bg-surface-container text-primary hover:bg-surface-container-high transition-colors font-label-md text-label-md";

/** The ad's call to action: a broker or professional's own page stays on the site, anything else opens as a sponsored external link. */
export default function AdLink({ ad, className = CARD_CLASS }: { ad: PublicAd; className?: string }) {
  const internal = ad.cta_url.startsWith("/");
  const label = (
    <>
      <span>{ad.cta_label}</span>
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
    </>
  );
  return internal ? (
    <Link href={ad.cta_url} className={className}>
      {label}
    </Link>
  ) : (
    <a href={ad.cta_url} rel="sponsored noopener noreferrer" target="_blank" className={className}>
      {label}
    </a>
  );
}
