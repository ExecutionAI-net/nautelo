"use client";

import PromotePanel from "@/components/promotion/PromotePanel";
import OrgLocationFields from "@/components/places/OrgLocationFields";
import BrokerBilling from "@/components/broker/BrokerBilling";
import OrgImageUpload from "@/components/team/OrgImageUpload";
import CompletenessChecklist, { type Completeness } from "@/components/team/CompletenessChecklist";
import InvitePanel from "@/components/team/InvitePanel";
import { useCallback, useEffect, useState } from "react";

import { primaryBrokerMembership } from "@/components/broker/BrokerDashboardNav";
import PlanCards from "@/components/pricing/PlanCards";
import { ApiError, apiFetch } from "@/lib/api/client";
import { fetchPricingClient, formatPrice, type PlanSummary } from "@/lib/api/plans";
import { useSession } from "@/lib/auth/session";

interface Member {
  id: string;
  user_email: string;
  user_full_name: string;
  role: string;
  can_edit_listings: boolean;
  can_manage_team: boolean;
  can_read_messages: boolean;
  is_owner?: boolean;
  is_active: boolean;
}

interface BrokerProfile {
  id: string;
  name: string;
  slug: string;
  status: string;
  public_email: string;
  public_phone: string;
  website_url: string | null;
  auto_approve_listings: boolean;
  tagline: string;
  about: string;
  city: string;
  place_id?: number | null;
  country_code: string;
  logo_url: string;
  cover_image_url: string;
  specialties: string[];
  completeness?: Completeness;
  logo_upload_url?: string | null;
  cover_upload_url?: string | null;
  plan?: PlanSummary | null;
  renews_at?: string | null;
  listings_used?: number;
  seats_used?: number;
}

const SUBMIT_REASONS: Record<string, string> = {
  profile_incomplete: "Finish the items in the checklist before submitting.",
  subscription_required: "Start your free trial on the Membership page first, then submit for review.",
};

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md focus:outline-none";
const LABEL = "flex flex-col gap-1 font-label-md text-on-surface";

// brokers/enums.py ROLE_DEFAULT_CAPABILITIES, in words.
const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", MANAGER: "Manager", AGENT: "Agent", VIEWER: "Viewer" };
const ROLE_HELP: [string, string][] = [
  ["Admin", "Everything: listings, messages, team and billing. The owner is always an admin."],
  ["Manager", "Edits listings and answers messages; cannot change the team."],
  ["Agent", "Edits listings only."],
  ["Viewer", "Read-only access to the dashboard."],
];

function accessText(member: Member): string {
  const parts = [
    member.can_edit_listings && "edit listings",
    member.can_manage_team && "manage the team",
    member.can_read_messages && "read messages",
  ].filter(Boolean) as string[];
  if (parts.length === 0) return "Read only";
  const text = parts.join(", ");
  return `Can ${text.charAt(0)}${text.slice(1)}`;
}
const CARD = "rounded-xl bg-surface-container-lowest p-space-lg shadow-sm";
const JSON_HEADERS = { "Content-Type": "application/json" };

function useBrokerId(): string | null {
  const { session } = useSession();
  return primaryBrokerMembership(session)?.broker_id ?? null;
}

export function BrokerTeam() {
  const brokerId = useBrokerId();
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!brokerId) return;
    try {
      setMembers(await apiFetch<Member[]>(`/api/v1/brokers/${brokerId}/members/`));
    } catch {
      setMessage("The team could not be loaded. Team management needs an administrator role and a verified email address.");
    }
  }, [brokerId]);

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
      setMessage("The change was refused.");
    }
  }

  if (!brokerId) return <p className="font-body-md text-on-surface-variant">No brokerage is linked to this account.</p>;

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Brokerage / Team</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Team</h1>
        </div>
        <div className="bg-surface-container-lowest px-space-md py-space-xs rounded-xl shadow-sm flex items-center gap-space-md">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Active members</span>
            <span className="font-spec-num text-spec-num font-semibold text-primary">{members.filter((m) => m.is_active).length} of {members.length}</span>
          </div>
        </div>
      </div>
      <details className="rounded-lg bg-surface-container-low p-space-sm">
        <summary className="cursor-pointer font-label-md text-primary">What the roles mean</summary>
        <dl className="mt-space-xs grid gap-space-xs sm:grid-cols-2 font-body-sm">
          {ROLE_HELP.map(([role, help]) => (
            <div key={role}>
              <dt className="font-semibold text-on-surface">{role}</dt>
              <dd className="text-on-surface-variant">{help}</dd>
            </div>
          ))}
        </dl>
      </details>
      {message ? (
        <p role="status" className="font-body-md">
          {message}
        </p>
      ) : null}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Access</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div aria-hidden="true" className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-title-md text-body-sm shrink-0">
                        {(member.user_full_name || member.user_email).split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-title-md text-primary font-semibold truncate">{member.user_full_name || member.user_email}{member.is_owner ? " (owner)" : ""}</span>
                        <span className="text-body-sm text-on-surface-variant truncate">{member.user_email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex px-2.5 py-0.5 rounded bg-surface-container font-label-md text-primary">{ROLE_LABEL[member.role] ?? member.role}</span>
                  </td>
                  <td className="py-3.5 px-4 text-on-surface-variant">
                    {accessText(member)}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-medium ${member.is_active ? "bg-emerald-50 text-emerald-800" : "bg-surface-container text-on-surface-variant"}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                      {member.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    {member.is_owner ? null : (
                    <button
                      type="button"
                      className="text-secondary hover:text-primary font-title-md text-body-sm px-2 py-1"
                      onClick={() => {
                        const name = member.user_full_name || member.user_email;
                        if (member.is_active && !window.confirm(`Deactivate ${name}? They lose access to this brokerage until reactivated.`)) return;
                        void run(
                          () =>
                            apiFetch(`/api/v1/brokers/${brokerId}/members/${member.id}/`, {
                              method: "PATCH",
                              headers: JSON_HEADERS,
                              body: JSON.stringify({ is_active: !member.is_active }),
                            }),
                          "Member updated.",
                        );
                      }}
                    >
                      {member.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 ? (
                <tr>
                  <td className="py-space-md px-4 text-on-surface-variant" colSpan={5}>No members.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <InvitePanel baseUrl={`/api/v1/brokers/${brokerId}/invitations/`} onChange={() => void reload()} />
    </div>
  );
}

function useBrokerProfile() {
  const brokerId = useBrokerId();
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!brokerId) return;
    apiFetch<BrokerProfile>(`/api/v1/brokers/${brokerId}/profile/`).then(setProfile, () => setError(true));
  }, [brokerId]);

  return { brokerId, profile, setProfile, error };
}

export function BrokerProfileForm() {
  const { brokerId, profile, setProfile, error } = useBrokerProfile();
  const [draft, setDraft] = useState<Partial<BrokerProfile> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tags, setTags] = useState<string | null>(null);
  const form = draft ?? profile;

  if (!brokerId) return <p className="font-body-md text-on-surface-variant">No brokerage is linked to this account.</p>;
  if (error) return <p role="alert">The profile could not be loaded. Editing needs an administrator role and a verified email address.</p>;
  if (!form) return <p className="font-body-md text-on-surface-variant">Loading...</p>;

  const set = (key: keyof BrokerProfile) => (event: { target: { value: string } }) => setDraft({ ...form, [key]: event.target.value });

  return (
    <form
      className={`${CARD} grid gap-space-md sm:grid-cols-2`}
      onSubmit={async (event) => {
        event.preventDefault();
        setMessage(null);
        try {
          const saved = await apiFetch<BrokerProfile>(`/api/v1/brokers/${brokerId}/profile/`, {
            method: "PATCH",
            headers: JSON_HEADERS,
            body: JSON.stringify({
              name: form.name,
              public_email: form.public_email,
              public_phone: form.public_phone,
              website_url: form.website_url || null,
              tagline: form.tagline ?? "",
              about: form.about ?? "",
              city: form.city ?? "",
              ...(form.place_id ? { place_id: form.place_id } : {}),
              country_code: form.country_code ?? "",
              specialties: tags === null ? (form.specialties ?? []) : tags.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8),
            }),
          });
          setProfile(saved);
          setDraft(null);
          setTags(null);
          setMessage("Profile saved.");
        } catch {
          setMessage("The profile could not be saved.");
        }
      }}
    >
      <div className="sm:col-span-2">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Brokerage / Profile</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Profile</h1>
        <p className="mt-space-xs font-body-md text-on-surface-variant">
          This is what buyers see on your public broker page.
          {form.status === "ACTIVE" && form.slug ? (
            <>
              {" "}
              <a href={`/brokers/${form.slug}/`} className="text-primary underline" target="_blank" rel="noreferrer">
                View public page
              </a>
            </>
          ) : null}
        </p>
        {form.status === "DRAFT" ? <CompletenessChecklist completeness={form.completeness} /> : null}
        {message ? (
          <p role="status" className="mt-space-sm font-body-md">
            {message}
          </p>
        ) : null}
      </div>
      <label className={LABEL}>
        Name
        <input className={FIELD} required value={form.name ?? ""} onChange={set("name")} />
      </label>
      <label className={LABEL}>
        Website
        <input className={FIELD} type="url" value={form.website_url ?? ""} onChange={set("website_url")} />
      </label>
      <label className={LABEL}>
        Public email
        <input className={FIELD} type="email" required value={form.public_email ?? ""} onChange={set("public_email")} />
      </label>
      <label className={LABEL}>
        Public phone
        <input className={FIELD} required value={form.public_phone ?? ""} onChange={set("public_phone")} />
      </label>
      <OrgLocationFields
        value={{ country_code: form.country_code ?? "", city: form.city ?? "", region: "", place_id: form.place_id ?? null }}
        onChange={(next) => setDraft({ ...form, country_code: next.country_code, city: next.city, place_id: next.place_id })}
      />
      <label className={`${LABEL} sm:col-span-2`}>
        Tagline
        <input className={FIELD} maxLength={300} value={form.tagline ?? ""} onChange={set("tagline")} />
      </label>
      <label className={`${LABEL} sm:col-span-2`}>
        About your company
        <textarea className={FIELD} rows={5} maxLength={4000} value={form.about ?? ""} onChange={set("about")} />
      </label>
      <OrgImageUpload
        kind="logo"
        label="Logo"
        intentUrl={`/api/v1/brokers/${brokerId}/images/intent/`}
        completeUrl={`/api/v1/brokers/${brokerId}/images/complete/`}
        currentUrl={form.logo_upload_url ?? form.logo_url}
      />
      <OrgImageUpload
        kind="cover"
        label="Cover image"
        intentUrl={`/api/v1/brokers/${brokerId}/images/intent/`}
        completeUrl={`/api/v1/brokers/${brokerId}/images/complete/`}
        currentUrl={form.cover_upload_url ?? form.cover_image_url}
      />
      <label className={`${LABEL} sm:col-span-2`}>
        Specialties (comma separated, up to 8)
        <input
          className={FIELD}
          value={tags ?? (form.specialties ?? []).join(", ")}
          onChange={(event) => setTags(event.target.value)}
        />
      </label>
      <div className="flex gap-space-sm sm:col-span-2">
        <button type="submit" className="rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary">
          Save profile
        </button>
        {form.status === "DRAFT" ? (
          <button
            type="button"
            className="rounded-lg border border-primary px-space-md py-space-sm font-body-md text-primary"
            onClick={async () => {
              setMessage(null);
              try {
                setProfile(await apiFetch<BrokerProfile>(`/api/v1/brokers/${brokerId}/profile/submit/`, { method: "POST" }));
                setMessage("Submitted for review.");
              } catch (caught) {
                const code = caught instanceof ApiError ? caught.fields.submit?.[0]?.message : undefined;
                setMessage((code && SUBMIT_REASONS[code]) || "The profile could not be submitted.");
                try {
                  setProfile(await apiFetch<BrokerProfile>(`/api/v1/brokers/${brokerId}/profile/`));
                } catch {
                  /* keep the current view */
                }
              }
            }}
          >
            Submit for review
          </button>
        ) : null}
      </div>
    </form>
  );
}

function UsageGauge({ icon, label, used, limit, bar }: { icon: string; label: string; used: number; limit: number | null; bar: string }) {
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-sm">
      <div className="flex justify-between items-center font-body-sm">
        <span className="font-title-md text-title-md text-primary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">{icon}</span>
          {label}
        </span>
        <span className="font-spec-num text-spec-num text-primary font-semibold">
          {used} <span className="text-on-surface-variant font-normal">{limit === null ? "used, no limit" : `of ${limit}`}</span>
        </span>
      </div>
      {limit !== null ? (
        <>
          <div className="w-full bg-surface-container-highest rounded-full h-2.5 overflow-hidden">
            <div className={`${bar} h-full rounded-full transition-all duration-500`} style={{ width: `${percent}%` }} />
          </div>
          <p className="font-label-sm text-on-surface-variant">{Math.max(limit - used, 0)} free</p>
        </>
      ) : null}
    </div>
  );
}

export function BrokerSubscription() {
  const { brokerId, profile, error } = useBrokerProfile();
  const [plans, setPlans] = useState<PlanSummary[]>([]);

  useEffect(() => {
    fetchPricingClient().then((pricing) => setPlans(pricing.broker_plans), () => setPlans([]));
  }, []);

  if (!brokerId) return <p className="font-body-md text-on-surface-variant">No brokerage is linked to this account.</p>;
  if (error) return <p role="alert">The account details could not be loaded. Check that your email address is verified.</p>;

  const plan = profile?.plan ?? null;

  return (
    <div className="flex flex-col gap-space-xl">
      <div>
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Brokerage / My plan</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">My plan</h1>
        <p className="mt-space-xs font-body-md text-on-surface-variant">Your tier sets how many active listings and team seats your brokerage has and how its profile is placed in the directory.</p>
      </div>

      <BrokerBilling brokerId={brokerId} />

      <section className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm flex flex-col gap-space-lg relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm tracking-wide uppercase font-semibold">Your plan</span>
        </div>
        {plan ? (
          <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-space-sm">
            <div>
              <h2 className="font-headline-md text-headline-md text-primary">{plan.name}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">{plan.tagline}</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-headline-lg text-headline-lg text-primary">{formatPrice(plan.monthly_price, plan.currency)}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">/ month</span>
            </div>
          </div>
        ) : (
          <p className="font-body-md text-on-surface-variant">No plan is assigned to your brokerage yet, so no limits apply. Choose a plan below and contact the platform team.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
          <UsageGauge icon="sailing" label="Published vessels" used={profile?.listings_used ?? 0} limit={plan ? plan.listing_limit : null} bar="bg-secondary" />
          <UsageGauge icon="group" label="Team seats" used={profile?.seats_used ?? 0} limit={plan ? plan.seat_limit : null} bar="bg-primary" />
        </div>
      </section>

      <section className="flex flex-col gap-space-lg">
        <div className="flex flex-col gap-space-xs">
          <span className="font-label-sm uppercase tracking-widest text-secondary font-semibold">Plans</span>
          <h2 className="font-headline-md text-headline-md text-primary">Other plans</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">To move to another plan, request it and our team switches your brokerage over.</p>
        </div>
        <PlanCards plans={plans} currentSlug={plan?.slug} ctaLabel="Request this plan" />
      </section>

      <PromotePanel mode="listings" returnPath="/dashboard/broker/subscription/" />
    </div>
  );
}
