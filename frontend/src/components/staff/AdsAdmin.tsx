"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchAdTargets, staffAds, type AdPlacement, type AdTargets, type StaffAd } from "@/lib/api/content";

const PLACEMENTS: { value: AdPlacement; label: string; blurb: string }[] = [
  { value: "HOME", label: "Homepage", blurb: "Above-the-fold sponsorship on the landing experience." },
  { value: "BOAT_LIST", label: "Boat listings", blurb: "In-feed sponsored card between boat results." },
  { value: "BOAT_DETAIL", label: "Boat detail", blurb: "Sponsor block beside a vessel's specifications." },
  { value: "DIRECTORY", label: "Directories", blurb: "Broker and professional directory placements." },
  { value: "GUIDES", label: "Guides", blurb: "Editorial pages: sponsored slot within guides." },
];

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md focus:outline-none";

function rowsOf<T>(value: { results: T[] } | T[]): T[] {
  return Array.isArray(value) ? value : value.results;
}

function flightWindow(ad: StaffAd): string {
  const short = (value: string | null) => (value ? value.slice(0, 10) : null);
  if (!ad.starts_at && !ad.ends_at) return "Always on";
  return `${short(ad.starts_at) ?? "-"} to ${short(ad.ends_at) ?? "open"}`;
}

export default function AdsAdmin() {
  const [ads, setAds] = useState<StaffAd[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState({ placement: "HOME" as AdPlacement, sponsor: "", headline: "", body: "", cta_label: "", cta_url: "", target: "" });
  const [targets, setTargets] = useState<AdTargets>({ brokers: [], professionals: [] });

  const reload = useCallback(async () => {
    try {
      setAds(rowsOf(await staffAds.list()));
    } catch {
      setMessage("The content could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void fetchAdTargets().then(setTargets).catch(() => undefined);
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

  const active = ads.filter((ad) => ad.is_active);
  const covered = new Set(active.map((ad) => ad.placement));
  const needle = q.trim().toLowerCase();
  const visible = ads.filter((ad) => !needle || `${ad.sponsor} ${ad.headline} ${ad.placement}`.toLowerCase().includes(needle));
  const selected = ads.find((ad) => ad.id === selectedId) ?? active[0] ?? ads[0] ?? null;

  const kpis = [
    { label: "Active campaigns", value: active.length, note: `Across ${covered.size} of ${PLACEMENTS.length} placements`, icon: "campaign" },
    { label: "Paused", value: ads.length - active.length, note: "Hidden from every page", icon: "pause_circle" },
    { label: "Total creatives", value: ads.length, note: "Advertisements on file", icon: "imagesmode" },
    { label: "Sponsors", value: new Set(ads.map((ad) => ad.sponsor)).size, note: "Distinct advertisers", icon: "handshake" },
  ];

  return (
    <div className="flex flex-col gap-space-xl">
      <div className="flex flex-col gap-space-xs max-w-3xl">
        <span className="w-fit px-2.5 py-1 rounded bg-secondary/10 text-secondary font-label-sm text-label-sm uppercase tracking-wider font-semibold">
          Commercial media network - Sponsorship desk
        </span>
        <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Advertisements &amp; Brand Sponsorship</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
          Configure, pause and review the sponsored placements shown across the marketplace. Every creative is labelled as an advertisement.
        </p>
        {message ? (
          <p role="status" className="font-body-md text-primary">
            {message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-surface-container-lowest p-space-lg rounded shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-md text-label-md uppercase tracking-wider">{kpi.label}</span>
              <div className="w-8 h-8 rounded bg-secondary/10 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{kpi.icon}</span>
              </div>
            </div>
            <div className="mt-space-md">
              <span className="font-headline-md text-headline-md text-primary font-semibold">{kpi.value}</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{kpi.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary">Placement inventory</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Which sponsor currently owns each slot.</p>
          </div>
          <span className="font-label-sm text-label-sm text-secondary bg-secondary-container/30 px-3 py-1 rounded-full font-medium">
            {covered.size} of {PLACEMENTS.length} slots engaged
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-md">
          {PLACEMENTS.map((slot) => {
            const owner = active.find((ad) => ad.placement === slot.value);
            return (
              <div key={slot.value} className="bg-surface-container-lowest p-space-md rounded shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-space-xs">
                    <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">{slot.value.replace("_", " ")}</span>
                    <span className={`w-2 h-2 rounded-full ${owner ? "bg-emerald-500" : "bg-outline-variant"}`} />
                  </div>
                  <div className="font-title-md text-title-md text-primary mb-1">{slot.label}</div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">{slot.blurb}</p>
                </div>
                <div className="mt-space-md pt-space-sm border-t border-outline-variant/30">
                  <div className="font-label-sm text-label-sm text-on-surface-variant">Active sponsor</div>
                  <div className="font-spec-num text-spec-num text-primary font-medium truncate">{owner?.sponsor ?? "Open slot"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary">Campaigns &amp; creatives</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Flight dates, placement and status of every advertisement.</p>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]" aria-hidden="true">search</span>
            <input
              className="pl-9 pr-3 py-1.5 bg-surface-container-lowest border border-outline-variant/50 rounded font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary w-64"
              placeholder="Search sponsor, headline or slot..."
              aria-label="Search advertisements"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded shadow-sm overflow-hidden border border-outline-variant/30">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body-sm text-body-sm border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/40 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Sponsor</th>
                  <th className="py-3 px-4 font-semibold">Headline &amp; slot</th>
                  <th className="py-3 px-4 font-semibold">Flight</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {visible.map((ad) => (
                  <tr key={ad.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-4 px-4 align-top font-spec-num text-spec-num font-semibold text-primary">{ad.sponsor}</td>
                    <td className="py-4 px-4 align-top">
                      <div className="font-medium text-primary line-clamp-1">{ad.headline}</div>
                      <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-primary bg-surface-container px-2 py-0.5 rounded mt-1">
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">desktop_windows</span>
                        {ad.placement.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-4 px-4 align-top font-spec-num text-spec-num text-primary font-medium">{flightWindow(ad)}</td>
                    <td className="py-4 px-4 align-top text-center">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-label-sm text-label-sm font-semibold ${ad.is_active ? "bg-emerald-100 text-emerald-800" : "bg-surface-container text-on-surface-variant"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ad.is_active ? "bg-emerald-600" : "bg-outline"}`} />
                        {ad.is_active ? "Live" : "Paused"}
                      </span>
                    </td>
                    <td className="py-4 px-4 align-top text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title={ad.is_active ? "Pause" : "Activate"}
                          aria-label={ad.is_active ? "Pause" : "Activate"}
                          className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                          onClick={() => void run(() => staffAds.update(ad.id, { is_active: !ad.is_active }), "Advertisement updated.")}
                        >
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{ad.is_active ? "pause_circle" : "check_circle"}</span>
                        </button>
                        <button
                          type="button"
                          title="Inspect creative"
                          aria-label="Inspect creative"
                          className="p-1.5 rounded hover:bg-surface-container text-secondary transition-colors"
                          onClick={() => setSelectedId(ad.id)}
                        >
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">visibility</span>
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          aria-label="Delete"
                          className="p-1.5 rounded hover:bg-surface-container text-error transition-colors"
                          onClick={() => void run(() => staffAds.remove(ad.id), "Advertisement deleted.")}
                        >
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 ? (
                  <tr>
                    <td className="py-space-md px-4 text-on-surface-variant" colSpan={5}>
                      No advertisements yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        <div className="lg:col-span-7 flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-space-xs">
                <span className="w-2 h-2 rounded-full bg-secondary" />
                <h3 className="font-headline-sm text-headline-sm text-primary">Campaign creative inspector</h3>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Live rendering inside the marketplace framework.</p>
            </div>
            {selected ? (
              <div className="flex items-center gap-1 bg-surface-container px-2 py-1 rounded">
                <span className="text-label-sm font-label-sm text-on-surface-variant">Selected:</span>
                <span className="font-spec-num text-spec-num font-semibold text-primary">{selected.sponsor}</span>
              </div>
            ) : null}
          </div>
          {selected ? (
            <div className="p-space-lg rounded bg-[#F2F6F6] border border-dashed border-[#DCE3E3] flex flex-col gap-space-md relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#DCE3E3] pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-label-sm uppercase tracking-widest text-[#637177] font-semibold">Advertisement</span>
                  <span className="text-[11px] text-[#637177] bg-white/60 px-1.5 py-0.5 rounded">{selected.placement.replace("_", " ")}</span>
                </div>
                {selected.cta_url ? <span className="font-label-sm text-label-sm text-[#167D82]">{selected.cta_url.replace(/^https?:\/\//, "")}</span> : null}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-center bg-white p-space-md rounded shadow-sm">
                {selected.image_url ? (
                  <div className="md:col-span-5 aspect-[4/3] rounded overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="w-full h-full object-cover" alt="" src={selected.image_url} />
                  </div>
                ) : null}
                <div className={`${selected.image_url ? "md:col-span-7" : "md:col-span-12"} flex flex-col justify-between h-full py-1`}>
                  <div>
                    <div className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold mb-1">{selected.sponsor}</div>
                    <h4 className="font-headline-sm text-headline-sm text-primary leading-tight">{selected.headline}</h4>
                    {selected.body ? <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">{selected.body}</p> : null}
                  </div>
                  {selected.cta_label ? (
                    <div className="mt-space-md pt-space-xs border-t border-surface-container">
                      <span className="bg-primary text-on-primary font-body-sm text-body-sm px-3.5 py-1.5 rounded inline-flex items-center gap-1">
                        {selected.cta_label}
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="font-body-md text-on-surface-variant">Add an advertisement to preview it here.</p>
          )}
        </div>

        <form
          className="lg:col-span-5 bg-surface-container-lowest rounded shadow-sm p-space-lg grid gap-space-sm sm:grid-cols-2 content-start"
          onSubmit={(event) => {
            event.preventDefault();
            const { target, ...rest } = draft;
            const [kind, id] = target.split(":");
            void run(
              () => staffAds.create({ ...rest, broker: kind === "broker" ? id : null, professional: kind === "professional" ? id : null }),
              "Advertisement created.",
            );
            setDraft({ ...draft, sponsor: "", headline: "", body: "", cta_label: "", cta_url: "", target: "" });
          }}
        >
          <h3 className="font-headline-sm text-headline-sm text-primary sm:col-span-2">New commercial campaign</h3>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Placement
            <select className={FIELD} value={draft.placement} onChange={(e) => setDraft({ ...draft, placement: e.target.value as AdPlacement })}>
              {PLACEMENTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.value}
                </option>
              ))}
            </select>
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Sponsor
            <input className={FIELD} required value={draft.sponsor} onChange={(e) => setDraft({ ...draft, sponsor: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant sm:col-span-2">
            Headline
            <input className={FIELD} required value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant sm:col-span-2">
            Text
            <input className={FIELD} maxLength={500} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Button label
            <input className={FIELD} value={draft.cta_label} onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })} />
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant sm:col-span-2">
            Links to
            <select className={FIELD} value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })}>
              <option value="">External URL (below)</option>
              <optgroup label="Brokers">
                {targets.brokers.map((b) => (
                  <option key={b.id} value={`broker:${b.id}`}>{b.label}</option>
                ))}
              </optgroup>
              <optgroup label="Professionals">
                {targets.professionals.map((p) => (
                  <option key={p.id} value={`professional:${p.id}`}>{p.label}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="font-label-sm uppercase text-on-surface-variant">
            Button URL
            <input className={FIELD} type="url" value={draft.cta_url} onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })} />
          </label>
          <button type="submit" className="self-start rounded bg-primary px-space-md py-space-sm font-body-md text-on-primary sm:col-span-2 inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add_circle</span>
            Add advertisement
          </button>
        </form>
      </div>
    </div>
  );
}
