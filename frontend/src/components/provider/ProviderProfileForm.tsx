"use client";

import { useEffect, useState } from "react";

import OrgLocationFields from "@/components/places/OrgLocationFields";
import ServiceAreaPicker from "@/components/places/ServiceAreaPicker";
import CompletenessChecklist from "@/components/team/CompletenessChecklist";
import OrgImageUpload from "@/components/team/OrgImageUpload";
import UnpaidNotice from "@/components/provider/UnpaidNotice";
import { ApiError } from "@/lib/api/client";
import { fetchServiceCategoriesClient, type ServiceCategoryOption } from "@/lib/api/plans";
import {
  createProviderProfile,
  fetchProviderProfile,
  updateProviderProfile,
  type ProviderProfile,
} from "@/lib/api/provider";

const SUBMIT_REASONS: Record<string, string> = {
  profile_incomplete: "Finish the items in the checklist before submitting.",
  subscription_required: "Start your free trial on the Membership page first, then submit for review.",
};

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
  place_id: number | null;
  service_area: string[];
  category: string;
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
  place_id: null,
  service_area: [],
  category: "",
};

function toDraft(profile: ProviderProfile): Draft {
  return { ...profile, place_id: profile.place_id ?? null, website_url: profile.website_url ?? "", service_area: profile.service_area };
}

const PROFILE_STATUS: Record<string, string> = {
  DRAFT: "Draft (not in the directory yet)",
  PENDING: "Waiting for staff review",
  ACTIVE: "Active (listed in the directory)",
  SUSPENDED: "Suspended",
};

export default function ProviderProfileForm() {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategoryOption[]>([]);

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
    fetchServiceCategoriesClient().then(setCategories, () => setCategories([]));
  }, []);

  function payload(submit: boolean) {
    return {
      ...draft,
      website_url: draft.website_url.trim() || null,
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
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.fields.submit?.[0]?.message : undefined;
      setMessage((code && SUBMIT_REASONS[code]) || "The profile could not be saved. Check the highlighted fields and try again.");
      if (code && profile) {
        try {
          const fresh = await fetchProviderProfile();
          if (fresh) setProfile(fresh);
        } catch {
          /* keep the current view */
        }
      }
    }
  }

  const set =
    (key: keyof Omit<Draft, "service_area" | "place_id">) =>
    (event: { target: { value: string } }) =>
      setDraft({ ...draft, [key]: event.target.value });

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
        <UnpaidNotice status={profile?.status} />
      </div>
      <div className="sm:col-span-2">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Service provider / Profile</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Profile</h1>
        <p className="font-body-md text-on-surface-variant">
          This is what customers see in the directory. Status:{" "}
          <strong>{profile?.status ? PROFILE_STATUS[profile.status] ?? profile.status : "Not created yet"}</strong>
          {profile?.status === "DRAFT" ? " - submit it for review to appear in the directory." : ""}
        </p>
        {profile?.status === "DRAFT" ? <CompletenessChecklist completeness={profile.completeness} servicesHref="/dashboard/service-provider/services/" /> : null}
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
        Which field are you a professional in?
        <select className={FIELD} value={draft.category} onChange={set("category")}>
          <option value="">Choose a category</option>
          {categories.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <OrgLocationFields
        withRegion
        value={{ country_code: draft.country_code, city: draft.city, region: draft.region, place_id: draft.place_id }}
        onChange={(next) => setDraft({ ...draft, ...next })}
      />
      <label className={LABEL}>
        Postal code
        <input className={FIELD} value={draft.postal_code} onChange={set("postal_code")} />
      </label>
      <div className={`${LABEL} sm:col-span-2 flex flex-col gap-1`}>
        Service area
        <ServiceAreaPicker value={draft.service_area} onChange={(service_area) => setDraft({ ...draft, service_area })} />
      </div>
      <label className={`${LABEL} sm:col-span-2`}>
        Short description
        <input className={FIELD} maxLength={300} value={draft.short_description} onChange={set("short_description")} />
      </label>
      {profile ? (
        <>
          <OrgImageUpload kind="logo" label="Logo" intentUrl="/api/v1/provider/images/intent/" completeUrl="/api/v1/provider/images/complete/" currentUrl={profile.logo_url} />
          <OrgImageUpload kind="cover" label="Cover image" intentUrl="/api/v1/provider/images/intent/" completeUrl="/api/v1/provider/images/complete/" currentUrl={profile.cover_url} />
        </>
      ) : null}
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
