import { fetchAds, type AdPlacement } from "@/lib/api/content";

/** One sponsored banner for a placement; renders nothing when there is no active ad. */
export default async function AdSlot({ placement }: { placement: AdPlacement }) {
  const [ad] = await fetchAds(placement);
  if (!ad) return null;
  return (
    <aside
      aria-label="Advertisement"
      className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-low p-space-lg sm:flex-row sm:items-center"
    >
      <div>
        <span className="font-label-sm uppercase tracking-widest text-on-surface-variant">Advertisement · {ad.sponsor}</span>
        <p className="mt-1 font-headline-sm text-headline-sm text-primary">{ad.headline}</p>
        {ad.body ? <p className="mt-space-xs max-w-2xl font-body-md text-on-surface-variant">{ad.body}</p> : null}
      </div>
      {ad.cta_url && ad.cta_label ? (
        <a
          href={ad.cta_url}
          rel="sponsored noopener noreferrer"
          target="_blank"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary hover:bg-primary-container"
        >
          {ad.cta_label}
        </a>
      ) : null}
    </aside>
  );
}
