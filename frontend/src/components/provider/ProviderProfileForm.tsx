"use client";

import { useEffect, useState } from "react";

import {
  createProviderProfile,
  fetchProviderProfile,
  updateProviderProfile,
  type ProviderProfile,
} from "@/lib/api/provider";

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md focus:outline-none";
const LABEL = "font-label-sm uppercase text-on-surface-variant";

interface Draft {
  display_name: string;
  short_description: string;
  description: string;
  public_email: string;
  public_phone: string;
  website_url: string;
  city: string;
  postal_code: string;
  region: string;
  country_code: string;
  service_area: string;
}

const EMPTY: Draft = {
  display_name: "",
  short_description: "",
  description: "",
  public_email: "",
  public_phone: "",
  website_url: "",
  city: "",
  postal_code: "",
  region: "",
  country_code: "",
  service_area: "",
};

function toDraft(profile: ProviderProfile): Draft {
  return { ...profile, website_url: profile.website_url ?? "", service_area: profile.service_area.join(", ") };
}

export default function ProviderProfileForm() {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProviderProfile().then(
      (found) => {
        setProfile(found);
        if (found) setDraft(toDraft(found));
        setLoaded(true);
      },
      () => {
        setMessage("The profile could not be loaded.");
        setLoaded(true);
      },
    );
  }, []);

  function payload(submit: boolean) {
    return {
      ...draft,
      website_url: draft.website_url.trim() || null,
      service_area: draft.service_area.split(",").map((item) => item.trim()).filter(Boolean),
      ...(submit ? { submit: true } : {}),
    };
  }

  async function save(submit: boolean) {
    setMessage(null);
    try {
      const saved = profile ? await updateProviderProfile(payload(submit)) : await createProviderProfile(payload(submit));
      setProfile(saved);
      setDraft(toDraft(saved));
      setMessage(submit ? "Submitted for review." : "Profile saved.");
    } catch {
      setMessage("The profile could not be saved. Check the highlighted fields and try again.");
    }
  }

  const set = (key: keyof Draft) => (event: { target: { value: string } }) => setDraft({ ...draft, [key]: event.target.value });

  if (!loaded) return <p className="font-body-md text-on-surface-variant">Loading...</p>;

  return (
    <form
      className="grid gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <div className="sm:col-span-2">
        <h1 className="font-headline-lg text-headline-lg text-primary">Company profile</h1>
        <p className="font-body-md text-on-surface-variant">
          Status: <strong>{profile?.status ?? "Not created yet"}</strong>
          {profile?.status === "DRAFT" ? " - submit it for review to appear in the directory." : ""}
        </p>
        {message ? (
          <p role="status" className="mt-space-sm font-body-md">
            {message}
          </p>
        ) : null}
      </div>
      <label className={LABEL}>
        Company name
        <input className={FIELD} required value={draft.display_name} onChange={set("display_name")} />
      </label>
      <label className={LABEL}>
        Country code
        <input className={FIELD} required maxLength={2} value={draft.country_code} onChange={set("country_code")} />
      </label>
      <label className={LABEL}>
        Public email
        <input className={FIELD} type="email" required value={draft.public_email} onChange={set("public_email")} />
      </label>
      <label className={LABEL}>
        Public phone
        <input className={FIELD} required value={draft.public_phone} onChange={set("public_phone")} />
      </label>
      <label className={LABEL}>
        Website
        <input className={FIELD} type="url" value={draft.website_url} onChange={set("website_url")} />
      </label>
      <label className={LABEL}>
        City
        <input className={FIELD} value={draft.city} onChange={set("city")} />
      </label>
      <label className={LABEL}>
        Region
        <input className={FIELD} value={draft.region} onChange={set("region")} />
      </label>
      <label className={LABEL}>
        Postal code
        <input className={FIELD} value={draft.postal_code} onChange={set("postal_code")} />
      </label>
      <label className={`${LABEL} sm:col-span-2`}>
        Service area (comma separated)
        <input className={FIELD} value={draft.service_area} onChange={set("service_area")} />
      </label>
      <label className={`${LABEL} sm:col-span-2`}>
        Short description
        <input className={FIELD} maxLength={300} value={draft.short_description} onChange={set("short_description")} />
      </label>
      <label className={`${LABEL} sm:col-span-2`}>
        Description
        <textarea className={FIELD} rows={6} value={draft.description} onChange={set("description")} />
      </label>
      <div className="flex gap-space-sm sm:col-span-2">
        <button type="submit" className="rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary">
          {profile ? "Save profile" : "Create profile"}
        </button>
        {profile?.status === "DRAFT" ? (
          <button
            type="button"
            className="rounded-lg border border-primary px-space-md py-space-sm font-body-md text-primary"
            onClick={() => void save(true)}
          >
            Submit for review
          </button>
        ) : null}
      </div>
    </form>
  );
}
