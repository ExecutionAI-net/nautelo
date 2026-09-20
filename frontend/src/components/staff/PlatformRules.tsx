"use client";

import { useEffect, useState } from "react";

import { fetchPlatformSettings, updatePlatformSetting, type PlatformSettingRow } from "@/lib/api/staffSettings";

const GROUPS: Record<string, { title: string; kicker: string; blurb: string; icon: string; tile: string }> = {
  finance: {
    title: "Finance estimates",
    kicker: "Financing",
    blurb: "Switches for the finance estimate shown on boat cards and listing forms.",
    icon: "price_check",
    tile: "bg-primary-fixed text-primary",
  },
  individual: {
    title: "Private seller listing rules",
    kicker: "Catalog Governance",
    blurb: "Free listing allowance and how long free and paid listings stay published.",
    icon: "rule",
    tile: "bg-secondary-fixed text-on-secondary-fixed",
  },
  media: {
    title: "Photo and video allowances",
    kicker: "Media",
    blurb: "How many photos and videos a listing may carry, per seller tier.",
    icon: "imagesmode",
    tile: "bg-tertiary-fixed text-on-tertiary-fixed",
  },
};

const LABELS: Record<string, string> = {
  "finance.enabled": "Show finance estimates",
  "finance.broker_overrides_enabled": "Let brokers override finance assumptions",
  "individual.free_listing_count": "Free listings per period",
  "individual.free_period_days": "Free period (days)",
  "individual.free_publish_days": "Free listing publish duration (days)",
  "individual.paid_publish_days": "Paid listing publish duration (days)",
  "individual.paid_entitlement_valid_days": "Paid listing right validity (days)",
  "media.private_base_image_limit": "Free private listing - photos",
  "media.private_base_video_limit": "Free private listing - videos",
  "media.upgraded_image_limit": "Paid private listing - photos",
  "media.upgraded_video_limit": "Paid private listing - videos",
  "media.broker_image_limit": "Broker listing - photos",
  "media.broker_video_limit": "Broker listing - videos",
};

const TOGGLE_TRACK =
  "w-11 h-6 bg-surface-dim rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary";

function Row({ row, onChanged }: { row: PlatformSettingRow; onChanged: () => void }) {
  const [draft, setDraft] = useState(String(row.value));
  const [message, setMessage] = useState<string | null>(null);
  const label = LABELS[row.key] ?? row.key;

  async function commit(value: boolean | number) {
    setMessage(null);
    try {
      await updatePlatformSetting(row.key, value);
      setMessage("Saved");
      onChanged();
    } catch {
      setMessage("Not accepted: outside the allowed range.");
      setDraft(String(row.value));
    }
  }

  return (
    <div className="flex items-center justify-between gap-space-md p-space-md rounded-lg bg-surface-container-low">
      <div className="flex flex-col">
        <span className="font-body-sm text-body-sm text-primary font-medium">{label}</span>
        <span className="text-[11px] text-on-surface-variant">
          {row.key} - default {String(row.default)}
          {message ? ` - ${message}` : ""}
        </span>
      </div>
      {row.type === "boolean" ? (
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" aria-label={label} className="sr-only peer" checked={row.value === true} onChange={(event) => void commit(event.target.checked)} />
          <div className={TOGGLE_TRACK} />
        </label>
      ) : (
        <input
          type="number"
          aria-label={label}
          className="w-24 p-space-sm rounded-lg bg-surface-container-lowest font-body-md text-primary text-right focus:outline-none"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== "" && Number(draft) !== row.value) void commit(Number(draft));
          }}
        />
      )}
    </div>
  );
}

export default function PlatformRules() {
  const [rows, setRows] = useState<PlatformSettingRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchPlatformSettings().then(
      (body) => {
        if (!cancelled) setRows(body.settings);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);

  if (failed) return <p role="alert">The settings could not be loaded.</p>;
  if (!rows) return <p className="text-on-surface-variant">Loading…</p>;

  return (
    <div className="flex flex-col gap-space-xl">
      {Object.entries(GROUPS).map(([prefix, group]) => (
        <section key={prefix} className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm flex flex-col gap-space-lg">
          <div className="flex items-start gap-space-md">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-1 ${group.tile}`}>
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{group.icon}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">{group.kicker}</span>
              <h2 className="font-headline-sm text-headline-sm text-primary">{group.title}</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{group.blurb}</p>
            </div>
          </div>
          <div className="flex flex-col gap-space-sm">
            {rows
              .filter((row) => row.key.startsWith(`${prefix}.`))
              .map((row) => (
                <Row key={`${row.key}-${String(row.value)}`} row={row} onChanged={() => setTick((n) => n + 1)} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
