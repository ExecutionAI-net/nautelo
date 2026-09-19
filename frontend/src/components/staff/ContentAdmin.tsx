"use client";

import { useCallback, useEffect, useState } from "react";

import {
  staffAds,
  staffGuides,
  type AdPlacement,
  type StaffAd,
  type StaffGuide,
} from "@/lib/api/content";

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md focus:outline-none";
const CARD = "rounded-xl bg-surface-container-lowest p-space-lg shadow-sm";
const PLACEMENTS: AdPlacement[] = ["HOME", "BOAT_LIST", "BOAT_DETAIL", "DIRECTORY", "GUIDES"];

function rowsOf<T>(value: { results: T[] } | T[]): T[] {
  return Array.isArray(value) ? value : value.results;
}

export default function ContentAdmin() {
  const [guides, setGuides] = useState<StaffGuide[]>([]);
  const [ads, setAds] = useState<StaffAd[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [guideDraft, setGuideDraft] = useState({ title: "", slug: "", category: "", excerpt: "", hero_image_url: "", body: "" });
  const [adDraft, setAdDraft] = useState({
    placement: "HOME" as AdPlacement,
    sponsor: "",
    headline: "",
    body: "",
    cta_label: "",
    cta_url: "",
  });

  const reload = useCallback(async () => {
    try {
      const [g, a] = await Promise.all([staffGuides.list(), staffAds.list()]);
      setGuides(rowsOf(g));
      setAds(rowsOf(a));
    } catch {
      setMessage("The content could not be loaded.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void reload();
  }, [reload]);

  async function run(action: () => Promise<unknown>, done: string) {
    setMessage(null);
    try {
      await action();
      setMessage(done);
      await reload();
    } catch {
      setMessage("The change could not be saved.");
    }
  }

  return (
    <div className="flex flex-col gap-space-xl">
      <div>
        <span className="font-label-sm uppercase tracking-widest text-secondary">Editorial / Advertising</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary">Guides and advertisements</h1>
        {message ? (
          <p role="status" className="mt-space-sm font-body-md">
            {message}
          </p>
        ) : null}
      </div>

      <section className={CARD} aria-labelledby="guides-heading">
        <h2 id="guides-heading" className="font-headline-sm text-headline-sm text-primary">
          Guides
        </h2>
        <ul className="mt-space-md divide-y divide-outline-variant">
          {guides.map((guide) => (
            <li key={guide.id} className="flex flex-wrap items-center justify-between gap-space-sm py-space-sm">
              <div>
                <p className="font-title-sm text-title-sm text-on-surface">{guide.title}</p>
                <p className="font-body-sm text-on-surface-variant">
                  /{guide.slug}/ · {guide.status === "PUBLISHED" ? "Published" : "Draft"}
                </p>
              </div>
              <div className="flex gap-space-sm">
                <button
                  type="button"
                  className="font-body-md text-primary underline"
                  onClick={() =>
                    void run(
                      () => staffGuides.update(guide.id, { status: guide.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }),
                      "Guide updated.",
                    )
                  }
                >
                  {guide.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  className="font-body-md text-error underline"
                  onClick={() => void run(() => staffGuides.remove(guide.id), "Guide deleted.")}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {guides.length === 0 ? <li className="py-space-sm font-body-md text-on-surface-variant">No guides yet.</li> : null}
        </ul>
        <form
          className="mt-space-md grid gap-space-sm sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => staffGuides.create({ ...guideDraft, status: "DRAFT" }), "Guide created as a draft.");
            setGuideDraft({ title: "", slug: "", category: "", excerpt: "", hero_image_url: "", body: "" });
          }}
        >
          <label className="font-label-sm uppercase text-on-surface-variant">
            Title
            <input className={FIELD} required value={guideDraft.title} onChange={(e) => setGuideDraft({ ...guideDraft, title: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Slug
            <input className={FIELD} required pattern="[a-z0-9-]+" value={guideDraft.slug} onChange={(e) => setGuideDraft({ ...guideDraft, slug: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Category
            <input className={FIELD} value={guideDraft.category} onChange={(e) => setGuideDraft({ ...guideDraft, category: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Hero image URL
            <input className={FIELD} type="url" value={guideDraft.hero_image_url} onChange={(e) => setGuideDraft({ ...guideDraft, hero_image_url: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant sm:col-span-2">
            Excerpt
            <input className={FIELD} maxLength={400} value={guideDraft.excerpt} onChange={(e) => setGuideDraft({ ...guideDraft, excerpt: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant sm:col-span-2">
            Body (blank line = new paragraph)
            <textarea className={FIELD} rows={6} value={guideDraft.body} onChange={(e) => setGuideDraft({ ...guideDraft, body: e.target.value })} />
          </label>
          <button type="submit" className="self-start rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary sm:col-span-2">
            Add guide
          </button>
        </form>
      </section>

      <section className={CARD} aria-labelledby="ads-heading">
        <h2 id="ads-heading" className="font-headline-sm text-headline-sm text-primary">
          Advertisements
        </h2>
        <ul className="mt-space-md divide-y divide-outline-variant">
          {ads.map((ad) => (
            <li key={ad.id} className="flex flex-wrap items-center justify-between gap-space-sm py-space-sm">
              <div>
                <p className="font-title-sm text-title-sm text-on-surface">{ad.headline}</p>
                <p className="font-body-sm text-on-surface-variant">
                  {ad.placement} · {ad.sponsor} · {ad.is_active ? "Active" : "Paused"}
                </p>
              </div>
              <div className="flex gap-space-sm">
                <button
                  type="button"
                  className="font-body-md text-primary underline"
                  onClick={() => void run(() => staffAds.update(ad.id, { is_active: !ad.is_active }), "Advertisement updated.")}
                >
                  {ad.is_active ? "Pause" : "Activate"}
                </button>
                <button
                  type="button"
                  className="font-body-md text-error underline"
                  onClick={() => void run(() => staffAds.remove(ad.id), "Advertisement deleted.")}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {ads.length === 0 ? <li className="py-space-sm font-body-md text-on-surface-variant">No advertisements yet.</li> : null}
        </ul>
        <form
          className="mt-space-md grid gap-space-sm sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => staffAds.create(adDraft), "Advertisement created.");
            setAdDraft({ ...adDraft, sponsor: "", headline: "", body: "", cta_label: "", cta_url: "" });
          }}
        >
          <label className="font-label-sm uppercase text-on-surface-variant">
            Placement
            <select className={FIELD} value={adDraft.placement} onChange={(e) => setAdDraft({ ...adDraft, placement: e.target.value as AdPlacement })}>
              {PLACEMENTS.map((placement) => (
                <option key={placement} value={placement}>
                  {placement}
                </option>
              ))}
            </select>
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Sponsor
            <input className={FIELD} required value={adDraft.sponsor} onChange={(e) => setAdDraft({ ...adDraft, sponsor: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant sm:col-span-2">
            Headline
            <input className={FIELD} required value={adDraft.headline} onChange={(e) => setAdDraft({ ...adDraft, headline: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant sm:col-span-2">
            Text
            <input className={FIELD} maxLength={500} value={adDraft.body} onChange={(e) => setAdDraft({ ...adDraft, body: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Button label
            <input className={FIELD} value={adDraft.cta_label} onChange={(e) => setAdDraft({ ...adDraft, cta_label: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Button URL
            <input className={FIELD} type="url" value={adDraft.cta_url} onChange={(e) => setAdDraft({ ...adDraft, cta_url: e.target.value })} />
          </label>
          <button type="submit" className="self-start rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary sm:col-span-2">
            Add advertisement
          </button>
        </form>
      </section>
    </div>
  );
}
