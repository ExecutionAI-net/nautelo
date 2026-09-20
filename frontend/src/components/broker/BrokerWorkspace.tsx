"use client";

import { useCallback, useEffect, useState } from "react";

import { primaryBrokerMembership } from "@/components/broker/BrokerDashboardNav";
import { apiFetch } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";

interface Member {
  id: string;
  user_email: string;
  user_full_name: string;
  role: string;
  can_edit_listings: boolean;
  can_manage_team: boolean;
  can_read_messages: boolean;
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
}

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md focus:outline-none";
const LABEL = "font-label-sm uppercase text-on-surface-variant";
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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("AGENT");

  const reload = useCallback(async () => {
    if (!brokerId) return;
    try {
      setMembers(await apiFetch<Member[]>(`/api/v1/brokers/${brokerId}/members/`));
    } catch {
      setMessage("The team could not be loaded. Team management needs an administrator role.");
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
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Brokerage CRM / Team</span>
          <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Team</h1>
        </div>
        <div className="bg-surface-container-lowest px-space-md py-space-xs rounded-xl shadow-sm flex items-center gap-space-md">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Active members</span>
            <span className="font-spec-num text-spec-num font-semibold text-primary">{members.filter((m) => m.is_active).length} of {members.length}</span>
          </div>
        </div>
      </div>
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
                        <span className="font-title-md text-primary font-semibold truncate">{member.user_full_name || member.user_email}</span>
                        <span className="text-body-sm text-on-surface-variant truncate">{member.user_email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex px-2.5 py-0.5 rounded bg-surface-container font-label-md text-primary">{member.role}</span>
                  </td>
                  <td className="py-3.5 px-4 text-on-surface-variant">
                    {[member.can_edit_listings && "Listings", member.can_manage_team && "Team", member.can_read_messages && "Messages"].filter(Boolean).join(" - ") || "Read only"}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-medium ${member.is_active ? "bg-emerald-50 text-emerald-800" : "bg-surface-container text-on-surface-variant"}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                      {member.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="text-secondary hover:text-primary font-title-md text-body-sm px-2 py-1"
                      onClick={() =>
                        void run(
                          () =>
                            apiFetch(`/api/v1/brokers/${brokerId}/members/${member.id}/`, {
                              method: "PATCH",
                              headers: JSON_HEADERS,
                              body: JSON.stringify({ is_active: !member.is_active }),
                            }),
                          "Member updated.",
                        )
                      }
                    >
                      {member.is_active ? "Deactivate" : "Reactivate"}
                    </button>
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
      <form
        className={`${CARD} grid gap-space-sm sm:grid-cols-3`}
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () =>
              apiFetch(`/api/v1/brokers/${brokerId}/members/`, {
                method: "POST",
                headers: JSON_HEADERS,
                body: JSON.stringify({ user_email: email, role }),
              }),
            "Member added.",
          );
          setEmail("");
        }}
      >
        <label className={LABEL}>
          Existing account email
          <input className={FIELD} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={LABEL}>
          Role
          <select className={FIELD} value={role} onChange={(e) => setRole(e.target.value)}>
            {["ADMIN", "MANAGER", "AGENT", "VIEWER"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="self-end rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary">
          Add member
        </button>
      </form>
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
  const form = draft ?? profile;

  if (!brokerId) return <p className="font-body-md text-on-surface-variant">No brokerage is linked to this account.</p>;
  if (error) return <p role="alert">The profile could not be loaded. Editing needs an administrator role.</p>;
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
            }),
          });
          setProfile(saved);
          setDraft(null);
          setMessage("Profile saved.");
        } catch {
          setMessage("The profile could not be saved.");
        }
      }}
    >
      <div className="sm:col-span-2">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Brokerage CRM / Company profile</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Brokerage profile</h1>
        <p className="mt-space-xs font-body-md text-on-surface-variant">This is what buyers see on your public broker page.</p>
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
      <button type="submit" className="self-start rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary">
        Save profile
      </button>
    </form>
  );
}

export function BrokerSubscription() {
  const { brokerId, profile, error } = useBrokerProfile();

  if (!brokerId) return <p className="font-body-md text-on-surface-variant">No brokerage is linked to this account.</p>;
  if (error) return <p role="alert">The account details could not be loaded.</p>;

  const cards = [
    { label: "Account status", value: profile?.status ?? "-", icon: "verified_user", note: "Set by the platform team" },
    {
      label: "Listing approval",
      value: profile ? (profile.auto_approve_listings ? "Automatic" : "Reviewed by staff") : "-",
      icon: "rule",
      note: "How new listings reach the public site",
    },
    { label: "Public page", value: profile?.slug ? `/brokers/${profile.slug}/` : "-", icon: "public", note: "Your marketplace profile address" },
  ];

  return (
    <div className="flex flex-col gap-space-lg">
      <div>
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Brokerage CRM / Subscription</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Subscription</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {cards.map((card) => (
          <div key={card.label} className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-md text-label-md uppercase tracking-wider">{card.label}</span>
              <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{card.icon}</span>
              </div>
            </div>
            <p className="mt-space-md font-headline-sm text-headline-sm text-primary break-words">{card.value}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{card.note}</p>
          </div>
        ))}
      </div>
      <div className="bg-surface-container-low rounded-xl p-space-lg flex items-start gap-space-md">
        <span className="material-symbols-outlined text-secondary" aria-hidden="true">info</span>
        <p className="font-body-md text-on-surface-variant">
          Billing for brokerage plans is not self-service yet. Contact the platform team to change your plan.
        </p>
      </div>
    </div>
  );
}
