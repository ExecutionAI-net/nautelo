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
      <h1 className="font-headline-lg text-headline-lg text-primary">Team</h1>
      {message ? (
        <p role="status" className="font-body-md">
          {message}
        </p>
      ) : null}
      <ul className={`${CARD} divide-y divide-outline-variant`}>
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-space-sm py-space-sm">
            <div>
              <p className="font-title-sm text-title-sm text-on-surface">{member.user_full_name || member.user_email}</p>
              <p className="font-body-sm text-on-surface-variant">
                {member.user_email} - {member.role} - {member.is_active ? "Active" : "Inactive"}
              </p>
            </div>
            <div className="flex gap-space-sm">
              <button
                type="button"
                className="font-body-md text-primary underline"
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
            </div>
          </li>
        ))}
        {members.length === 0 ? <li className="py-space-sm font-body-md text-on-surface-variant">No members.</li> : null}
      </ul>
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
        <h1 className="font-headline-lg text-headline-lg text-primary">Brokerage profile</h1>
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

  return (
    <div className="flex flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg text-primary">Subscription</h1>
      <div className={`${CARD} grid gap-space-md sm:grid-cols-2`}>
        <div>
          <p className={LABEL}>Account status</p>
          <p className="font-title-md text-title-md text-primary">{profile?.status ?? "-"}</p>
        </div>
        <div>
          <p className={LABEL}>Listing approval</p>
          <p className="font-title-md text-title-md text-primary">
            {profile ? (profile.auto_approve_listings ? "Automatic" : "Reviewed by staff") : "-"}
          </p>
        </div>
      </div>
      <p className="font-body-md text-on-surface-variant">
        Billing for brokerage plans is not self-service yet. Contact the platform team to change your plan.
      </p>
    </div>
  );
}
